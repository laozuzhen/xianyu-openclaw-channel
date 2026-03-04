# 闲鱼商品搜索爬虫集成总结

## 📦 集成来源

**参考项目**: `superboyyy/xianyu_spider`  
**集成方式**: 复制核心爬虫逻辑，适配现有项目架构

## ✅ 已完成的工作

### 1. 爬虫模块 (`product_spider.py`)

**📝 功能**:
- 基于 Playwright 的闲鱼商品搜索爬虫
- 支持多页搜索
- 自动数据去重（基于链接哈希）
- 反检测策略（User-Agent、反爬虫脚本注入）

**📦 复用的组件**:
- `product_publisher.py` 的反爬虫配置
- `cookie_manager.py` 的 Cookie 管理
- `db_manager.py` 的数据库管理

**🔑 核心类**:
```python
class XianyuProductSpider:
    async def init_browser()           # 初始化浏览器
    async def login_with_cookie()      # Cookie 登录
    async def search_products()        # 搜索商品
    async def _save_to_db()            # 保存到数据库
```

**🔧 辅助函数**:
```python
get_md5(text)                          # MD5 哈希
get_link_unique_key(link)              # 链接去重
safe_get(data, *keys)                  # 安全获取嵌套字典值
search_xianyu_products()               # 便捷函数
```

---

### 2. 数据库扩展 (`db_manager.py`)

**新增表**: `spider_products`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| title | TEXT | 商品标题 |
| price | TEXT | 价格 |
| area | TEXT | 发货地区 |
| seller | TEXT | 卖家昵称 |
| link | TEXT | 商品链接 |
| link_hash | TEXT | 链接哈希（唯一索引） |
| image_url | TEXT | 商品图片链接 |
| publish_time | TIMESTAMP | 发布时间 |
| created_at | TIMESTAMP | 创建时间 |

**新增方法**:
```python
save_spider_product()                  # 保存爬虫商品
get_spider_product_by_hash()           # 根据哈希查询
get_spider_products()                  # 获取商品列表
count_spider_products()                # 统计总数
```

---

### 3. Bridge API 端点 (`bridge_api.py`)

#### POST `/api/bridge/spider/search`
**功能**: 单页商品搜索

**请求参数**:
```json
{
  "cookie_id": "账号Cookie ID",
  "keyword": "搜索关键词",
  "max_pages": 1
}
```

**响应**:
```json
{
  "ok": true,
  "keyword": "搜索关键词",
  "total_results": 50,
  "new_records": 10,
  "new_record_ids": [1, 2, 3, ...]
}
```

#### POST `/api/bridge/spider/search-multi`
**功能**: 多页商品搜索

**请求参数**:
```json
{
  "cookie_id": "账号Cookie ID",
  "keyword": "搜索关键词",
  "max_pages": 5
}
```

#### GET `/api/bridge/spider/products`
**功能**: 获取爬虫商品列表

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）

**响应**:
```json
{
  "ok": true,
  "products": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

### 4. OpenClaw 工具注册 (`openclaw-plugin/index.ts`)

#### 工具 1: `xianyu_search_products`
**功能**: 搜索闲鱼商品

**参数**:
- `cookie_id` (必填): 账号 Cookie ID
- `keyword` (必填): 搜索关键词
- `max_pages` (可选): 最大页数（默认1）

**使用场景**:
- 市场调研
- 竞品分析
- 价格监控

#### 工具 2: `xianyu_get_spider_products`
**功能**: 获取已爬取的商品列表

**参数**:
- `page` (可选): 页码（默认1）
- `limit` (可选): 每页数量（默认20）

---

## 🔄 数据流程

```
用户请求 (OpenClaw)
    ↓
OpenClaw 工具 (xianyu_search_products)
    ↓
Bridge API (/api/bridge/spider/search)
    ↓
product_spider.py (XianyuProductSpider)
    ↓
Playwright 浏览器 → 闲鱼网站
    ↓
解析 API 响应 (h5api.m.goofish.com)
    ↓
数据去重 (link_hash)
    ↓
db_manager.py (save_spider_product)
    ↓
SQLite 数据库 (spider_products 表)
    ↓
