# 闲鱼商品发布器使用指南

## 📋 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [进度回调](#进度回调)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 功能特性

### ✅ 核心功能
- 批量商品发布
- Cookie 登录
- 图片批量上传
- 商品信息填写（标题、价格、描述、原价）
- 分类选择
- 位置设置

### ✅ 增强功能
- **完善的错误处理**：网络超时、验证码检测、页面加载失败重试
- **多选择器降级策略**：主选择器失败时自动尝试备选选择器
- **自动截图**：发布失败时自动截图保存
- **进度回调**：实时获取发布进度（浏览器初始化、登录、上传图片、填写信息、发布中、完成）
- **配置文件热加载**：修改配置无需重启程序
- **防检测策略**：鼠标移动模拟、页面滚动模拟、随机延迟、User-Agent 轮换

---

## 快速开始

### 1. 基本使用

```python
import asyncio
from product_publisher import XianyuProductPublisher, ProductInfo

async def main():
    # 创建发布器实例
    publisher = XianyuProductPublisher(
        cookie_id="user_123",
        cookies_str="your_cookie_string_here",
        headless=True  # 无头模式
    )
    
    # 创建商品信息
    product = ProductInfo(
        title="全新 iPhone 15 Pro",
        description="全新未拆封，支持验机",
        price=7999.00,
        images=["image1.jpg", "image2.jpg", "image3.jpg"],
        category="数码产品/手机/苹果",
        location="北京市/朝阳区",
        original_price=8999.00
    )
    
    # 初始化浏览器
    await publisher.init_browser()
    
    # 登录
    await publisher.login_with_cookie()
    
    # 发布商品
    success = await publisher.publish_product(product)
    
    if success:
        print("商品发布成功！")
    else:
        print("商品发布失败")
    
    # 关闭浏览器
    await publisher.close()

# 运行
asyncio.run(main())
```

### 2. 批量发布

```python
import asyncio
from product_publisher import XianyuProductPublisher, ProductInfo

async def batch_publish_example():
    # 创建发布器实例
    publisher = XianyuProductPublisher(
        cookie_id="user_123",
        cookies_str="your_cookie_string_here"
    )
    
    # 创建商品列表
    products = [
        ProductInfo(
            title="商品 1",
            description="描述 1",
            price=99.99,
            images=["img1.jpg"]
        ),
        ProductInfo(
            title="商品 2",
            description="描述 2",
            price=199.99,
            images=["img2.jpg"]
        ),
    ]
    
    # 批量发布
    results = await publisher.batch_publish(products)
    
    print(f"发布完成: 成功 {results['success']}/{results['total']}")
    print(f"详细结果: {results['details']}")

asyncio.run(batch_publish_example())
```

---

## 配置说明

### 配置文件位置

默认配置文件：`product_publisher_config.yml`

### 主要配置项

#### 1. 选择器配置

```yaml
selectors:
  image_upload:
    primary: 'input[type="file"]'
    fallback:
      - 'input[accept*="image"]'
      - '.upload-input'
```

**说明**：
- `primary`：主选择器（优先使用）
- `fallback`：备选选择器列表（主选择器失败时依次尝试）

#### 2. 延迟配置

```yaml
delays:
  operation_min: 0.5  # 操作间最小延迟（秒）
  operation_max: 1.5  # 操作间最大延迟（秒）
  product_min: 5      # 商品间最小延迟（秒）
  product_max: 15     # 商品间最大延迟（秒）
```

**说明**：
- 随机延迟范围，模拟真实用户行为
- `product_min/max`：防止频繁发布触发风控

#### 3. 重试配置

```yaml
retry:
  max_attempts: 3           # 最大重试次数
  retry_delay: 2            # 重试间隔（秒）
  selector_timeout: 10000   # 选择器查找超时（毫秒）
  page_load_timeout: 30000  # 页面加载超时（毫秒）
```

#### 4. 截图配置

```yaml
screenshot:
  enabled: true              # 是否启用截图
  save_dir: 'logs/screenshots'  # 截图保存目录
  on_failure: true           # 失败时截图
  on_success: false          # 成功时截图
```

#### 5. 防检测配置

