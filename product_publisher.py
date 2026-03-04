"""
闲鱼商品发布模块

基于 Playwright 实现的闲鱼商品自动发布功能
参考: https://cloud.tencent.cn/developer/article/2538483

功能:
- 批量商品发布
- 图片上传
- 商品信息填写
- 分类选择
- 位置设置
- 防检测策略
- 完善的错误处理和重试机制
- 多选择器降级策略
- 自动截图功能
- 进度回调支持
- 配置文件热加载
"""

import asyncio
import random
import time
import os
import yaml
from typing import List, Dict, Optional, Any, Callable, Tuple
from pathlib import Path
from datetime import datetime
from loguru import logger
from playwright.async_api import async_playwright, Page, Browser, BrowserContext, TimeoutError as PlaywrightTimeoutError
from dataclasses import dataclass


@dataclass
class ProductInfo:
    """商品信息数据类"""
    title: str  # 商品标题
    description: str  # 商品描述
    price: float  # 商品价格
    images: List[str]  # 图片路径列表
    category: Optional[str] = None  # 分类路径（如：数码产品/手机/苹果）
    location: Optional[str] = None  # 发货地（如：北京市/朝阳区）
    original_price: Optional[float] = None  # 原价
    stock: Optional[int] = 1  # 库存数量


class PublisherConfig:
    """发布器配置管理类"""
    
    def __init__(self, config_path: str = "product_publisher_config.yml"):
        """初始化配置
        
        Args:
            config_path: 配置文件路径
        """
        self.config_path = config_path
        self.config = self._load_config()
        self._last_modified = self._get_file_mtime()
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        try:
            if not os.path.exists(self.config_path):
                logger.warning(f"配置文件不存在: {self.config_path}，使用默认配置")
                return self._get_default_config()
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                logger.info(f"配置文件加载成功: {self.config_path}")
                return config
        except Exception as e:
            logger.error(f"加载配置文件失败: {e}，使用默认配置")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认配置"""
        return {
            'selectors': {},
            'delays': {
                'operation_min': 0.5,
                'operation_max': 1.5,
                'product_min': 5,
                'product_max': 15,
                'page_load': 2,
                'page_load_max': 3,
            },
            'retry': {
                'max_attempts': 3,
                'retry_delay': 2,
                'selector_timeout': 10000,
                'page_load_timeout': 30000,
            },
            'screenshot': {
                'enabled': True,
                'save_dir': 'logs/screenshots',
                'on_failure': True,
                'on_success': False,
            },
            'anti_detection': {
                'user_agents': [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ],
                'enable_mouse_movement': True,
                'enable_page_scroll': True,
            },
            'captcha': {
                'enabled': True,
                'wait_timeout': 60,
            },
        }
    
    def _get_file_mtime(self) -> float:
        """获取文件修改时间"""
        try:
            if os.path.exists(self.config_path):
                return os.path.getmtime(self.config_path)
        except:
            pass
        return 0
    
    def reload_if_changed(self):
        """如果配置文件被修改，重新加载"""
        try:
            current_mtime = self._get_file_mtime()
            if current_mtime > self._last_modified:
                logger.info("检测到配置文件变化，重新加载...")
                self.config = self._load_config()
                self._last_modified = current_mtime
        except Exception as e:
            logger.error(f"重新加载配置失败: {e}")
    
    def get(self, *keys, default=None):
        """获取配置值
        
        Args:
            *keys: 配置键路径（支持多级）
            default: 默认值
            
        Returns:
            配置值
        """
        value = self.config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value


class XianyuProductPublisher:
    """闲鱼商品发布器"""
    
    # 闲鱼发布页面 URL
    PUBLISH_URL = "https://www.goofish.com/publish"
    
    def __init__(self, cookie_id: str, cookies_str: str, headless: bool = True, config_path: str = None):
        """初始化发布器
        
        Args:
            cookie_id: 账号ID
            cookies_str: Cookie 字符串
            headless: 是否无头模式
            config_path: 配置文件路径
        """
        # 确保 cookie_id 和 cookies_str 是字符串类型
        self.cookie_id = str(cookie_id) if cookie_id is not None else ""
        self.cookies_str = str(cookies_str) if cookies_str is not None else ""
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.playwright = None
        
        # 加载配置
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "product_publisher_config.yml")
        self.config = PublisherConfig(config_path)
        
        # 进度回调函数
        self.progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None
        
        # 截图计数器
        self.screenshot_counter = 0
    
    def set_progress_callback(self, callback: Callable[[str, Dict[str, Any]], None]):
        """设置进度回调函数
        
        Args:
            callback: 回调函数，接收事件名称和数据
        """
        self.progress_callback = callback
    
    def _emit_progress(self, event: str, data: Dict[str, Any]):
        """触发进度回调
        
        Args:
            event: 事件名称
            data: 事件数据
        """
        if self.progress_callback:
            try:
                self.progress_callback(event, data)
            except Exception as e:
                logger.warning(f"【{self.cookie_id}】进度回调执行失败: {e}")
    
    async def take_screenshot(self, filename: str = None, product_title: str = None) -> Optional[str]:
        """截图保存
        
        Args:
            filename: 文件名（可选）
            product_title: 商品标题（用于文件名）
            
        Returns:
            截图文件路径，失败返回 None
        """
        try:
            if not self.config.get('screenshot', 'enabled', default=True):
                return None
            
            # 确保截图目录存在
            screenshot_dir = self.config.get('screenshot', 'save_dir', default='logs/screenshots')
            os.makedirs(screenshot_dir, exist_ok=True)
            
            # 生成文件名
            if filename is None:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                self.screenshot_counter += 1
                
                # 清理商品标题用于文件名
                safe_title = ""
                if product_title:
                    safe_title = "".join(c for c in product_title if c.isalnum() or c in (' ', '-', '_'))[:30]
                    safe_title = f"_{safe_title}" if safe_title else ""
                
                filename = f"{self.cookie_id}_{timestamp}{safe_title}_{self.screenshot_counter}.png"
            
            filepath = os.path.join(screenshot_dir, filename)
            
            # 截图
            await self.page.screenshot(path=filepath, full_page=True)
            logger.info(f"【{self.cookie_id}】截图已保存: {filepath}")
            
            return filepath
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】截图失败: {e}")
            return None
    
    async def _find_element_with_fallback(self, selector_key: str, timeout: int = None) -> Optional[Any]:
        """使用备选选择器查找元素
        
        Args:
            selector_key: 选择器配置键
            timeout: 超时时间（毫秒）
            
        Returns:
            元素对象，未找到返回 None
        """
        if timeout is None:
            timeout = self.config.get('retry', 'selector_timeout', default=10000)
        
        # 获取选择器配置
        selector_config = self.config.get('selectors', selector_key, default={})
        if not selector_config:
            logger.warning(f"【{self.cookie_id}】选择器配置不存在: {selector_key}")
            return None
        
        # 尝试主选择器
        primary_selector = selector_config.get('primary')
        if primary_selector:
            try:
                if self.config.get('logging', 'log_selector_search', default=True):
                    logger.debug(f"【{self.cookie_id}】尝试主选择器: {primary_selector}")
                
                element = await self.page.wait_for_selector(primary_selector, timeout=timeout)
                if element:
                    logger.debug(f"【{self.cookie_id}】主选择器找到元素: {primary_selector}")
                    return element
            except PlaywrightTimeoutError:
                logger.debug(f"【{self.cookie_id}】主选择器超时: {primary_selector}")
            except Exception as e:
                logger.debug(f"【{self.cookie_id}】主选择器失败: {primary_selector}, 错误: {e}")
        
        # 尝试备选选择器
        fallback_selectors = selector_config.get('fallback', [])
        for i, fallback_selector in enumerate(fallback_selectors):
            try:
                if self.config.get('logging', 'log_selector_search', default=True):
                    logger.debug(f"【{self.cookie_id}】尝试备选选择器 {i+1}: {fallback_selector}")
                
                element = await self.page.wait_for_selector(fallback_selector, timeout=timeout)
                if element:
                    logger.info(f"【{self.cookie_id}】备选选择器 {i+1} 找到元素: {fallback_selector}")
                    return element
            except PlaywrightTimeoutError:
                logger.debug(f"【{self.cookie_id}】备选选择器 {i+1} 超时: {fallback_selector}")
            except Exception as e:
                logger.debug(f"【{self.cookie_id}】备选选择器 {i+1} 失败: {fallback_selector}, 错误: {e}")
        
        logger.warning(f"【{self.cookie_id}】所有选择器均未找到元素: {selector_key}")
        return None
    
    async def _simulate_mouse_movement(self, target_element=None):
        """模拟鼠标移动
        
        Args:
            target_element: 目标元素（可选）
        """
        if not self.config.get('anti_detection', 'enable_mouse_movement', default=True):
            return
        
        try:
            steps = random.randint(
                self.config.get('anti_detection', 'mouse_steps_min', default=10),
                self.config.get('anti_detection', 'mouse_steps_max', default=30)
            )
            
            if target_element:
                # 移动到目标元素
                await target_element.hover()
            else:
                # 随机移动
                x = random.randint(100, 800)
                y = random.randint(100, 600)
                await self.page.mouse.move(x, y, steps=steps)
            
            await asyncio.sleep(random.uniform(0.1, 0.3))
            
        except Exception as e:
            logger.debug(f"【{self.cookie_id}】鼠标移动模拟失败: {e}")
    
    async def _simulate_page_scroll(self):
        """模拟页面滚动"""
        if not self.config.get('anti_detection', 'enable_page_scroll', default=True):
            return
        
        try:
            scroll_times = random.randint(
                self.config.get('anti_detection', 'scroll_times_min', default=1),
                self.config.get('anti_detection', 'scroll_times_max', default=3)
            )
            
            for _ in range(scroll_times):
                # 随机滚动距离
                scroll_y = random.randint(100, 500)
                await self.page.evaluate(f"window.scrollBy(0, {scroll_y})")
                await asyncio.sleep(random.uniform(0.3, 0.8))
            
            # 滚回顶部
            await self.page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(random.uniform(0.2, 0.5))
            
        except Exception as e:
            logger.debug(f"【{self.cookie_id}】页面滚动模拟失败: {e}")
    
    async def _check_captcha(self) -> bool:
        """检测是否出现验证码
        
        Returns:
            是否检测到验证码
        """
        if not self.config.get('captcha', 'enabled', default=True):
            return False
        
        try:
            detection_selectors = self.config.get('captcha', 'detection_selectors', default=[])
            
            for selector in detection_selectors:
                try:
                    element = await self.page.query_selector(selector)
                    if element and await element.is_visible():
                        logger.warning(f"【{self.cookie_id}】检测到验证码: {selector}")
                        return True
                except:
                    pass
            
            return False
            
        except Exception as e:
            logger.debug(f"【{self.cookie_id}】验证码检测失败: {e}")
            return False
    
    async def _handle_captcha(self) -> bool:
        """处理验证码
        
        Returns:
            是否处理成功
        """
        try:
            logger.warning(f"【{self.cookie_id}】检测到验证码，等待处理...")
            self._emit_progress('captcha_detected', {'status': 'waiting'})
            
            # 截图
            await self.take_screenshot(product_title="captcha")
            
            # 如果启用自动处理
            if self.config.get('captcha', 'auto_handle', default=False):
                # TODO: 集成验证码服务
                logger.info(f"【{self.cookie_id}】自动验证码处理未实现")
                return False
            
            # 等待用户手动处理
            wait_timeout = self.config.get('captcha', 'wait_timeout', default=60)
            logger.info(f"【{self.cookie_id}】等待手动处理验证码（超时 {wait_timeout} 秒）...")
            
            start_time = time.time()
            while time.time() - start_time < wait_timeout:
                if not await self._check_captcha():
                    logger.info(f"【{self.cookie_id}】验证码已处理")
                    self._emit_progress('captcha_detected', {'status': 'solved'})
                    return True
                await asyncio.sleep(2)
            
            logger.error(f"【{self.cookie_id}】验证码处理超时")
            self._emit_progress('captcha_detected', {'status': 'timeout'})
            return False
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】验证码处理失败: {e}")
            return False
    
    async def _retry_with_backoff(self, func, max_attempts: int = None, *args, **kwargs):
        """带退避的重试机制
        
        Args:
            func: 要执行的异步函数
            max_attempts: 最大重试次数
            *args, **kwargs: 函数参数
            
        Returns:
            函数执行结果
        """
        if max_attempts is None:
            max_attempts = self.config.get('retry', 'max_attempts', default=3)
        
        # 确保 max_attempts 是整数类型
        max_attempts = int(max_attempts) if max_attempts is not None else 3
        
        retry_delay = self.config.get('retry', 'retry_delay', default=2)
        # 确保 retry_delay 是数值类型
        retry_delay = float(retry_delay) if retry_delay is not None else 2
        
        for attempt in range(1, max_attempts + 1):
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                if attempt < max_attempts:
                    wait_time = retry_delay * attempt  # 指数退避
                    logger.warning(f"【{self.cookie_id}】第 {attempt} 次尝试失败: {e}，{wait_time} 秒后重试...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"【{self.cookie_id}】重试 {max_attempts} 次后仍然失败: {e}")
                    raise
    
    async def _random_delay(self, min_key: str = 'operation_min', max_key: str = 'operation_max'):
        """随机延迟
        
        Args:
            min_key: 最小延迟配置键
            max_key: 最大延迟配置键
        """
        min_delay = self.config.get('delays', min_key, default=0.5)
        max_delay = self.config.get('delays', max_key, default=1.5)
        delay = random.uniform(min_delay, max_delay)
        await asyncio.sleep(delay)
    
    async def init_browser(self):
        """初始化浏览器"""
        try:
            logger.info(f"【{self.cookie_id}】初始化 Playwright 浏览器...")
            self._emit_progress('browser_init', {'status': 'starting'})
            
            self.playwright = await async_playwright().start()
            
            # 随机选择 User-Agent
            user_agent = random.choice(
                self.config.get('anti_detection', 'user_agents', 
                               default=['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'])
            )
            
            # 启动浏览器（使用反检测配置）
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                    '--log-level=3',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ]
            )
            
            # 创建浏览器上下文
            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent=user_agent
            )
            
            # 设置默认超时
            self.context.set_default_timeout(
                self.config.get('retry', 'page_load_timeout', default=30000)
            )
            
            # 创建页面
            self.page = await self.context.new_page()
            
            # 注入反检测脚本
            await self.page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['zh-CN', 'zh', 'en']
                });
            """)
            
            logger.info(f"【{self.cookie_id}】浏览器初始化成功")
            self._emit_progress('browser_init', {'status': 'success'})
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】浏览器初始化失败: {e}")
            self._emit_progress('browser_init', {'status': 'failed', 'error': str(e)})
            raise
    
    async def login_with_cookie(self):
        """使用 Cookie 登录"""
        try:
            # 强制确保 cookie_id 是字符串（防止在某些情况下被重新赋值为整数）
            self.cookie_id = str(self.cookie_id)
            
            logger.info(f"【{self.cookie_id}】开始 Cookie 登录... (cookie_id type: {type(self.cookie_id).__name__})")
            self._emit_progress('login', {'status': 'starting'})
            
            # 先访问咸鱼首页
            await self._retry_with_backoff(
                self.page.goto,
                url='https://www.goofish.com',
                wait_until='networkidle'
            )
            await self._random_delay()
            
            # 解析并注入 Cookie
            logger.info(f"【{self.cookie_id}】开始解析 Cookie... (cookies_str type: {type(self.cookies_str).__name__}, length: {len(self.cookies_str) if isinstance(self.cookies_str, str) else 'N/A'})")
            cookies = self._parse_cookies(self.cookies_str)
            logger.info(f"【{self.cookie_id}】Cookie 解析完成，共 {len(cookies)} 个")
            
            await self.context.add_cookies(cookies)
            
            logger.info(f"【{self.cookie_id}】Cookie 已注入，共 {len(cookies)} 个")
            
            # 刷新页面验证登录状态
            await self.page.reload(wait_until='networkidle')
            await self._random_delay()
            
            # 记录当前页面信息用于调试
            current_url = self.page.url
            page_title = await self.page.title()
            logger.info(f"【{self.cookie_id}】当前页面 URL: {current_url}")
            logger.info(f"【{self.cookie_id}】当前页面标题: {page_title}")
            
            # 检查是否登录成功（使用多种方式验证）
            login_success = False
            
            # 方式1: 检查页面 URL 是否包含登录后的特征
            if 'login' not in current_url.lower():
                logger.info(f"【{self.cookie_id}】URL 检查通过（未跳转到登录页）")
                login_success = True
            
            # 方式2: 尝试查找用户相关元素（多个选择器）
            user_selectors = [
                '.site-nav-user',           # 旧版淘宝
                '[data-spm="duser"]',       # 可能的用户元素
                '.user-nick',               # 用户昵称
                '.login-info',              # 登录信息
                'a[href*="member"]',        # 会员链接
            ]
            
            for selector in user_selectors:
                try:
                    await self.page.wait_for_selector(selector, timeout=2000)
                    logger.info(f"【{self.cookie_id}】找到用户元素: {selector}")
                    login_success = True
                    break
                except:
                    continue
            
            # 方式3: 检查页面内容是否包含登录后的关键词
            try:
                page_content = await self.page.content()
                if any(keyword in page_content for keyword in ['退出登录', '我的咸鱼', '个人中心', '我的订单']):
                    logger.info(f"【{self.cookie_id}】页面内容检查通过（包含登录后关键词）")
                    login_success = True
            except:
                pass
            
            if login_success:
                logger.info(f"【{self.cookie_id}】Cookie 登录成功")
                self._emit_progress('login', {'status': 'success'})
                return True
            else:
                logger.warning(f"【{self.cookie_id}】Cookie 登录可能失败，继续尝试...")
                self._emit_progress('login', {'status': 'uncertain'})
                # 保存页面 HTML 用于调试
                try:
                    html_content = await self.page.content()
                    debug_file = f"logs/debug_login_{self.cookie_id}.html"
                    with open(debug_file, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    logger.info(f"【{self.cookie_id}】页面 HTML 已保存到: {debug_file}")
                except:
                    pass
                return False
                
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"【{self.cookie_id}】Cookie 登录失败: {e}")
            logger.error(f"【{self.cookie_id}】完整错误堆栈:\n{error_traceback}")
            self._emit_progress('login', {'status': 'failed', 'error': str(e)})
            await self.take_screenshot(product_title="login_failed")
            return False
    
    def _parse_cookies(self, cookies_str: str) -> List[Dict[str, Any]]:
        """解析 Cookie 字符串
        
        Args:
            cookies_str: Cookie 字符串（格式：key1=value1; key2=value2）
            
        Returns:
            Playwright 格式的 Cookie 列表
        """
        # 确保 cookies_str 是字符串类型
        if not isinstance(cookies_str, str):
            cookies_str = str(cookies_str)
        
        cookies = []
        for item in cookies_str.split(';'):
            item = item.strip()
            if '=' in item:
                key, value = item.split('=', 1)
                # 同时添加 goofish.com 和 taobao.com 域名的 Cookie（兼容旧系统）
                for domain in ['.goofish.com', '.taobao.com']:
                    cookies.append({
                        'name': key.strip(),
                        'value': value.strip(),
                        'domain': domain,
                        'path': '/'
                    })
        return cookies
    
    async def publish_product(self, product: ProductInfo) -> Tuple[bool, Optional[str], Optional[str]]:
        """发布单个商品
        
        Args:
            product: 商品信息
            
        Returns:
            (是否发布成功, 商品ID, 商品URL)
        """
        try:
            logger.info(f"【{self.cookie_id}】开始发布商品: {product.title}")
            self._emit_progress('publish_start', {'title': product.title})
            
            # 重新加载配置（支持热加载）
            self.config.reload_if_changed()
            
            # 访问发布页面
            await self._retry_with_backoff(
                self.page.goto,
                url=self.PUBLISH_URL,
                wait_until='networkidle'
            )
            await asyncio.sleep(random.uniform(
                self.config.get('delays', 'page_load', default=2),
                self.config.get('delays', 'page_load_max', default=3)
            ))
            
            # 检查验证码
            if await self._check_captcha():
                if not await self._handle_captcha():
                    await self.take_screenshot(product_title=f"{product.title}_captcha_failed")
                    return (False, None, None)
            
            # 模拟人类行为
            await self._simulate_page_scroll()
            
            # 上传图片
            self._emit_progress('upload_images', {'status': 'starting', 'count': len(product.images)})
            if not await self._upload_images(product.images):
                logger.error(f"【{self.cookie_id}】图片上传失败")
                await self.take_screenshot(product_title=f"{product.title}_upload_failed")
                return (False, None, None)
            self._emit_progress('upload_images', {'status': 'success'})
            
            # 填写商品信息
            self._emit_progress('fill_info', {'status': 'starting'})
            if not await self._fill_product_info(product):
                logger.error(f"【{self.cookie_id}】商品信息填写失败")
                await self.take_screenshot(product_title=f"{product.title}_fill_failed")
                return (False, None, None)
            self._emit_progress('fill_info', {'status': 'success'})
            
            # 选择分类（如果提供）
            if product.category:
                if not await self._select_category(product.category):
                    logger.warning(f"【{self.cookie_id}】分类选择失败，继续...")
            
            # 设置位置（如果提供）
            if product.location:
                if not await self._set_location(product.location):
                    logger.warning(f"【{self.cookie_id}】位置设置失败，继续...")
            
            # 点击发布按钮
            self._emit_progress('publishing', {'status': 'clicking'})
            if not await self._click_publish():
                logger.error(f"【{self.cookie_id}】发布按钮点击失败")
                await self.take_screenshot(product_title=f"{product.title}_click_failed")
                return (False, None, None)
            
            # 验证发布成功
            success, product_id, product_url = await self._verify_publish_success()
            
            if success:
                logger.info(f"【{self.cookie_id}】商品发布成功: {product.title}, ID: {product_id}")
                self._emit_progress('publish_complete', {
                    'status': 'success',
                    'title': product.title,
                    'product_id': product_id,
                    'product_url': product_url
                })
                
                # 成功时截图（如果配置启用）
                if self.config.get('screenshot', 'on_success', default=False):
                    await self.take_screenshot(product_title=f"{product.title}_success")
                
                return (True, product_id, product_url)
            else:
                logger.error(f"【{self.cookie_id}】商品发布失败: {product.title}")
                await self.take_screenshot(product_title=f"{product.title}_verify_failed")
                self._emit_progress('publish_complete', {'status': 'failed', 'title': product.title})
                return (False, None, None)
                
        except Exception as e:
            logger.error(f"【{self.cookie_id}】发布商品异常: {e}")
            await self.take_screenshot(product_title=f"{product.title}_exception")
            self._emit_progress('publish_complete', {'status': 'error', 'title': product.title, 'error': str(e)})
            return (False, None, None)
    
    async def _upload_images(self, image_paths: List[str]) -> bool:
        """上传商品图片
        
        Args:
            image_paths: 图片路径列表
            
        Returns:
            是否上传成功
        """
        try:
            logger.info(f"【{self.cookie_id}】开始上传 {len(image_paths)} 张图片...")
            
            # 【修复】批量上传图片，跟踪成功和失败的图片
            uploaded_count = 0
            uploaded_images = []
            failed_images = []
            
            for i, img_path in enumerate(image_paths):
                if not os.path.exists(img_path):
                    logger.warning(f"【{self.cookie_id}】图片不存在: {img_path}")
                    failed_images.append(img_path)
                    continue
                
                try:
                    # 方法1: 尝试查找隐藏的 file input 并直接上传
                    upload_input = await self._find_element_with_fallback('image_upload_input', timeout=2000)
                    if upload_input:
                        logger.debug(f"【{self.cookie_id}】找到隐藏的 file input，直接上传")
                        await upload_input.set_input_files(os.path.abspath(img_path))
                        uploaded_count += 1
                        uploaded_images.append(img_path)
                        logger.info(f"【{self.cookie_id}】已上传第 {uploaded_count}/{len(image_paths)} 张图片")
                    else:
                        # 方法2: 使用 JavaScript 查找 input 并触发
                        logger.debug(f"【{self.cookie_id}】未找到 file input，尝试 JavaScript 方式")
                        
                        # 使用 JavaScript 查找所有 input[type="file"] 元素
                        file_inputs = await self.page.query_selector_all('input[type="file"]')
                        if file_inputs:
                            logger.debug(f"【{self.cookie_id}】找到 {len(file_inputs)} 个 file input 元素")
                            # 使用第一个 file input
                            await file_inputs[0].set_input_files(os.path.abspath(img_path))
                            uploaded_count += 1
                            uploaded_images.append(img_path)
                            logger.info(f"【{self.cookie_id}】已上传第 {uploaded_count}/{len(image_paths)} 张图片")
                        else:
                            logger.error(f"【{self.cookie_id}】未找到任何 file input 元素")
                            failed_images.append(img_path)
                    
                    self._emit_progress('upload_images', {
                        'status': 'uploading',
                        'current': uploaded_count,
                        'total': len(image_paths)
                    })
                    
                    # 随机延迟
                    await asyncio.sleep(random.uniform(
                        self.config.get('delays', 'image_upload_min', default=0.5),
                        self.config.get('delays', 'image_upload_max', default=1.5)
                    ))
                except Exception as e:
                    logger.error(f"【{self.cookie_id}】上传图片失败 {img_path}: {e}")
                    import traceback
                    logger.error(f"【{self.cookie_id}】错误堆栈:\n{traceback.format_exc()}")
                    failed_images.append(img_path)
                    # 继续上传其他图片
            
            # 【修复】检查失败图片比例
            if failed_images:
                failure_rate = len(failed_images) / len(image_paths)
                logger.warning(f"【{self.cookie_id}】以下图片上传失败: {failed_images}")
                logger.warning(f"【{self.cookie_id}】失败率: {failure_rate*100:.1f}% ({len(failed_images)}/{len(image_paths)})")
                
                # 如果失败图片超过30%，终止发布
                if failure_rate > 0.3:
                    logger.error(f"【{self.cookie_id}】图片上传失败率过高 ({failure_rate*100:.1f}%)，终止发布")
                    return False
            
            if uploaded_count == 0:
                logger.error(f"【{self.cookie_id}】没有成功上传任何图片")
                return False
            
            # 等待图片上传完成
            await asyncio.sleep(random.uniform(
                self.config.get('delays', 'image_upload_complete_min', default=2),
                self.config.get('delays', 'image_upload_complete_max', default=3)
            ))
            
            logger.info(f"【{self.cookie_id}】图片上传完成，成功 {uploaded_count}/{len(image_paths)} 张")
            return uploaded_count > 0
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】图片上传失败: {e}")
            return False
    
    async def _fill_product_info(self, product: ProductInfo) -> bool:
        """填写商品信息
        
        Args:
            product: 商品信息
            
        Returns:
            是否填写成功
        """
        try:
            logger.info(f"【{self.cookie_id}】开始填写商品信息...")
            
            # 填写描述（可能是 contenteditable 元素）
            desc_element = await self._find_element_with_fallback('description_textarea')
            if desc_element:
                await self._simulate_mouse_movement(desc_element)
                
                # 尝试使用 fill 方法
                try:
                    await desc_element.fill(product.description)
                except Exception as e:
                    # 如果 fill 失败，尝试使用 JavaScript 设置内容
                    logger.debug(f"【{self.cookie_id}】fill 方法失败，尝试 JavaScript: {e}")
                    await desc_element.click()
                    await self.page.evaluate(f"""
                        (element) => {{
                            element.textContent = {repr(product.description)};
                            element.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        }}
                    """, desc_element)
                
                await self._random_delay()
                logger.debug(f"【{self.cookie_id}】描述已填写")
            else:
                logger.error(f"【{self.cookie_id}】未找到描述输入框")
                return False
            
            # 填写价格
            price_input = await self._find_element_with_fallback('price_input')
            if price_input:
                await self._simulate_mouse_movement(price_input)
                await price_input.click()
                await price_input.fill('')  # 先清空
                await price_input.fill(str(product.price))
                await self._random_delay()
                logger.debug(f"【{self.cookie_id}】价格已填写")
            else:
                logger.error(f"【{self.cookie_id}】未找到价格输入框")
                return False
            
            # 填写原价（如果提供）
            if product.original_price:
                original_price_input = await self._find_element_with_fallback('original_price_input')
                if original_price_input:
                    await self._simulate_mouse_movement(original_price_input)
                    await original_price_input.click()
                    await original_price_input.fill('')  # 先清空
                    await original_price_input.fill(str(product.original_price))
                    await self._random_delay()
                    logger.debug(f"【{self.cookie_id}】原价已填写")
            
            logger.info(f"【{self.cookie_id}】商品信息填写完成")
            return True
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】商品信息填写失败: {e}")
            import traceback
            logger.error(f"【{self.cookie_id}】错误堆栈:\n{traceback.format_exc()}")
            return False
    
    async def _select_category(self, category_path: str) -> bool:
        """选择商品分类
        
        Args:
            category_path: 分类路径（如：数码产品/手机/苹果）
            
        Returns:
            是否选择成功
        """
        try:
            logger.info(f"【{self.cookie_id}】开始选择分类: {category_path}")
            
            categories = category_path.split('/')
            
            # 点击分类选择器
            category_btn = await self._find_element_with_fallback('category_selector')
            if not category_btn:
                logger.error(f"【{self.cookie_id}】未找到分类选择器")
                return False
            
            await self._simulate_mouse_movement(category_btn)
            await category_btn.click()
            await self._random_delay()
            
            # 逐级选择分类
            for i, category in enumerate(categories):
                try:
                    # 尝试多种选择器
                    category_item = None
                    selectors = [
                        f'text="{category}"',
                        f'[data-category="{category}"]',
                        f'.category-item:has-text("{category}")'
                    ]
                    
                    for selector in selectors:
                        try:
                            category_item = await self.page.wait_for_selector(selector, timeout=5000)
                            if category_item:
                                break
                        except:
                            continue
                    
                    if not category_item:
                        logger.warning(f"【{self.cookie_id}】未找到分类: {category}")
                        return False
                    
                    await self._simulate_mouse_movement(category_item)
                    await category_item.click()
                    await self._random_delay()
                    logger.info(f"【{self.cookie_id}】已选择第 {i+1} 级分类: {category}")
                    
                except Exception as e:
                    logger.warning(f"【{self.cookie_id}】分类选择失败: {category}, 错误: {e}")
                    return False
            
            logger.info(f"【{self.cookie_id}】分类选择完成")
            return True
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】分类选择失败: {e}")
            return False
    
    async def _set_location(self, location: str) -> bool:
        """设置发货地
        
        Args:
            location: 位置（如：北京市/朝阳区）
            
        Returns:
            是否设置成功
        """
        try:
            logger.info(f"【{self.cookie_id}】开始设置位置: {location}")
            
            # 点击位置选择器
            location_btn = await self._find_element_with_fallback('location_selector')
            if not location_btn:
                logger.error(f"【{self.cookie_id}】未找到位置选择器")
                return False
            
            await self._simulate_mouse_movement(location_btn)
            await location_btn.click()
            await self._random_delay()
            
            # 输入位置
            location_input = await self._find_element_with_fallback('location_input')
            if not location_input:
                logger.error(f"【{self.cookie_id}】未找到位置输入框")
                return False
            
            await self._simulate_mouse_movement(location_input)
            await location_input.fill(location)
            await self._random_delay()
            
            # 选择第一个匹配项
            first_result = await self._find_element_with_fallback('location_result_item')
            if not first_result:
                logger.warning(f"【{self.cookie_id}】未找到位置匹配结果")
                return False
            
            await self._simulate_mouse_movement(first_result)
            await first_result.click()
            await self._random_delay()
            
            logger.info(f"【{self.cookie_id}】位置设置完成")
            return True
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】位置设置失败: {e}")
            return False
    
    async def _click_publish(self) -> bool:
        """点击发布按钮
        
        Returns:
            是否点击成功
        """
        try:
            logger.info(f"【{self.cookie_id}】点击发布按钮...")
            
            # 查找发布按钮
            publish_btn = await self._find_element_with_fallback('publish_button')
            if not publish_btn:
                logger.error(f"【{self.cookie_id}】未找到发布按钮")
                return False
            
            # 模拟鼠标移动到按钮
            await self._simulate_mouse_movement(publish_btn)
            
            # 点击发布
            await publish_btn.click()
            await asyncio.sleep(random.uniform(2, 3))
            
            logger.info(f"【{self.cookie_id}】发布按钮已点击")
            return True
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】发布按钮点击失败: {e}")
            return False
    
    async def _verify_publish_success(self) -> Tuple[bool, Optional[str], Optional[str]]:
        """验证发布是否成功
        
        Returns:
            (是否发布成功, 商品ID, 商品URL)
        """
        try:
            logger.info(f"【{self.cookie_id}】验证发布结果...")
            
            # 等待页面加载（给页面跳转一些时间）
            await asyncio.sleep(2)
            
            # 方法1: 检查当前 URL 是否包含商品详情页特征
            current_url = self.page.url
            logger.info(f"【{self.cookie_id}】当前 URL: {current_url}")
            
            # 提取商品 ID
            product_id = None
            product_url = None
            
            # 从 URL 中提取商品 ID
            # 闲鱼商品详情页 URL 格式: https://www.goofish.com/item.htm?id=123456789
            import re
            id_match = re.search(r'[?&]id=(\d+)', current_url)
            if id_match:
                product_id = id_match.group(1)
                product_url = current_url
                logger.info(f"【{self.cookie_id}】提取到商品 ID: {product_id}")
            
            # 闲鱼商品详情页的 URL 特征
            success_url_patterns = [
                'item.htm',           # 标准商品详情页
                '/item/',             # 可能的路径格式
                'id=',                # URL 参数中包含商品 ID
                'goofish.com/item',   # 完整域名格式
            ]
            
            for pattern in success_url_patterns:
                if pattern in current_url:
                    logger.info(f"【{self.cookie_id}】URL 匹配成功模式: {pattern}")
                    return (True, product_id, product_url)
            
            # 方法2: 检查页面标题是否包含商品相关关键词
            try:
                page_title = await self.page.title()
                logger.info(f"【{self.cookie_id}】页面标题: {page_title}")
                
                # 商品详情页标题通常包含这些关键词
                title_keywords = ['闲鱼', '咸鱼', '商品', '宝贝', 'goofish']
                if any(keyword in page_title for keyword in title_keywords):
                    logger.info(f"【{self.cookie_id}】页面标题包含商品关键词")
                    return (True, product_id, product_url)
            except Exception as e:
                logger.debug(f"【{self.cookie_id}】获取页面标题失败: {e}")
            
            # 方法3: 检查页面是否包含商品详情页的特征元素
            detail_page_selectors = [
                '.item-info',              # 商品信息区域
                '.product-info',           # 商品信息
                '[class*="item"]',         # 包含 item 的类名
                '[class*="product"]',      # 包含 product 的类名
                'img[alt*="商品"]',        # 商品图片
            ]
            
            for selector in detail_page_selectors:
                try:
                    element = await self.page.query_selector(selector)
                    if element and await element.is_visible():
                        logger.info(f"【{self.cookie_id}】找到商品详情页特征元素: {selector}")
                        return (True, product_id, product_url)
                except Exception as e:
                    logger.debug(f"【{self.cookie_id}】检查元素失败 {selector}: {e}")
            
            # 方法4: 检查是否有成功提示（短暂的 toast）
            success_msg = await self._find_element_with_fallback('success_message', timeout=3000)
            if success_msg:
                logger.info(f"【{self.cookie_id}】发布成功提示已显示")
                return (True, product_id, product_url)
            
            # 方法5: 检查 URL 是否不再是发布页面
            if self.PUBLISH_URL not in current_url and 'publish' not in current_url:
                logger.info(f"【{self.cookie_id}】已离开发布页面，推测发布成功")
                return (True, product_id, product_url)
            
            logger.warning(f"【{self.cookie_id}】无法验证发布是否成功，当前 URL: {current_url}")
            return (False, None, None)
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】验证发布结果失败: {e}")
            import traceback
            logger.error(f"【{self.cookie_id}】错误堆栈:\n{traceback.format_exc()}")
            return (False, None, None)
    
    async def batch_publish(self, products: List[ProductInfo]) -> Dict[str, Any]:
        """批量发布商品
        
        Args:
            products: 商品列表
            
        Returns:
            发布结果统计
        """
        results = {
            'total': len(products),
            'success': 0,
            'failed': 0,
            'details': []
        }
        
        try:
            # 初始化浏览器
            await self.init_browser()
            
            # Cookie 登录
            if not await self.login_with_cookie():
                logger.error(f"【{self.cookie_id}】Cookie 登录失败，终止批量发布")
                return results
            
            # 逐个发布商品
            for i, product in enumerate(products):
                logger.info(f"【{self.cookie_id}】发布进度: {i+1}/{len(products)}")
                self._emit_progress('batch_progress', {
                    'current': i + 1,
                    'total': len(products),
                    'product': product.title
                })
                
                success = await self.publish_product(product)
                
                if success:
                    results['success'] += 1
                    results['details'].append({
                        'title': product.title,
                        'status': 'success'
                    })
                else:
                    results['failed'] += 1
                    results['details'].append({
                        'title': product.title,
                        'status': 'failed'
                    })
                
                # 商品间随机延迟（防检测）
                if i < len(products) - 1:
                    delay = random.uniform(
                        self.config.get('delays', 'product_min', default=5),
                        self.config.get('delays', 'product_max', default=15)
                    )
                    logger.info(f"【{self.cookie_id}】等待 {delay:.1f} 秒后发布下一个商品...")
                    await asyncio.sleep(delay)
            
            logger.info(f"【{self.cookie_id}】批量发布完成: 成功 {results['success']}/{results['total']}")
            self._emit_progress('batch_complete', results)
            
        except Exception as e:
            logger.error(f"【{self.cookie_id}】批量发布异常: {e}")
            await self.take_screenshot(product_title="batch_exception")
        
        finally:
            # 关闭浏览器
            await self.close()
        
        return results
    
    async def close(self):
        """关闭浏览器"""
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
            logger.info(f"【{self.cookie_id}】浏览器已关闭")
        except Exception as e:
            logger.error(f"【{self.cookie_id}】关闭浏览器失败: {e}")


# 便捷函数
async def publish_products(
    cookie_id: str,
    cookies_str: str,
    products: List[ProductInfo],
    headless: bool = True
) -> Dict[str, Any]:
    """发布商品的便捷函数
    
    Args:
        cookie_id: 账号ID
        cookies_str: Cookie 字符串
        products: 商品列表
        headless: 是否无头模式
        
    Returns:
        发布结果统计
    """
    publisher = XianyuProductPublisher(cookie_id, cookies_str, headless)
    return await publisher.batch_publish(products)
