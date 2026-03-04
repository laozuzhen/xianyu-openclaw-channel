# 示例数据说明

本目录包含用于测试闲鱼商品发布功能的示例数据。

## 📁 目录结构

```
examples/
├── README.md                      # 本文件
├── products_sample.csv            # 示例商品数据（10个商品）
├── generate_sample_images.py     # 生成示例图片脚本
└── images/                        # 示例商品图片目录
    ├── phone_1.jpg               # iPhone 正面
    ├── phone_2.jpg               # iPhone 背面
    ├── laptop_1.jpg              # MacBook Pro
    ├── laptop_2.jpg              # MacBook 键盘
    ├── airpods_1.jpg             # AirPods Pro
    ├── ipad_1.jpg                # iPad Air
    ├── ipad_2.jpg                # iPad 配件
    ├── shoes_1.jpg               # Nike 运动鞋
    ├── shoes_2.jpg               # 鞋子侧面
    ├── book_1.jpg                # Python 编程书籍
    ├── band_1.jpg                # 小米手环
    ├── headphone_1.jpg           # Sony 耳机
    ├── headphone_2.jpg           # 耳机盒
    ├── mouse_1.jpg               # 罗技鼠标
    ├── kindle_1.jpg              # Kindle 阅读器
    ├── product_1.jpg             # 通用占位图 1
    ├── product_2.jpg             # 通用占位图 2
    └── product_3.jpg             # 通用占位图 3
```

## 📋 示例商品数据

`products_sample.csv` 包含 10 个示例商品：

| 商品 | 分类 | 价格 | 位置 |
|------|------|------|------|
| iPhone 15 Pro Max | 数码产品/手机/苹果 | ¥8999 | 北京市/朝阳区 |
| MacBook Pro 2023 | 数码产品/笔记本/苹果 | ¥12999 | 上海市/浦东新区 |
| AirPods Pro 2 | 数码产品/耳机/苹果 | ¥1599 | 广州市/天河区 |
| iPad Air 5 | 数码产品/平板/苹果 | ¥3299 | 深圳市/南山区 |
| Nike Air Max 270 | 服装鞋包/运动鞋/Nike | ¥899 | 杭州市/西湖区 |
| Python 编程书籍 | 图书音像/计算机/编程 | ¥39 | 成都市/武侯区 |
| 小米手环 8 | 数码产品/智能穿戴/小米 | ¥199 | 武汉市/洪山区 |
| Sony WH-1000XM4 | 数码产品/耳机/索尼 | ¥1299 | 南京市/鼓楼区 |
| 罗技 MX Master 3S | 数码产品/电脑配件/罗技 | ¥699 | 西安市/雁塔区 |
| Kindle Paperwhite 5 | 数码产品/电子书/亚马逊 | ¥599 | 重庆市/渝北区 |

## 🖼️ 示例图片

所有图片都是使用 PIL 生成的占位图，尺寸为 800x800，格式为 JPEG。

### 重新生成图片

如果需要重新生成示例图片：

```bash
python examples/generate_sample_images.py
```

这将在 `examples/images/` 目录下生成 18 张示例图片。

## 🚀 使用示例数据

### 1. 快速测试单个商品

```bash
python quick_test.py \
  --cookie-id test_001 \
  --title "全新 iPhone 15 Pro Max 256GB" \
  --price 8999.00 \
  --images examples/images/phone_1.jpg examples/images/phone_2.jpg
```

### 2. 从 CSV 批量发布

```python
import asyncio
import csv
from product_publisher import publish_products, ProductInfo

async def publish_from_csv():
    products = []
    
    with open('examples/products_sample.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            images = row['images'].split('|')
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
    
    results = await publish_products(
        cookie_id="test_001",
        cookies_str="your_cookie_here",
        products=products,
        headless=True
    )
    
    print(f"发布完成: 成功 {results['success']}/{results['total']}")

asyncio.run(publish_from_csv())
```

### 3. 性能测试

```bash
python benchmark_publish.py \
  --cookie-id test_001 \
  --csv examples/products_sample.csv \
  --batch-size 5
```

## 📝 CSV 文件格式

CSV 文件包含以下字段：

| 字段 | 说明 | 必填 | 示例 |
|------|------|------|------|
| title | 商品标题 | ✅ | 全新 iPhone 15 Pro Max 256GB |
| description | 商品描述 | ✅ | 全新未拆封，原装正品 |
| price | 商品价格 | ✅ | 8999.00 |
| images | 图片路径（用 \| 分隔） | ✅ | img1.jpg\|img2.jpg |
| category | 商品分类 | ❌ | 数码产品/手机/苹果 |
| location | 发货地 | ❌ | 北京市/朝阳区 |
| original_price | 原价 | ❌ | 9999.00 |
| stock | 库存数量 | ❌ | 1 |

## 🎨 自定义示例数据

### 添加新商品

编辑 `products_sample.csv`，添加新行：

```csv
新商品标题,新商品描述,价格,图片路径,分类,位置,原价,库存
```

### 添加新图片

1. 将图片放入 `examples/images/` 目录
2. 在 CSV 中引用图片路径
3. 确保图片格式为 JPG 或 PNG

### 生成自定义占位图

修改 `generate_sample_images.py`，添加新的图片定义：

```python
images = [
    ("my_product.jpg", "My Product\nName", (240, 240, 240)),
    # ... 更多图片
]
```

## ⚠️ 注意事项

1. **图片路径**：CSV 中的图片路径可以是相对路径或绝对路径
2. **图片格式**：支持 JPG、PNG 格式
3. **图片大小**：建议每张图片 < 5MB
4. **商品数量**：建议每次测试不超过 10 个商品
5. **测试账号**：使用测试账号进行测试，避免影响正式账号

## 📚 相关文档

- [商品发布功能文档](../PRODUCT_PUBLISH_README.md)
- [快速测试指南](../PRODUCT_PUBLISH_README.md#快速测试)
- [API 测试指南](../PRODUCT_PUBLISH_README.md#api-测试)
- [性能测试指南](../PRODUCT_PUBLISH_README.md#性能测试)