```yaml
anti_detection:
  user_agents:  # User-Agent 列表（随机选择）
    - 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
  enable_mouse_movement: true   # 启用鼠标移动模拟
  enable_page_scroll: true      # 启用页面滚动模拟
```

#### 6. 验证码配置

```yaml
captcha:
  enabled: true               # 启用验证码检测
  wait_timeout: 60            # 验证码等待超时（秒）
  auto_handle: false          # 自动处理验证码（需集成验证码服务）
```

---

## 进度回调

### 设置回调函数

```python
def progress_callback(event: str, data: dict):
    """进度回调函数
    
    Args:
        event: 事件名称
        data: 事件数据
    """
    print(f"事件: {event}, 数据: {data}")

# 设置回调
publisher.set_progress_callback(progress_callback)
```

### 回调事件列表

| 事件名称 | 触发时机 | 数据字段 |
|---------|---------|---------|
| `browser_init` | 浏览器初始化 | `status`: starting/success/failed |
| `login` | Cookie 登录 | `status`: starting/success/failed/uncertain |
| `publish_start` | 开始发布商品 | `title`: 商品标题 |
| `upload_images` | 上传图片 | `status`: starting/uploading/success<br>`current`: 当前数量<br>`total`: 总数量 |
| `fill_info` | 填写商品信息 | `status`: starting/success |
| `publishing` | 点击发布按钮 | `status`: clicking |
| `publish_complete` | 发布完成 | `status`: success/failed/error<br>`title`: 商品标题 |
| `captcha_detected` | 检测到验证码 | `status`: waiting/solved/timeout |
| `batch_progress` | 批量发布进度 | `current`: 当前序号<br>`total`: 总数量<br>`product`: 商品标题 |
| `batch_complete` | 批量发布完成 | `total`: 总数量<br>`success`: 成功数量<br>`failed`: 失败数量 |

### 示例：前端实时显示进度

```python
class ProgressTracker:
    def __init__(self):
        self.current_step = ""
        self.progress = 0
    
    def callback(self, event: str, data: dict):
        if event == 'browser_init':
            self.current_step = "初始化浏览器"
            self.progress = 10
        elif event == 'login':
            self.current_step = "登录中"
            self.progress = 20
        elif event == 'upload_images':
            if data['status'] == 'uploading':
                self.current_step = f"上传图片 {data['current']}/{data['total']}"
                self.progress = 30 + (data['current'] / data['total']) * 20
        elif event == 'fill_info':
            self.current_step = "填写商品信息"
            self.progress = 60
        elif event == 'publishing':
            self.current_step = "发布中"
            self.progress = 80
        elif event == 'publish_complete':
            self.current_step = "发布完成"
            self.progress = 100
        
        # 更新前端显示
        print(f"进度: {self.progress}% - {self.current_step}")

tracker = ProgressTracker()
publisher.set_progress_callback(tracker.callback)
```

---

## 错误处理

### 1. 网络超时处理

发布器会自动重试网络请求，最多重试 3 次（可配置）。

```python
# 配置文件中设置
retry:
  max_attempts: 3
  retry_delay: 2
```

### 2. 验证码处理

#### 自动检测

发布器会自动检测验证码，检测到后会：
1. 触发 `captcha_detected` 事件
2. 自动截图保存
3. 等待手动处理或自动处理（如果启用）

#### 手动处理

```python
# 配置文件中设置
captcha:
  enabled: true
  wait_timeout: 60  # 等待 60 秒
  auto_handle: false  # 手动处理
```

用户需要在 60 秒内手动完成验证码。

#### 自动处理（需集成验证码服务）

```python
# 配置文件中设置
captcha:
  auto_handle: true
```

**注意**：自动处理需要集成第三方验证码服务（如打码平台），当前版本未实现。

### 3. 选择器失效处理

发布器使用多选择器降级策略：
1. 首先尝试主选择器
2. 主选择器失败时，依次尝试备选选择器
3. 所有选择器都失败时，返回错误

```python
# 配置文件中添加备选选择器
selectors:
  title_input:
    primary: 'input[placeholder*="标题"]'
    fallback:
      - 'input[name="title"]'
      - '.title-input'
      - '[data-testid="title-input"]'
```

### 4. 页面加载失败处理

发布器会自动重试页面加载，使用指数退避策略：
- 第 1 次失败：等待 2 秒后重试
- 第 2 次失败：等待 4 秒后重试
- 第 3 次失败：等待 6 秒后重试