返回结果 (总数、新增数、ID列表)
```

---

## 🆚 与现有爬虫的区别

| 特性 | 现有爬虫 (`product_publisher.py`) | 新爬虫 (`product_spider.py`) |
|------|----------------------------------|------------------------------|
| **用途** | 发布商品（爬自己的商品） | 搜索商品（爬所有商品） |
| **目标** | 自动发布到闲鱼 | 市场调研、竞品分析 |
| **数据来源** | 用户输入的商品信息 | 闲鱼搜索结果 |
| **数据存储** | 不存储（直接发布） | 存储到 `spider_products` 表 |
| **反爬虫** | ✅ 完整的反检测策略 | ✅ 复用相同的反检测策略 |

---

## 🔧 使用示例

### 1. 通过 OpenClaw 搜索商品

```typescript
// 在 OpenClaw 中调用工具
await api.callTool("xianyu_search_products", {
  cookie_id: "account_123",
  keyword: "iPhone 15",
  max_pages: 3
});
```

### 2. 通过 Bridge API 搜索商品

```bash
curl -X POST http://localhost:8080/api/bridge/spider/search \
  -H "Content-Type: application/json" \
  -d '{
    "cookie_id": "account_123",
    "keyword": "iPhone 15",
    "max_pages": 3
  }'
```

### 3. 获取爬虫商品列表

```bash
curl http://localhost:8080/api/bridge/spider/products?page=1&limit=20
```

---

## ⚠️ 注意事项

### 1. Cookie 管理
- 搜索商品需要登录 Cookie
- 使用 `cookie_manager.get_cookie(cookie_id)` 获取
- Cookie 失效时需要重新登录

### 2. 反爬虫策略
- 已集成 Playwright 反检测配置
- 随机 User-Agent
- 注入反检测脚本
- 建议控制爬取频率，避免触发风控

### 3. 数据去重
- 使用链接哈希 (`link_hash`) 去重
- 截取链接中第一个 `&` 之前的内容作为唯一标识
- 重复商品会被自动跳过

### 4. 性能建议
- 单次搜索建议不超过 5 页
- 大量搜索任务建议分批执行
- 可以通过 `max_pages` 参数控制爬取深度

---

## 🚀 后续扩展建议

### 1. 定时任务
- 添加定时搜索功能
- 监控特定关键词的商品变化
- 价格变动提醒

### 2. 数据分析
- 价格趋势分析
- 热门商品统计
- 卖家信誉分析

### 3. 导出功能
- 导出为 Excel
- 导出为 CSV
- 生成分析报告

### 4. 高级筛选
- 按价格区间筛选
- 按地区筛选
- 按发布时间筛选

---

## 📚 参考资料

- **原始项目**: [superboyyy/xianyu_spider](https://github.com/superboyyy/xianyu_spider)
- **分析报告**: `superboyyy-xianyu-spider/ANALYSIS.md`
- **Playwright 文档**: https://playwright.dev/python/
- **闲鱼 API**: h5api.m.goofish.com/h5/mtop.taobao.idlemtopsearch.pc.search

---

## ✅ 集成完成清单

- [x] 创建 `product_spider.py` 爬虫模块
- [x] 扩展 `db_manager.py` 数据库方法
- [x] 添加 `spider_products` 数据库表
- [x] 添加 Bridge API 端点
- [x] 注册 OpenClaw 工具
- [x] 编写集成文档

---

## 🎯 测试建议

### 1. 单元测试
```python
# 测试爬虫基本功能
async def test_spider():
    spider = XianyuProductSpider("test_id", "test_cookie")
    await spider.init_browser()
    results = await spider.search_products("测试关键词", 1)
    assert results[0] > 0  # 总结果数
```

### 2. 集成测试
```bash
# 测试 Bridge API
curl -X POST http://localhost:8080/api/bridge/spider/search \
  -H "Content-Type: application/json" \
  -d '{"cookie_id": "test", "keyword": "测试", "max_pages": 1}'
```

### 3. OpenClaw 测试
- 在 OpenClaw 中调用 `xianyu_search_products` 工具
- 验证返回结果格式
- 检查数据库中的新增记录

---

**集成完成时间**: 2024-01-XX  
**集成人员**: Kiro AI Assistant  
**版本**: v1.0
