# 闲鱼商品发布功能使用说明

## 📋 功能概述

本项目已集成闲鱼商品自动发布功能，支持:

- ✅ 单个商品发布
- ✅ 批量商品发布
- ✅ 图片批量上传
- ✅ 商品信息自动填写
- ✅ 分类和位置设置
- ✅ 防检测策略（随机延迟、行为模拟）

## 🚀 快速开始

### 1. 安装依赖

确保已安装 Playwright:

```bash
pip install playwright
playwright install chromium
```

### 2. API 端点

#### 2.1 发布单个商品

**端点**: `POST /api/products/publish`

**请求体**:
```json
{
  "cookie_id": "account_001",
  "title": "全新 iPhone 15 Pro Max 256GB",
  "description": "全新未拆封，原装正品，支持验货，不满意包退。",
  "price": 8999.00,
  "images": [
    "/path/to/image1.jpg",
    "/path/to/image2.jpg",
    "/path/to/image3.jpg"
  ],
  "category": "数码产品/手机/苹果",
  "location": "北京市/朝阳区",
  "original_price": 9999.00,
  "stock": 1
}
```

**响应**:
```json
{
  "success": true,
  "message": "商品发布成功",
  "product": {
    "title": "全新 iPhone 15 Pro Max 256GB",
    "price": 8999.00
  }
}
```

#### 2.2 批量发布商品

**端点**: `POST /api/products/batch-publish`

**请求体**:
```json
{
  "cookie_id": "account_001",
  "products": [
    {
      "title": "商品1",
      "description": "描述1",
      "price": 99.00,
      "images": ["/path/to/img1.jpg"]
    },
    {
      "title": "商品2",
      "description": "描述2",
      "price": 199.00,
      "images": ["/path/to/img2.jpg"]
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "message": "批量发布完成: 成功 2/2",
  "results": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "details": [
      {"title": "商品1", "status": "success"},
      {"title": "商品2", "status": "success"}
    ]
  }
}
```

#### 2.3 获取商品模板

**端点**: `GET /api/products/templates`

**响应**:
```json
{
  "success": true,
  "templates": [
    {
      "id": "template_1",
      "name": "数码产品模板",
      "category": "数码产品/手机/苹果",
      "location": "北京市/朝阳区",
      "description_template": "全新{title}，原装正品，支持验货，不满意包退。"
    }
  ]
}
```

## 🔧 Python 代码示例

### 示例 1: 发布单个商品

```python
import asyncio
from product_publisher import XianyuProductPublisher, ProductInfo

async def publish_single_product():
    # 商品信息
    product = ProductInfo(
        title="全新 iPhone 15 Pro Max 256GB",
        description="全新未拆封，原装正品，支持验货，不满意包退。",
        price=8999.00,
        images=[
            "/path/to/image1.jpg",
            "/path/to/image2.jpg",
            "/path/to/image3.jpg"
        ],
        category="数码产品/手机/苹果",
        location="北京市/朝阳区",
        original_price=9999.00,
        stock=1
    )
    
    # 创建发布器
    publisher = XianyuProductPublisher(
        cookie_id="account_001",
        cookies_str="your_cookie_string_here",
        headless=True
    )
    
    try:
        # 初始化浏览器
        await publisher.init_browser()
        
        # Cookie 登录
        if not await publisher.login_with_cookie():
            print("Cookie 登录失败")
            return
        
        # 发布商品
        success = await publisher.publish_product(product)
        
        if success:
            print("商品发布成功!")
        else:
            print("商品发布失败")
    
    finally:
        await publisher.close()

# 运行
asyncio.run(publish_single_product())
```

### 示例 2: 批量发布商品

```python
import asyncio
from product_publisher import publish_products, ProductInfo

async def batch_publish():
    # 商品列表
    products = [
        ProductInfo(
            title="商品1",
            description="描述1",
            price=99.00,
            images=["/path/to/img1.jpg"]
        ),
        ProductInfo(
            title="商品2",
            description="描述2",
            price=199.00,
            images=["/path/to/img2.jpg"]
        ),
        ProductInfo(
            title="商品3",
            description="描述3",
            price=299.00,
            images=["/path/to/img3.jpg"]
        )
    ]
    
    # 批量发布
    results = await publish_products(
        cookie_id="account_001",
        cookies_str="your_cookie_string_here",
        products=products,
        headless=True
    )
    
    print(f"发布完成: 成功 {results['success']}/{results['total']}")
    print(f"详细结果: {results['details']}")

# 运行
asyncio.run(batch_publish())
```