### 5. 截图保存

发布失败时，发布器会自动截图保存到 `logs/screenshots/` 目录，文件名包含：
- 账号 ID
- 时间戳
- 商品标题（如果有）
- 序号

示例：`user_123_20250127_143025_iPhone15Pro_1.png`

---

## 最佳实践

### 1. 控制发布频率

```python
# 配置文件中设置合理的延迟
delays:
  product_min: 10  # 商品间至少间隔 10 秒
  product_max: 20  # 最多间隔 20 秒
```

**建议**：
- 每天发布不超过 10-20 个商品
- 商品间隔至少 10 秒
- 避免深夜或凌晨操作

### 2. 使用测试账号

在正式使用前，建议使用测试账号验证功能：

```python
# 测试账号
test_publisher = XianyuProductPublisher(
    cookie_id="test_account",
    cookies_str="test_cookies",
    headless=False  # 有头模式，方便观察
)
```

### 3. 监控发布结果

```python
results = await publisher.batch_publish(products)

# 记录结果
logger.info(f"发布统计: {results}")

# 分析失败原因
for detail in results['details']:
    if detail['status'] == 'failed':
        logger.warning(f"商品 {detail['title']} 发布失败")
```

### 4. 定期更新选择器

闲鱼页面结构可能变化，需要定期检查和更新选择器配置：

```python
# 定期检查配置文件
# 如果发现选择器失效，及时更新 product_publisher_config.yml
```

### 5. 备份重要数据

```python
# 发布前备份商品数据
import json

with open('products_backup.json', 'w', encoding='utf-8') as f:
    json.dump([p.__dict__ for p in products], f, ensure_ascii=False, indent=2)
```

---

## 常见问题

### Q1: 为什么登录失败？

**可能原因**：
1. Cookie 已过期
2. Cookie 格式不正确
3. 账号被风控

**解决方案**：
1. 重新获取 Cookie
2. 检查 Cookie 格式（应为 `key1=value1; key2=value2`）
3. 更换账号或等待风控解除

### Q2: 为什么图片上传失败？

**可能原因**：
1. 图片路径不存在
2. 图片格式不支持
3. 图片大小超限
4. 选择器失效

**解决方案**：
1. 检查图片路径是否正确
2. 使用 JPG/PNG 格式
3. 压缩图片大小（建议 < 5MB）
4. 更新选择器配置

### Q3: 如何处理验证码？

**方案 1：手动处理**
```yaml
captcha:
  auto_handle: false
  wait_timeout: 60
```
检测到验证码后，在 60 秒内手动完成。

**方案 2：自动处理（需集成验证码服务）**
```yaml
captcha:
  auto_handle: true
```
需要集成第三方验证码服务。

### Q4: 如何调试选择器问题？

**启用详细日志**：
```yaml
logging:
  log_selector_search: true
```

**使用有头模式**：
```python
publisher = XianyuProductPublisher(
    cookie_id="test",
    cookies_str="cookies",
    headless=False  # 有头模式
)
```

**查看截图**：
发布失败时会自动截图，查看 `logs/screenshots/` 目录。

### Q5: 如何提高发布成功率？

1. **使用真实的 User-Agent**
2. **启用防检测策略**
3. **控制发布频率**
4. **定期更新选择器**
5. **监控发布结果，及时调整策略**

### Q6: 配置文件修改后需要重启吗？

不需要。发布器支持配置热加载，每次发布商品前会自动检查配置文件是否变化并重新加载。

---

## 运行测试

```bash
# 安装测试依赖
pip install pytest pytest-asyncio

# 运行测试
cd xianyu-super-butler-repo
python -m pytest tests/test_product_publisher.py -v
```

---

## 技术支持

如有问题，请查看：
1. 日志文件：`logs/xianyu_*.log`
2. 截图文件：`logs/screenshots/`
3. 配置文件：`product_publisher_config.yml`

---

## 免责声明

⚠️ **重要提示**：
- 自动化操作可能违反闲鱼平台服务条款
- 大量自动发布可能被视为垃圾信息
- 可能导致账号被封禁
- 建议仅用于学习和研究目的

使用本工具的风险由使用者自行承担。
