# 商品发布功能测试指南

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install playwright pytest pytest-asyncio requests pillow loguru

# 安装浏览器
playwright install chromium
```

### 2. 配置 Cookie

```bash
# 方式 1: 环境变量
export XIANYU_COOKIE="your_cookie_here"
export XIANYU_TEST_COOKIE="your_test_cookie_here"

# 方式 2: 直接在命令中指定
python quick_test.py --cookie "your_cookie_here" ...
```

### 3. 生成示例数据（如果还没有）

```bash
cd xianyu-super-butler-repo
python examples/generate_sample_images.py
```

## 🧪 测试方式

### 方式 1: 快速测试（推荐新手）

最简单的测试方式，适合快速验证功能：

```bash
# 基本测试
python quick_test.py \
  --cookie-id test_001 \
  --title "测试商品" \
  --price 99.00 \
  --images examples/images/product_1.jpg

# 使用示例数据
python quick_test.py \
  --cookie-id test_001 \
  --title "全新 iPhone 15 Pro Max 256GB" \
  --price 8999.00 \
  --images examples/images/phone_1.jpg examples/images/phone_2.jpg

# 非无头模式（可以看到浏览器操作）
python quick_test.py \
  --cookie-id test_001 \
  --title "测试商品" \
  --price 99.00 \
  --images examples/images/product_1.jpg \
  --no-headless
```

### 方式 2: pytest 测试套件

完整的单元测试和集成测试：

```bash
# 运行所有测试
pytest test_product_publish.py -v

# 运行特定测试
pytest test_product_publish.py::TestProductPublisher::test_browser_init -v

# 显示详细输出
pytest test_product_publish.py -v -s

# 只运行不需要 Cookie 的测试
pytest test_product_publish.py -v -k "not cookie"
```

### 方式 3: API 测试

测试 HTTP API 端点：

```bash
# 启动服务器（另一个终端）
python reply_server.py

# 运行 API 测试
python test_api.py \
  --base-url http://localhost:8000 \
  --token your_api_token \
  --cookie-id test_001
```

### 方式 4: 性能测试

测试批量发布性能：

```bash
# 使用示例 CSV
python benchmark_publish.py \
  --cookie-id test_001 \
  --csv examples/products_sample.csv \
  --batch-size 5 \
  --output benchmark_results.json

# 查看结果
cat benchmark_results.json
cat benchmark_results.csv
```

## 📋 测试场景

### 场景 1: 首次测试

```bash
# 1. 生成示例图片
python examples/generate_sample_images.py

# 2. 快速测试单个商品
export XIANYU_COOKIE="your_cookie_here"
python quick_test.py \
  --cookie-id test_001 \
  --title "测试商品" \
  --price 99.00 \
  --images examples/images/product_1.jpg \
  --no-headless
```

### 场景 2: 批量测试

```bash
# 使用示例 CSV 批量发布
python benchmark_publish.py \
  --cookie-id test_001 \
  --csv examples/products_sample.csv \
  --batch-size 3
```

### 场景 3: 调试模式

```bash
# 非无头模式，可以看到浏览器操作
python quick_test.py \
  --cookie-id test_001 \
  --title "调试测试" \
  --price 99.00 \
  --images examples/images/product_1.jpg \
  --no-headless
```

### 场景 4: API 集成测试

```bash
# 1. 启动服务器
python reply_server.py &

# 2. 运行 API 测试
python test_api.py
```

## 🔍 测试结果说明

### 成功标志

```
✅ 商品发布成功!
```

### 失败原因

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| Cookie 登录失败 | Cookie 过期或无效 | 重新获取 Cookie |
| 图片文件不存在 | 图片路径错误 | 检查图片路径或重新生成 |
| 选择器失效 | 闲鱼页面更新 | 更新 product_publisher.py 中的选择器 |
| 验证码出现 | 触发风控 | 降低发布频率，使用测试账号 |

## 📊 性能测试报告示例

```
📊 性能测试报告
============================================================

📈 总体统计:
  总运行次数: 10
  成功次数: 9
  失败次数: 1
  成功率: 90.00%

⏱️  耗时统计:
  总耗时: 450.23 秒
  平均耗时: 45.02 秒/商品
  最快: 38.15 秒
  最慢: 52.67 秒
  吞吐量: 0.02 商品/秒
```

## ⚠️ 注意事项

### 1. Cookie 安全

- 不要在公共环境中暴露 Cookie
- 定期更换测试 Cookie
- 使用测试账号进行测试

### 2. 测试频率

- 每天测试不超过 10-20 次
- 测试间隔至少 5-15 秒
- 避免深夜或凌晨测试

### 3. 图片要求

- 格式: JPG、PNG
- 大小: < 5MB
- 尺寸: 建议 800x800 或更大

### 4. 测试账号

- 使用专门的测试账号
- 不要在正式账号上频繁测试
- 注意账号安全

## 🐛 常见问题

### Q1: 测试时提示 "需要配置有效的测试 Cookie"？

**A:** 设置环境变量：
```bash
export XIANYU_TEST_COOKIE="your_valid_cookie"
```

### Q2: 图片文件不存在？

**A:** 先生成示例图片：
```bash
python examples/generate_sample_images.py
```

### Q3: pytest 测试被跳过？

**A:** 这是正常的，没有有效 Cookie 的测试会自动跳过。配置 Cookie 后即可运行。

### Q4: 如何获取 Cookie？

**A:** 
1. 打开浏览器，登录闲鱼
2. 按 F12 打开开发者工具
3. 切换到 Network 标签
4. 刷新页面
5. 找到任意请求，查看 Request Headers 中的 Cookie

### Q5: 测试失败如何调试？

**A:** 使用非无头模式查看浏览器操作：
```bash
python quick_test.py --no-headless ...
```

### Q6: 性能测试结果在哪里？

**A:** 
- JSON 格式: `benchmark_results.json`
- CSV 格式: `benchmark_results.csv`

## 📚 相关文档

- [商品发布功能文档](PRODUCT_PUBLISH_README.md)
- [示例数据说明](examples/README.md)
- [API 文档](PRODUCT_PUBLISH_README.md#api-端点)

## 🤝 反馈

如果遇到问题或有改进建议，请提交 Issue。