### 示例 3: 从 CSV 文件批量发布

```python
import asyncio
import csv
from product_publisher import publish_products, ProductInfo

async def publish_from_csv(csv_file: str):
    products = []
    
    # 读取 CSV 文件
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 解析图片路径（用 | 分隔）
            images = row['images'].split('|') if row.get('images') else []
            
            product = ProductInfo(
                title=row['title'],
                description=row['description'],
                price=float(row['price']),
                images=images,
                category=row.get('category'),
                location=row.get('location'),
                original_price=float(row['original_price']) if row.get('original_price') else None,
                stock=int(row.get('stock', 1))
            )
            products.append(product)
    
    # 批量发布
    results = await publish_products(
        cookie_id="account_001",
        cookies_str="your_cookie_string_here",
        products=products,
        headless=True
    )
    
    print(f"发布完成: 成功 {results['success']}/{results['total']}")

# 运行
asyncio.run(publish_from_csv('products.csv'))
```

**CSV 文件格式** (`products.csv`):
```csv
title,description,price,images,category,location,original_price,stock
全新 iPhone 15,全新未拆封,8999.00,img1.jpg|img2.jpg,数码产品/手机/苹果,北京市/朝阳区,9999.00,1
二手 MacBook Pro,9成新,12999.00,img3.jpg|img4.jpg,数码产品/笔记本/苹果,上海市/浦东新区,15999.00,1
```

## 🛡️ 防检测策略

本模块已内置以下防检测策略:

### 1. 浏览器配置
- 禁用自动化标志 (`--disable-blink-features=AutomationControlled`)
- 伪装真实 User-Agent
- 注入反检测脚本

### 2. 行为模拟
- 操作间随机延迟 (0.5-1.5 秒)
- 商品间随机延迟 (5-15 秒)
- 模拟真实用户操作流程

### 3. 频率控制
- 建议每天发布不超过 10-20 个商品
- 避免深夜或凌晨操作
- 控制操作频率

## ⚠️ 注意事项

### 1. 法律与合规
- 自动化操作可能违反闲鱼平台服务条款
- 大量自动发布可能被视为垃圾信息
- 可能导致账号被封禁
- **建议仅用于学习和研究目的**

### 2. 技术风险
- 闲鱼可能随时更新页面结构，导致选择器失效
- 反爬虫策略可能升级
- 需要定期维护代码

### 3. 账号安全
- 频繁自动化操作可能触发风控
- 建议使用测试账号
- 控制操作频率

### 4. 最佳实践
- 每天发布数量不超过 10-20 个
- 操作间隔至少 5-15 秒
- 避免深夜或凌晨操作
- 随机化操作时间
- 模拟真实用户行为

## 📝 日志

所有操作都会记录到日志文件:

```
logs/xianyu_YYYY-MM-DD.log
```

日志包含:
- 浏览器初始化
- Cookie 登录状态
- 图片上传进度
- 商品信息填写
- 发布结果
- 错误信息

## 🔍 故障排查

### 问题 1: Cookie 登录失败

**原因**: Cookie 过期或无效

**解决方案**:
1. 重新获取 Cookie
2. 检查 Cookie 格式是否正确
3. 确认账号未被封禁

### 问题 2: 图片上传失败

**原因**: 图片路径不存在或格式不支持

**解决方案**:
1. 检查图片路径是否正确
2. 确认图片格式（支持 jpg、png）
3. 检查图片大小（建议 < 5MB）

### 问题 3: 选择器失效

**原因**: 闲鱼页面结构更新

**解决方案**:
1. 使用浏览器开发者工具检查最新的选择器
2. 更新 `product_publisher.py` 中的选择器
3. 提交 Issue 或 PR

### 问题 4: 发布失败

