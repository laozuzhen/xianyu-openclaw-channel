"""
闲鱼订单详情获取工具
基于Playwright实现订单详情页面访问和数据提取
"""

import asyncio
import time
import sys
import os
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from loguru import logger
import re
import json
from threading import Lock
from collections import defaultdict

# 修复Docker环境中的asyncio事件循环策略问题
if sys.platform.startswith('linux') or os.getenv('DOCKER_ENV'):
    try:
        # 在Linux/Docker环境中设置事件循环策略
        asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
    except Exception as e:
        logger.warning(f"设置事件循环策略失败: {e}")

# 确保在Docker环境中使用正确的事件循环
if os.getenv('DOCKER_ENV'):
    try:
        # 强制使用SelectorEventLoop（在Docker中更稳定）
        if hasattr(asyncio, 'SelectorEventLoop'):
            loop = asyncio.SelectorEventLoop()
            asyncio.set_event_loop(loop)
    except Exception as e:
        logger.warning(f"设置SelectorEventLoop失败: {e}")


class OrderDetailFetcher:
    """闲鱼订单详情获取器"""

    # 类级别的锁字典，为每个order_id维护一个锁
    _order_locks = defaultdict(lambda: asyncio.Lock())

    def __init__(self, cookie_string: str = None, headless: bool = True):
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.headless = headless  # 保存headless设置

        # 请求头配置
        self.headers = {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "en,zh-CN;q=0.9,zh;q=0.8,ru;q=0.7",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "priority": "u=0, i",
            "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1"
        }

        # Cookie配置 - 支持动态传入
        self.cookie = cookie_string

    async def init_browser(self, headless: bool = None):
        """初始化浏览器"""
        try:
            # 如果没有传入headless参数，使用实例的设置
            if headless is None:
                headless = self.headless

            logger.info(f"开始初始化浏览器，headless模式: {headless}")

            playwright = await async_playwright().start()

            # 启动浏览器（Docker环境优化）
            browser_args = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-pings'
            ]

            # 移除--single-process参数，使用多进程模式提高稳定性
            # if os.getenv('DOCKER_ENV'):
            #     browser_args.append('--single-process')  # 注释掉，避免崩溃

            # 在Docker环境中添加额外参数
            if os.getenv('DOCKER_ENV'):
                browser_args.extend([
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-client-side-phishing-detection',
                    '--disable-default-apps',
                    '--disable-hang-monitor',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-sync',
                    '--disable-web-resources',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update',
                    '--enable-automation',
                    '--password-store=basic',
                    '--use-mock-keychain',
                    # 添加内存优化和稳定性参数
                    '--memory-pressure-off',
                    '--max_old_space_size=512',
                    '--disable-ipc-flooding-protection',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                    '--disable-logging',
                    '--disable-permissions-api',
                    '--disable-notifications',
                    '--no-pings',
                    '--no-zygote'
                ])

            logger.info(f"启动浏览器，参数: {browser_args}")
            self.browser = await playwright.chromium.launch(
                headless=headless,
                args=browser_args
            )

            logger.info("浏览器启动成功，创建上下文...")

            # 创建浏览器上下文
            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
            )

            logger.info("浏览器上下文创建成功，设置HTTP头...")

            # 设置额外的HTTP头
            await self.context.set_extra_http_headers(self.headers)

            logger.info("创建页面...")

            # 创建页面
            self.page = await self.context.new_page()

            logger.info("页面创建成功，设置Cookie...")

            # 设置Cookie
            await self._set_cookies()

            # 等待一段时间确保浏览器完全初始化
            await asyncio.sleep(1)

            logger.info("浏览器初始化成功")
            return True
            
        except Exception as e:
            logger.error(f"浏览器初始化失败: {e}")
            return False

    async def _set_cookies(self):
        """设置Cookie"""
        try:
            # 解析Cookie字符串
            cookies = []
            for cookie_pair in self.cookie.split('; '):
                if '=' in cookie_pair:
                    name, value = cookie_pair.split('=', 1)
                    cookies.append({
                        'name': name.strip(),
                        'value': value.strip(),
                        'domain': '.goofish.com',
                        'path': '/'
                    })
            
            # 添加Cookie到上下文
            await self.context.add_cookies(cookies)
            logger.info(f"已设置 {len(cookies)} 个Cookie")
            
        except Exception as e:
            logger.error(f"设置Cookie失败: {e}")

    async def fetch_order_detail(self, order_id: str, timeout: int = 30) -> Optional[Dict[str, Any]]:
        """
        获取订单详情（带锁机制和数据库缓存）

        Args:
            order_id: 订单ID
            timeout: 超时时间（秒）

        Returns:
            包含订单详情的字典，失败时返回None
        """
        # 获取该订单ID的锁
        order_lock = self._order_locks[order_id]

        async with order_lock:
            logger.info(f"🔒 获取订单 {order_id} 的锁，开始处理...")

            try:
                # 首先查询数据库中是否已存在该订单（在初始化浏览器之前）
                from db_manager import db_manager
                existing_order = db_manager.get_order_by_id(order_id)

                if existing_order:
                    # 检查金额字段是否有效（不为空且不为0）
                    amount = existing_order.get('amount', '')
                    amount_valid = False

                    if amount:
                        # 移除可能的货币符号和空格，检查是否为有效数字
                        amount_clean = str(amount).replace('¥', '').replace('￥', '').replace('$', '').strip()
                        try:
                            amount_value = float(amount_clean)
                            amount_valid = amount_value > 0
                        except (ValueError, TypeError):
                            amount_valid = False

                    # 获取收货人信息（不作为判断是否刷新的条件，但刷新时如果有新信息会更新）
                    receiver_name = existing_order.get('receiver_name', '')
                    receiver_phone = existing_order.get('receiver_phone', '')
                    receiver_address = existing_order.get('receiver_address', '')

                    # 只有金额有效时才使用缓存（不再检查收货人信息是否完整）
                    if amount_valid:
                        logger.info(f"[CLIPBOARD] 订单 {order_id} 已存在于数据库中且金额有效({amount})，直接返回缓存数据")
                        print(f"[OK] 订单 {order_id} 使用缓存数据，跳过浏览器获取")

                        # 构建返回格式，与浏览器获取的格式保持一致
                        result = {
                            'order_id': existing_order['order_id'],
                            'url': f"https://www.goofish.com/order-detail?orderId={order_id}&role=seller",
                            'title': f"订单详情 - {order_id}",
                            'sku_info': {
                                'spec_name': existing_order.get('spec_name', ''),
                                'spec_value': existing_order.get('spec_value', ''),
                                'quantity': existing_order.get('quantity', ''),
                                'amount': existing_order.get('amount', ''),
                                'order_time': existing_order.get('created_at', ''),
                                'receiver_name': receiver_name,
                                'receiver_phone': receiver_phone,
                                'receiver_address': receiver_address,
                            },
                            'spec_name': existing_order.get('spec_name', ''),
                            'spec_value': existing_order.get('spec_value', ''),
                            'quantity': existing_order.get('quantity', ''),
                            'amount': existing_order.get('amount', ''),
                            'order_time': existing_order.get('created_at', ''),
                            'receiver_name': receiver_name,
                            'receiver_phone': receiver_phone,
                            'receiver_address': receiver_address,
                            'timestamp': time.time(),
                            'from_cache': True  # 标记数据来源
                        }
                        return result
                    else:
                        if not amount_valid:
                            logger.info(f"[CLIPBOARD] 订单 {order_id} 存在于数据库中但金额无效({amount})，需要重新获取")
                            print(f"[WARNING]️ 订单 {order_id} 金额无效，重新获取详情...")

                # 只有在数据库中没有有效数据时才初始化浏览器
                logger.info(f"🌐 订单 {order_id} 需要浏览器获取，开始初始化浏览器...")
                print(f"[SEARCH] 订单 {order_id} 开始浏览器获取详情...")

                # 确保浏览器准备就绪
                if not await self._ensure_browser_ready():
                    logger.error("浏览器初始化失败，无法获取订单详情")
                    return None

                # 构建订单详情URL
                url = f"https://www.goofish.com/order-detail?orderId={order_id}&role=seller"
                logger.info(f"开始访问订单详情页面: {url}")

                # 访问页面（带重试机制）
                max_retries = 2
                response = None

                for retry in range(max_retries + 1):
                    try:
                        response = await self.page.goto(url, wait_until='networkidle', timeout=timeout * 1000)

                        if response and response.status == 200:
                            break
                        else:
                            logger.warning(f"页面访问失败，状态码: {response.status if response else 'None'}，重试 {retry + 1}/{max_retries + 1}")

                    except Exception as e:
                        logger.warning(f"页面访问异常: {e}，重试 {retry + 1}/{max_retries + 1}")

                        # 如果是浏览器连接问题，尝试重新初始化
                        if "Target page, context or browser has been closed" in str(e):
                            logger.info("检测到浏览器连接断开，尝试重新初始化...")
                            if await self._ensure_browser_ready():
                                logger.info("浏览器重新初始化成功，继续重试...")
                                continue
                            else:
                                logger.error("浏览器重新初始化失败")
                                return None

                        if retry == max_retries:
                            logger.error(f"页面访问最终失败: {e}")
                            return None

                        await asyncio.sleep(1)  # 重试前等待1秒

                if not response or response.status != 200:
                    logger.error(f"页面访问最终失败，状态码: {response.status if response else 'None'}")
                    return None

                logger.info("页面加载成功，等待内容渲染...")

                # 等待页面完全加载
                try:
                    await self.page.wait_for_load_state('networkidle')
                except Exception as e:
                    logger.warning(f"等待页面加载状态失败: {e}")
                    # 继续执行，不中断流程

                # 等待收货地址元素出现（最多等待10秒）
                try:
                    logger.info("等待收货地址元素加载...")
                    await self.page.wait_for_selector('text=/收货地址/', timeout=10000)
                    logger.info("收货地址元素已加载")
                    # 收货地址加载后，再等待1秒确保完全渲染
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.warning(f"等待收货地址元素失败，使用默认等待时间: {e}")
                    # 如果收货地址元素未出现，使用默认等待时间
                    await asyncio.sleep(3)

                # 获取并解析SKU信息
                sku_info = await self._get_sku_content()

                # 获取页面标题
                try:
                    title = await self.page.title()
                except Exception as e:
                    logger.warning(f"获取页面标题失败: {e}")
                    title = f"订单详情 - {order_id}"

                result = {
                    'order_id': order_id,
                    'url': url,
                    'title': title,
                    'order_status': sku_info.get('order_status', 'unknown') if sku_info else 'unknown',  # 订单状态
                    'sku_info': sku_info,  # 包含解析后的规格信息
                    'spec_name': sku_info.get('spec_name', '') if sku_info else '',
                    'spec_value': sku_info.get('spec_value', '') if sku_info else '',
                    'quantity': sku_info.get('quantity', '') if sku_info else '',  # 数量
                    'amount': sku_info.get('amount', '') if sku_info else '',      # 金额
                    'order_time': sku_info.get('order_time', '') if sku_info else '',  # 订单时间
                    'receiver_name': sku_info.get('receiver_name', '') if sku_info else '',  # 收货人姓名
                    'receiver_phone': sku_info.get('receiver_phone', '') if sku_info else '',  # 收货人电话
                    'receiver_address': sku_info.get('receiver_address', '') if sku_info else '',  # 收货地址
                    'timestamp': time.time(),
                    'from_cache': False  # 标记数据来源
                }

                logger.info(f"订单详情获取成功: {order_id}")
                if sku_info:
                    logger.info(f"规格信息 - 名称: {result['spec_name']}, 值: {result['spec_value']}")
                    logger.info(f"数量: {result['quantity']}, 金额: {result['amount']}")
                    logger.info(f"收货人: {result['receiver_name']}, 电话: {result['receiver_phone']}")
                    logger.info(f"[ORDER_STATUS_DETECTED] 浏览器检测到的订单状态: {result['order_status']}")
                else:
                    logger.warning("[ORDER_STATUS_DETECTED] sku_info 为空，无法获取订单状态")
                return result

            except Exception as e:
                logger.error(f"获取订单详情失败: {e}")
                return None

    def _parse_sku_content(self, sku_content: str) -> Dict[str, str]:
        """
        解析SKU内容，根据冒号分割规格名称和规格值

        Args:
            sku_content: 原始SKU内容字符串

        Returns:
            包含规格名称和规格值的字典，如果解析失败则返回空字典
        """
        try:
            if not sku_content or ':' not in sku_content:
                logger.warning(f"SKU内容格式无效或不包含冒号: {sku_content}")
                return {}

            # 根据冒号分割
            parts = sku_content.split(':', 1)  # 只分割第一个冒号

            if len(parts) == 2:
                spec_name = parts[0].strip()
                spec_value = parts[1].strip()

                if spec_name and spec_value:
                    result = {
                        'spec_name': spec_name,
                        'spec_value': spec_value
                    }
                    logger.info(f"SKU解析成功 - 规格名称: {spec_name}, 规格值: {spec_value}")
                    return result
                else:
                    logger.warning(f"SKU解析失败，规格名称或值为空: 名称='{spec_name}', 值='{spec_value}'")
                    return {}
            else:
                logger.warning(f"SKU内容分割失败: {sku_content}")
                return {}

        except Exception as e:
            logger.error(f"解析SKU内容异常: {e}")
            return {}

    async def _get_sku_content(self) -> Optional[Dict[str, str]]:
        """获取并解析SKU内容，包括规格、数量、金额、收货信息和订单时间"""
        try:
            # 检查浏览器状态
            if not await self._check_browser_status():
                logger.error("浏览器状态异常，无法获取SKU内容")
                return {}

            result = {}

            # 获取所有 sku--u_ddZval 元素
            sku_selector = '.sku--u_ddZval'
            sku_elements = await self.page.query_selector_all(sku_selector)

            logger.info(f"找到 {len(sku_elements)} 个 sku--u_ddZval 元素")
            print(f"[SEARCH] 找到 {len(sku_elements)} 个 sku--u_ddZval 元素")

            # 获取金额信息
            amount_selector = '.boldNum--JgEOXfA3'
            amount_element = await self.page.query_selector(amount_selector)
            amount = ''
            if amount_element:
                amount_text = await amount_element.text_content()
                if amount_text:
                    amount = amount_text.strip()
                    logger.info(f"找到金额: {amount}")
                    print(f"[MONEY] 金额: {amount}")
                    result['amount'] = amount
            else:
                logger.warning("未找到金额元素")
                print("[WARNING]️ 未找到金额信息")

            # 获取订单创建时间
            await self._get_order_time(result)

            # 获取收货人信息（姓名、手机号、地址）
            await self._get_receiver_info(result)

            # 处理 sku--u_ddZval 元素
            if len(sku_elements) == 2:
                # 有两个元素：第一个是规格，第二个是数量
                logger.info("检测到两个 sku--u_ddZval 元素，第一个为规格，第二个为数量")
                print("[CLIPBOARD] 检测到两个元素：第一个为规格，第二个为数量")

                # 处理规格（第一个元素）
                spec_content = await sku_elements[0].text_content()
                if spec_content:
                    spec_content = spec_content.strip()
                    logger.info(f"规格原始内容: {spec_content}")
                    print(f"[NOTEBOOK]️ 规格原始内容: {spec_content}")

                    # 解析规格内容
                    parsed_spec = self._parse_sku_content(spec_content)
                    if parsed_spec:
                        result.update(parsed_spec)
                        print(f"[CLIPBOARD] 规格名称: {parsed_spec['spec_name']}")
                        print(f"[EDIT] 规格值: {parsed_spec['spec_value']}")

                # 处理数量（第二个元素）
                quantity_content = await sku_elements[1].text_content()
                if quantity_content:
                    quantity_content = quantity_content.strip()
                    logger.info(f"数量原始内容: {quantity_content}")
                    print(f"[BOX] 数量原始内容: {quantity_content}")

                    # 从数量内容中提取数量值（使用冒号分割，取后面的值）
                    if ':' in quantity_content:
                        quantity_value = quantity_content.split(':', 1)[1].strip()
                        # 去掉数量值前面的 'x' 符号（如 "x2" -> "2"）
                        if quantity_value.startswith('x'):
                            quantity_value = quantity_value[1:]
                        result['quantity'] = quantity_value
                        logger.info(f"提取到数量: {quantity_value}")
                        print(f"[KEYPAD] 数量: {quantity_value}")
                    else:
                        # 去掉数量值前面的 'x' 符号（如 "x2" -> "2"）
                        if quantity_content.startswith('x'):
                            quantity_content = quantity_content[1:]
                        result['quantity'] = quantity_content
                        logger.info(f"数量内容无冒号，直接使用: {quantity_content}")
                        print(f"[KEYPAD] 数量: {quantity_content}")

            elif len(sku_elements) == 1:
                # 只有一个元素：判断是否包含"数量"
                logger.info("检测到一个 sku--u_ddZval 元素，判断是规格还是数量")
                print("[CLIPBOARD] 检测到一个元素，判断是规格还是数量")

                content = await sku_elements[0].text_content()
                if content:
                    content = content.strip()
                    logger.info(f"元素原始内容: {content}")
                    print(f"[NOTEBOOK]️ 元素原始内容: {content}")

                    if '数量' in content:
                        # 这是数量信息
                        logger.info("判断为数量信息")
                        print("[BOX] 判断为数量信息")

                        if ':' in content:
                            quantity_value = content.split(':', 1)[1].strip()
                            # 去掉数量值前面的 'x' 符号（如 "x2" -> "2"）
                            if quantity_value.startswith('x'):
                                quantity_value = quantity_value[1:]
                            result['quantity'] = quantity_value
                            logger.info(f"提取到数量: {quantity_value}")
                            print(f"[KEYPAD] 数量: {quantity_value}")
                        else:
                            # 去掉数量值前面的 'x' 符号（如 "x2" -> "2"）
                            if content.startswith('x'):
                                content = content[1:]
                            result['quantity'] = content
                            logger.info(f"数量内容无冒号，直接使用: {content}")
                            print(f"[KEYPAD] 数量: {content}")
                    else:
                        # 这是规格信息
                        logger.info("判断为规格信息")
                        print("[CLIPBOARD] 判断为规格信息")

                        parsed_spec = self._parse_sku_content(content)
                        if parsed_spec:
                            result.update(parsed_spec)
                            print(f"[CLIPBOARD] 规格名称: {parsed_spec['spec_name']}")
                            print(f"[EDIT] 规格值: {parsed_spec['spec_value']}")
            else:
                logger.warning(f"未找到或找到异常数量的 sku--u_ddZval 元素: {len(sku_elements)}")
                print(f"[WARNING]️ 未找到或找到异常数量的元素: {len(sku_elements)}")

                # 如果没有找到sku--u_ddZval元素，设置默认数量为1
                if len(sku_elements) == 0:
                    result['quantity'] = '1'
                    logger.info("未找到sku--u_ddZval元素，数量默认设置为1")
                    print("[BOX] 数量默认设置为: 1")

                # 尝试获取页面的所有class包含sku的元素进行调试
                all_sku_elements = await self.page.query_selector_all('[class*="sku"]')
                if all_sku_elements:
                    logger.info(f"找到 {len(all_sku_elements)} 个包含'sku'的元素")
                    for i, element in enumerate(all_sku_elements):
                        class_name = await element.get_attribute('class')
                        text_content = await element.text_content()
                        logger.info(f"SKU元素 {i+1}: class='{class_name}', text='{text_content}'")

            # 确保数量字段存在，如果不存在则设置为1
            if 'quantity' not in result:
                result['quantity'] = '1'
                logger.info("未获取到数量信息，默认设置为1")
                print("[BOX] 数量默认设置为: 1")

            # 获取订单状态（在获取其他信息之后）
            await self._get_order_status(result)

            # 打印最终结果
            if result:
                logger.info(f"最终解析结果: {result}")
                print("[OK] 解析结果:")
                for key, value in result.items():
                    print(f"   {key}: {value}")
                return result
            else:
                logger.warning("未能解析到任何有效信息")
                print("[FAIL] 未能解析到任何有效信息")
                # 即使没有其他信息，也要返回默认数量
                return {'quantity': '0'}

        except Exception as e:
            logger.error(f"获取SKU内容失败: {e}")
            return {}

    async def _get_order_time(self, result: Dict[str, str]) -> None:
        """获取订单创建时间"""
        try:
            # 尝试多种可能的选择器获取订单时间
            # 选择器1: 包含"订单创建"或"下单时间"的元素
            time_selectors = [
                'text=/下单时间/',
                'text=/订单创建时间/',
                'text=/创建时间/',
                '.order-time',
                '[class*="time"]',
                '[class*="created"]'
            ]

            for selector in time_selectors:
                try:
                    time_element = await self.page.query_selector(selector)
                    if time_element:
                        time_text = await time_element.text_content()
                        if time_text:
                            time_text = time_text.strip()
                            # 尝试提取时间格式 (YYYY-MM-DD HH:MM:SS)
                            import re
                            time_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2})', time_text)
                            if not time_match:
                                # 尝试另一种格式 (YYYY-MM-DD HH:MM)
                                time_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2})', time_text)

                            if time_match:
                                order_time = time_match.group(1).replace('/', '-')
                                result['order_time'] = order_time
                                logger.info(f"找到订单时间: {order_time}")
                                print(f"[TIME] 订单时间: {order_time}")
                                return
                except Exception as e:
                    logger.debug(f"选择器 {selector} 获取时间失败: {e}")
                    continue

            # 如果上述方法都失败，尝试在整个页面源码中查找时间
            page_content = await self.page.content()
            import re
            time_match = re.search(r'(?:下单时间|订单创建时间|创建时间).*?(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}(?::\d{2})?)', page_content)
            if time_match:
                order_time = time_match.group(1).replace('/', '-')
                result['order_time'] = order_time
                logger.info(f"从页面源码中找到订单时间: {order_time}")
                print(f"[TIME] 订单时间: {order_time}")
            else:
                logger.warning("未能找到订单时间")
                print("[WARNING]️ 未找到订单时间")

        except Exception as e:
            logger.error(f"获取订单时间失败: {e}")
            print(f"[FAIL] 获取订单时间失败: {e}")

    async def _get_receiver_info(self, result: Dict[str, str]) -> None:
        """获取收货人信息（姓名、手机号、地址）"""
        try:
            import re

            # 调试：打印页面文本，看看有没有收货地址
            body_text = await self.page.inner_text('body')
            has_address = '收货地址' in body_text
            print(f"[DEBUG] 页面中是否包含'收货地址': {has_address}")
            if has_address:
                # 找到包含收货地址的行
                lines = body_text.split('\n')
                for i, line in enumerate(lines):
                    if '收货地址' in line:
                        print(f"[DEBUG] 找到收货地址行: {line}")
                        if i + 1 < len(lines):
                            print(f"[DEBUG] 下一行: {lines[i + 1]}")
                        break

            # 方法1: 使用正确的选择器获取收货地址
            # 闲鱼订单详情页面的收货地址格式：姓名 手机号 地址（都在一个元素里）
            try:
                # 查找包含"收货地址"文本的元素
                address_label = await self.page.query_selector('text=/收货地址/')
                if address_label:
                    # 获取父元素（li标签）
                    parent_li = await address_label.evaluate_handle('el => el.closest("li")')
                    if parent_li:
                        # 在li中查找包含实际地址信息的span元素
                        address_span = await parent_li.query_selector('span.textItemValue--w9qCWO1o')
                        if not address_span:
                            # 尝试其他可能的class名
                            address_span = await parent_li.query_selector('[class*="textItemValue"]')

                        if address_span:
                            address_text = await address_span.text_content()
                            if address_text:
                                address_text = address_text.strip()
                                logger.info(f"找到收货地址文本: {address_text}")
                                print(f"[INFO] 收货地址文本: {address_text}")

                                # 解析地址文本
                                # 格式：姓名 手机号 地址
                                # 例如：泡** 189****9805 福建省福州市仓山区******

                                # 提取手机号（完整或部分隐藏）
                                phone_match = re.search(r'1[3-9]\d[\d\*]{8}', address_text)
                                if phone_match:
                                    result['receiver_phone'] = phone_match.group(0)
                                    logger.info(f"提取手机号: {result['receiver_phone']}")
                                    print(f"[OK] 手机号: {result['receiver_phone']}")

                                # 提取姓名（在手机号前面的部分，可能包含*号）
                                if phone_match:
                                    name_part = address_text[:phone_match.start()].strip()
                                    if name_part:
                                        result['receiver_name'] = name_part
                                        logger.info(f"提取姓名: {result['receiver_name']}")
                                        print(f"[OK] 姓名: {result['receiver_name']}")

                                    # 提取地址（在手机号后面的部分）
                                    address_part = address_text[phone_match.end():].strip()
                                    if address_part:
                                        result['receiver_address'] = address_part
                                        logger.info(f"提取地址: {result['receiver_address']}")
                                        print(f"[OK] 地址: {result['receiver_address']}")

                                # 如果找到了信息就返回
                                if any(key in result for key in ['receiver_name', 'receiver_phone', 'receiver_address']):
                                    return
            except Exception as e:
                logger.warning(f"方法1获取收货地址失败: {e}")
                print(f"[WARN] 方法1失败: {e}")

            # 方法2: 从页面文本中查找（备用方法）
            try:
                body_text = await self.page.inner_text('body')

                # 查找包含"收货地址"的行
                lines = body_text.split('\n')
                for i, line in enumerate(lines):
                    if '收货地址' in line:
                        # 检查下一行是否包含地址信息
                        if i + 1 < len(lines):
                            next_line = lines[i + 1].strip()

                            # 提取手机号
                            phone_match = re.search(r'1[3-9]\d[\d\*]{8}', next_line)
                            if phone_match and 'receiver_phone' not in result:
                                result['receiver_phone'] = phone_match.group(0)
                                logger.info(f"从文本提取手机号: {result['receiver_phone']}")
                                print(f"[OK] 手机号(文本): {result['receiver_phone']}")

                                # 提取姓名
                                if 'receiver_name' not in result:
                                    name_part = next_line[:phone_match.start()].strip()
                                    if name_part:
                                        result['receiver_name'] = name_part
                                        logger.info(f"从文本提取姓名: {result['receiver_name']}")
                                        print(f"[OK] 姓名(文本): {result['receiver_name']}")

                                # 提取地址
                                if 'receiver_address' not in result:
                                    address_part = next_line[phone_match.end():].strip()
                                    # 移除可能的"复制"按钮文本
                                    address_part = re.sub(r'复制$', '', address_part).strip()
                                    if address_part:
                                        result['receiver_address'] = address_part
                                        logger.info(f"从文本提取地址: {result['receiver_address']}")
                                        print(f"[OK] 地址(文本): {result['receiver_address']}")
                        break
            except Exception as e:
                logger.warning(f"方法2获取收货地址失败: {e}")
                print(f"[WARN] 方法2失败: {e}")

            # 记录未找到的信息
            if 'receiver_name' not in result:
                logger.warning("未能找到收货人姓名")
                print("[WARN] 未找到收货人姓名")
            if 'receiver_phone' not in result:
                logger.warning("未能找到手机号")
                print("[WARN] 未找到手机号")
            if 'receiver_address' not in result:
                logger.warning("未能找到收货地址")
                print("[WARN] 未找到收货地址")

        except Exception as e:
            logger.error(f"获取收货人信息失败: {e}")
            print(f"[ERROR] 获取收货人信息失败: {e}")

    async def _get_order_status(self, result: Dict[str, str]) -> None:
        """获取订单状态"""
        try:
            # 使用JavaScript分析页面，获取订单状态
            status_info = await self.page.evaluate('''() => {
                // 定义状态关键词映射 - 优先级高的放前面
                const statusMap = [
                    // 交易关闭 - 最长最具体的优先
                    {text: '买家取消了订单', status: 'cancelled', priority: 100},
                    {text: '卖家取消了订单', status: 'cancelled', priority: 100},
                    {text: '交易关闭', status: 'cancelled', priority: 90},
                    {text: '订单已关闭', status: 'cancelled', priority: 90},
                    // 已发货
                    {text: '卖家已发货，待买家确认收货', status: 'shipped', priority: 85},
                    {text: '已发货，待买家确认收货', status: 'shipped', priority: 80},
                    {text: '卖家已发货', status: 'shipped', priority: 75},
                    {text: '已发货', status: 'shipped', priority: 70},
                    {text: '待买家确认收货', status: 'shipped', priority: 65},
                    // 待发货
                    {text: '买家已付款，请尽快发货', status: 'pending_ship', priority: 60},
                    {text: '买家已付款', status: 'pending_ship', priority: 55},
                    {text: '待发货', status: 'pending_ship', priority: 50},
                    {text: '等待卖家发货', status: 'pending_ship', priority: 45},
                    // 已完成
                    {text: '交易成功', status: 'completed', priority: 40},
                    {text: '订单完成', status: 'completed', priority: 35},
                    {text: '交易完成', status: 'completed', priority: 30},
                    // 退款
                    {text: '退款中', status: 'refunding', priority: 25},
                    {text: '申请退款', status: 'refunding', priority: 20},
                    // 处理中
                    {text: '处理中', status: 'processing', priority: 10},
                ];

                // 查找所有文本节点
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null
                );

                let bestMatch = null;
                let bestScore = -1;
                let nodeCount = 0;
                const maxNodes = 5000; // 限制遍历的节点数量

                let node;
                while(node = walker.nextNode() && nodeCount < maxNodes) {
                    nodeCount++;
                    const text = node.textContent?.trim();
                    if(!text || text.length < 2 || text.length > 100) continue;

                    // 检查每个状态关键词
                    for(const item of statusMap) {
                        if(text.includes(item.text)) {
                            const parent = node.parentElement;
                            if(parent) {
                                const style = window.getComputedStyle(parent);
                                const fontSize = parseInt(style.fontSize) || 0;
                                const fontWeight = parseInt(style.fontWeight) || 0;

                                // 计算分数：关键词优先级 + 字体大小加分 + 字体粗细加分
                                const score = item.priority + fontSize + (fontWeight > 500 ? 5 : 0);

                                if(score > bestScore) {
                                    bestMatch = {
                                        text: text,
                                        status: item.status,
                                        fontSize: fontSize,
                                        fontWeight: fontWeight,
                                        class: parent.className,
                                        score: score
                                    };
                                    bestScore = score;
                                }
                            }
                            break; // 找到匹配就跳出内层循环
                        }
                    }
                }

                return {
                    match: bestMatch,
                    nodesScanned: nodeCount
                };
            }''')

            logger.info(f"订单状态分析结果: {status_info}")
            print(f"[DEBUG] Status analysis result: {status_info}")

            match_info = status_info.get('match')
            if match_info:
                result['order_status'] = match_info['status']
                match_text = match_info.get('text', '').encode('utf-8', errors='ignore').decode('utf-8')
                logger.info(f"找到订单状态: {match_info['status']} (文本: {match_text}, 分数: {match_info.get('score', 0)})")
                print(f"[ORDER_STATUS] Order status: {match_info['status']} (text: {match_text})")
            else:
                logger.warning(f"未能找到订单状态，扫描了 {status_info.get('nodesScanned', 0)} 个节点")
                print("[WARNING] Order status not found")
                result['order_status'] = 'unknown'

        except Exception as e:
            logger.error(f"获取订单状态失败: {e}")
            print(f"[ERROR] Failed to get order status: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def _check_browser_status(self) -> bool:
        """检查浏览器状态是否正常"""
        try:
            if not self.browser or not self.context or not self.page:
                logger.warning("浏览器组件不完整")
                return False

            # 检查浏览器是否已连接
            if self.browser.is_connected():
                # 尝试获取页面标题来验证页面是否可用
                await self.page.title()
                return True
            else:
                logger.warning("浏览器连接已断开")
                return False
        except Exception as e:
            logger.warning(f"浏览器状态检查失败: {e}")
            return False

    async def _ensure_browser_ready(self) -> bool:
        """确保浏览器准备就绪，如果不可用则重新初始化"""
        try:
            if await self._check_browser_status():
                return True

            logger.info("浏览器状态异常，尝试重新初始化...")

            # 先尝试关闭现有的浏览器实例
            await self._force_close_browser()

            # 重新初始化浏览器
            await self.init_browser()

            # 等待更长时间确保浏览器完全就绪
            await asyncio.sleep(2)

            # 再次检查状态
            if await self._check_browser_status():
                logger.info("浏览器重新初始化成功")
                return True
            else:
                logger.error("浏览器重新初始化失败")
                return False

        except Exception as e:
            logger.error(f"确保浏览器就绪失败: {e}")
            return False

    async def _force_close_browser(self):
        """强制关闭浏览器，忽略所有错误"""
        try:
            if self.page:
                try:
                    await self.page.close()
                except:
                    pass
                self.page = None

            if self.context:
                try:
                    await self.context.close()
                except:
                    pass
                self.context = None

            if self.browser:
                try:
                    await self.browser.close()
                except:
                    pass
                self.browser = None

        except Exception as e:
            logger.debug(f"强制关闭浏览器过程中的异常（可忽略）: {e}")

    async def close(self):
        """关闭浏览器"""
        try:
            if self.page:
                await self.page.close()
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            logger.info("浏览器已关闭")
        except Exception as e:
            logger.error(f"关闭浏览器失败: {e}")
            # 如果正常关闭失败，尝试强制关闭
            await self._force_close_browser()

    async def __aenter__(self):
        """异步上下文管理器入口"""
        await self.init_browser()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self.close()


# 便捷函数
async def fetch_order_detail_simple(order_id: str, cookie_string: str = None, headless: bool = True) -> Optional[Dict[str, Any]]:
    """
    简单的订单详情获取函数（优化版：先检查数据库，再初始化浏览器）

    Args:
        order_id: 订单ID
        cookie_string: Cookie字符串，如果不提供则使用默认值
        headless: 是否无头模式

    Returns:
        订单详情字典，包含以下字段：
        - order_id: 订单ID
        - url: 订单详情页面URL
        - title: 页面标题
        - sku_info: 完整的SKU信息字典
        - spec_name: 规格名称
        - spec_value: 规格值
        - quantity: 数量
        - amount: 金额
        - timestamp: 获取时间戳
        失败时返回None
    """
    # 先检查数据库中是否有有效数据
    try:
        from db_manager import db_manager
        existing_order = db_manager.get_order_by_id(order_id)

        if existing_order:
            # 检查金额字段是否有效
            amount = existing_order.get('amount', '')
            amount_valid = False

            if amount:
                amount_clean = str(amount).replace('¥', '').replace('￥', '').replace('$', '').strip()
                try:
                    amount_value = float(amount_clean)
                    amount_valid = amount_value > 0
                except (ValueError, TypeError):
                    amount_valid = False

            # 获取收货人信息（不作为判断是否刷新的条件，但刷新时如果有新信息会更新）
            receiver_name = existing_order.get('receiver_name', '')
            receiver_phone = existing_order.get('receiver_phone', '')
            receiver_address = existing_order.get('receiver_address', '')

            # 只有金额有效时才使用缓存（不再检查收货人信息是否完整）
            if amount_valid:
                logger.info(f"[CLIPBOARD] 订单 {order_id} 已存在于数据库中且金额有效({amount})，直接返回缓存数据")
                print(f"[OK] 订单 {order_id} 使用缓存数据（金额:{amount}）")

                # 构建返回格式（包含收货人信息）
                result = {
                    'order_id': existing_order['order_id'],
                    'url': f"https://www.goofish.com/order-detail?orderId={order_id}&role=seller",
                    'title': f"订单详情 - {order_id}",
                    'sku_info': {
                        'spec_name': existing_order.get('spec_name', ''),
                        'spec_value': existing_order.get('spec_value', ''),
                        'quantity': existing_order.get('quantity', ''),
                        'amount': existing_order.get('amount', '')
                    },
                    'spec_name': existing_order.get('spec_name', ''),
                    'spec_value': existing_order.get('spec_value', ''),
                    'quantity': existing_order.get('quantity', ''),
                    'amount': existing_order.get('amount', ''),
                    'order_status': existing_order.get('order_status', 'unknown'),
                    'order_time': existing_order.get('created_at', ''),
                    'receiver_name': receiver_name,
                    'receiver_phone': receiver_phone,
                    'receiver_address': receiver_address,
                    'timestamp': time.time(),
                    'from_cache': True
                }
                return result
            else:
                if not amount_valid:
                    logger.info(f"[CLIPBOARD] 订单 {order_id} 金额无效({amount})，需要重新获取")
                    print(f"[WARN] 订单 {order_id} 金额无效，重新获取详情...")
    except Exception as e:
        logger.warning(f"检查数据库缓存失败: {e}")

    # 数据库中没有有效数据，使用浏览器获取
    logger.info(f"🌐 订单 {order_id} 需要浏览器获取，开始初始化浏览器...")
    print(f"[SEARCH] 订单 {order_id} 开始浏览器获取详情...")

    fetcher = OrderDetailFetcher(cookie_string, headless)
    try:
        if await fetcher.init_browser(headless=headless):
            return await fetcher.fetch_order_detail(order_id)
    finally:
        await fetcher.close()
    return None


# 测试代码
if __name__ == "__main__":
    async def test():
        # 测试订单ID
        test_order_id = "2856024697612814489"
        
        print(f"[SEARCH] 开始获取订单详情: {test_order_id}")
        
        result = await fetch_order_detail_simple(test_order_id, headless=False)
        
        if result:
            print("[OK] 订单详情获取成功:")
            print(f"[CLIPBOARD] 订单ID: {result['order_id']}")
            print(f"🌐 URL: {result['url']}")
            print(f"📄 页面标题: {result['title']}")
            print(f"[NOTEBOOK]️ 规格名称: {result.get('spec_name', '未获取到')}")
            print(f"[EDIT] 规格值: {result.get('spec_value', '未获取到')}")
            print(f"[KEYPAD] 数量: {result.get('quantity', '未获取到')}")
            print(f"[MONEY] 金额: {result.get('amount', '未获取到')}")
        else:
            print("[FAIL] 订单详情获取失败")
    
    # 运行测试
    asyncio.run(test())