**原因**: 多种可能（网络、验证码、风控等）

**解决方案**:
1. 查看日志文件获取详细错误信息
2. 尝试手动发布验证账号状态
3. 降低发布频率
4. 使用非 headless 模式调试 (`headless=False`)

## 🧪 测试功能

### 快速测试

使用 `quick_test.py` 快速验证发布功能：

```bash
# 设置环境变量
export XIANYU_COOKIE="your_cookie_here"

# 快速测试单个商品
python quick_test.py \
  --cookie-id test_001 \
  --title "测试商品" \
  --price 99.00 \
  --images examples/images/product_1.jpg

# 非无头模式（可以看到浏览器操作）
python quick_test.py \
  --cookie-id test_001 \
  --title "测试商品" \
  --price 99.00 \
  --images examples/images/product_1.jpg \
  --no-headless
```

### 使用示例数据

项目提供了完整的示例数据：

```bash
# 查看示例 CSV
cat examples/products_sample.csv

# 查看示例图片
ls examples/images/

# 使用示例数据测试
python quick_test.py \
  --cookie-id test_001 \
  --title "全新 iPhone 15 Pro Max 256GB" \
  --price 8999.00 \
  --images examples/images/phone_1.jpg examples/images/phone_2.jpg
```

### 运行测试套件

使用 pytest 运行完整测试：

```bash
# 安装测试依赖
pip install pytest pytest-asyncio

# 设置测试 Cookie
export XIANYU_TEST_COOKIE="your_test_cookie_here"

# 运行所有测试
pytest test_product_publish.py -v

# 运行特定测试
pytest test_product_publish.py::TestProductPublisher::test_browser_init -v

# 显示详细输出
pytest test_product_publish.py -v -s
```

### API 测试

测试所有 API 端点：

```bash
# 设置 API 配置
export API_BASE_URL="http://localhost:8000"
export API_TOKEN="your_api_token_here"

# 运行 API 测试
python test_api.py

# 指定参数
python test_api.py \
  --base-url http://localhost:8000 \
  --token your_token \
  --cookie-id test_001
```

### 性能测试

测试批量发布性能：

```bash
# 使用示例 CSV 进行性能测试
python benchmark_publish.py \
  --cookie-id test_001 \
  --csv examples/products_sample.csv \
  --batch-size 5 \
  --output benchmark_results.json

# 查看结果
cat benchmark_results.json
cat benchmark_results.csv
```

性能测试会生成详细报告：
- 总运行次数
- 成功/失败次数
- 成功率
- 平均耗时
- 吞吐量

### 测试文件说明

| 文件 | 用途 |
|------|------|
| `quick_test.py` | 快速测试单个商品发布 |
| `test_product_publish.py` | pytest 测试套件 |
| `test_api.py` | API 端点测试 |
| `benchmark_publish.py` | 性能测试和基准测试 |
| `examples/products_sample.csv` | 示例商品数据（10个商品） |
| `examples/images/` | 示例商品图片（18张） |
| `examples/generate_sample_images.py` | 生成示例图片脚本 |

### 常见测试问题

**Q: 测试时提示 Cookie 无效？**

A: 需要配置有效的测试 Cookie：
```bash
export XIANYU_TEST_COOKIE="your_valid_cookie"
```

**Q: 图片文件不存在？**

A: 先生成示例图片：
```bash
python examples/generate_sample_images.py
```

**Q: 如何跳过需要 Cookie 的测试？**

A: pytest 会自动跳过需要有效 Cookie 的测试，显示 `SKIPPED`。

**Q: 如何调试测试失败？**

A: 使用非无头模式查看浏览器操作：
```bash
python quick_test.py --no-headless ...
```

## 📚 参考资源

- [Playwright 官方文档](https://playwright.dev/python/)
- [闲鱼批量发布工具实现](https://cloud.tencent.cn/developer/article/2538483)
- [Playwright Stealth 插件](https://github.com/Granitosaurus/playwright-stealth)
- [pytest 官方文档](https://docs.pytest.org/)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可证

本项目仅供学习和研究使用，请勿用于商业用途或违反平台规则的行为。
