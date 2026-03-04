# 闲鱼爬虫集成方案

## 📋 项目分析

### 目标项目
- **原始需求**: `github.com/superboyyy/xianyu_spider` (不存在)
- **替代方案**: 
  - `Shayne-Gao/xianyu_spider` - Scrapy框架，支持价格区间筛选
  - `tss12/python-xianyu-spider` - 简单爬虫，BeautifulSoup实现

### 现有项目架构
`xianyu-super-butler-repo` 是一个完整的闲鱼自动化管理系统：
- **核心功能**: WebSocket实时消息、自动回复、自动发货
- **技术栈**: Python 3.11+, FastAPI, Playwright
- **架构**: Bridge API + OpenClaw Channel Plugin
- **数据库**: SQLite (data/xianyu_data.db)

## 🎯 集成目标

将闲鱼商品爬虫功能集成到现有系统，实现：
1. 商品搜索和数据采集
2. 价格监控和通知
3. 商品信息存储
4. OpenClaw工具暴露

## 🔍 技术方案分析

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **方案A: 复用tss12爬虫** | 代码简单，易理解 | 基于旧API，可能失效 | ⭐⭐ |
| **方案B: 使用Playwright** | 与现有技术栈一致，稳定 | 需要浏览器，资源占用高 | ⭐⭐⭐⭐⭐ |
| **方案C: 使用Scrapy** | 专业爬虫框架，功能强 | 引入新依赖，学习成本高 | ⭐⭐⭐ |

### 推荐方案: Playwright + 现有架构

**理由**:
- ✅ 项目已使用Playwright (order_status_query_playwright.py)
- ✅ 可复用现有的browser_pool.py
- ✅ 可绕过反爬虫机制
- ✅ 与现有代码风格一致


## 📦 集成方案设计

### 1. 项目内复用现有代码

**已发现可复用模块**:

#### 📝 `utils/browser_pool.py` - 浏览器池管理
- **用途**: Playwright浏览器实例管理，支持并发控制
- **当前使用者**: 
  - `order_status_query_playwright.py` (订单状态查询)
  - `product_publisher.py` (商品发布)
- **复用理由**: 
  - 已实现浏览器复用和资源管理
  - 支持Cookie注入
  - 避免重复创建浏览器实例
- **注意事项**: 需要传入正确的Cookie字符串

#### 📝 `utils/item_search.py` - 商品搜索工具
- **用途**: 闲鱼商品搜索功能（如果存在）
- **需要检查**: 是否已有搜索实现

### 2. 新增模块设计

#### `utils/xianyu_spider.py` - 闲鱼爬虫核心

```python
"""
闲鱼商品爬虫模块
复用 browser_pool.py 实现商品搜索和数据采集
"""

from typing import List, Dict, Optional
from playwright.async_api import Page
from utils.browser_pool import BrowserPool
from loguru import logger

class XianyuSpider:
    """闲鱼商品爬虫"""
    
    def __init__(self, cookie_str: str):
        self.cookie_str = cookie_str
        self.browser_pool = BrowserPool()
    
    async def search_products(
        self, 
        keyword: str, 
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        max_pages: int = 5
    ) -> List[Dict]:
        """搜索商品"""
        pass
    
    async def get_product_detail(self, product_id: str) -> Dict:
        """获取商品详情"""
        pass
```

#### Bridge API 端点扩展

在 `bridge_api.py` 中添加爬虫相关接口：

```python
# 商品搜索
@bridge_router.post("/spider/search")
async def spider_search(body: SpiderSearchRequest):
    """搜索闲鱼商品"""
    pass

# 商品详情
@bridge_router.get("/spider/product/{product_id}")
async def spider_get_product(product_id: str, accountId: str = "default"):
    """获取商品详情"""
    pass

# 价格监控
@bridge_router.post("/spider/monitor")
async def spider_monitor(body: MonitorRequest):
    """添加价格监控任务"""
    pass
```


## ✅ 重大发现：项目已有完整爬虫实现！

### 📝 现有实现分析

#### `utils/item_search.py` - 完整的闲鱼爬虫
- **用途**: 基于 Playwright 的闲鱼商品搜索和数据采集
- **当前使用者**: 
  - `reply_server.py` (API 端点 `/items/search`, `/items/search_multiple`)
  - 前端商品搜索页面
- **核心功能**:
  - ✅ 商品搜索 (`search_items`)
  - ✅ 多页搜索 (`search_multiple_pages`)
  - ✅ 滑块验证处理 (`handle_slider_verification`)
  - ✅ Cookie 管理
  - ✅ 浏览器池复用
- **技术特点**:
  - 使用持久化浏览器上下文（缓存复用）
  - 支持刮刮乐和普通滑块验证
  - 远程控制验证码处理
  - 完整的错误处理和重试机制

#### `reply_server.py` - API 端点
```python
@app.post("/items/search")
async def search_items(search_request: ItemSearchRequest)

@app.post("/items/search_multiple")
async def search_multiple_pages(search_request: ItemSearchMultipleRequest)
```

## 🎯 集成结论

**原始需求中的 `github.com/superboyyy/xianyu_spider` 项目不存在，但现有项目已经实现了更强大的爬虫功能！**

### 现有实现 vs 外部爬虫对比

| 功能 | 现有实现 | tss12/python-xianyu-spider | Shayne-Gao/xianyu_spider |
|------|----------|---------------------------|-------------------------|
| 技术栈 | Playwright | BeautifulSoup | Scrapy |
| 反爬处理 | ✅ 完整 | ❌ 无 | ⚠️ 基础 |
| Cookie管理 | ✅ 自动 | ❌ 手动 | ⚠️ 配置 |
| 滑块验证 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| 多页搜索 | ✅ 支持 | ⚠️ 循环 | ✅ 支持 |
| API接口 | ✅ FastAPI | ❌ 无 | ❌ 无 |
| 数据存储 | ✅ SQLite | ❌ 文件 | ⚠️ 邮件 |
| 实时性 | ✅ 高 | ❌ 低 | ❌ 低 |


## 🚀 OpenClaw 工具集成方案

### 方案设计

将现有的商品搜索功能暴露为 OpenClaw 工具，让 AI Agent 可以直接调用。

### 实施步骤

#### 1. 在 `bridge_api.py` 中添加爬虫工具端点

```python
# ==================== 商品爬虫工具 ====================

class SpiderSearchRequest(BaseModel):
    """商品搜索请求"""
    accountId: Optional[str] = "default"
    keyword: str
    page: Optional[int] = 1
    pageSize: Optional[int] = 20
    minPrice: Optional[float] = None
    maxPrice: Optional[float] = None

class SpiderMultiPageRequest(BaseModel):
    """多页搜索请求"""
    accountId: Optional[str] = "default"
    keyword: str
    totalPages: Optional[int] = 3
    minPrice: Optional[float] = None
    maxPrice: Optional[float] = None

@bridge_router.post("/spider/search")
async def spider_search_products(body: SpiderSearchRequest):
    """搜索闲鱼商品（单页）"""
    try:
        from utils.item_search import search_xianyu_items
        
        logger.info(f"[Spider] 搜索商品: keyword={body.keyword}, page={body.page}")
        
        result = await search_xianyu_items(
            keyword=body.keyword,
            page=body.page,
            page_size=body.pageSize
        )
        
        # 价格过滤
        if body.minPrice or body.maxPrice:
            items = result.get('items', [])
            filtered_items = []
            for item in items:
                price = item.get('price', 0)
                if body.minPrice and price < body.minPrice:
                    continue
                if body.maxPrice and price > body.maxPrice:
                    continue
                filtered_items.append(item)
            result['items'] = filtered_items
            result['total'] = len(filtered_items)
        
        return {"ok": True, "data": result}
    except Exception as e:
        logger.error(f"[Spider] 搜索失败: {e}")
        return {"ok": False, "error": str(e)}

@bridge_router.post("/spider/search-multi")
async def spider_search_multi_pages(body: SpiderMultiPageRequest):
    """搜索闲鱼商品（多页）"""
    try:
        from utils.item_search import search_multiple_pages_xianyu
        
        logger.info(f"[Spider] 多页搜索: keyword={body.keyword}, pages={body.totalPages}")
        
        result = await search_multiple_pages_xianyu(
            keyword=body.keyword,
            total_pages=body.totalPages
        )
        
        # 价格过滤
        if body.minPrice or body.maxPrice:
            items = result.get('items', [])
            filtered_items = []
            for item in items:
                price = item.get('price', 0)
                if body.minPrice and price < body.minPrice:
                    continue
                if body.maxPrice and price > body.maxPrice:
                    continue
                filtered_items.append(item)
            result['items'] = filtered_items
            result['total'] = len(filtered_items)
        
        return {"ok": True, "data": result}
    except Exception as e:
        logger.error(f"[Spider] 多页搜索失败: {e}")
        return {"ok": False, "error": str(e)}

@bridge_router.get("/spider/product/{product_id}")
async def spider_get_product_detail(product_id: str, accountId: str = "default"):
    """获取商品详情"""
    try:
        # TODO: 实现商品详情获取
        logger.info(f"[Spider] 获取商品详情: {product_id}")
        return {"ok": True, "message": "商品详情功能待实现"}
    except Exception as e:
        logger.error(f"[Spider] 获取商品详情失败: {e}")
        return {"ok": False, "error": str(e)}
```

#### 2. 在 OpenClaw Plugin 中注册工具

在 `openclaw-plugin/src/tools.ts` (新建文件):

```typescript
import { Tool } from '@openclaw/types';

export const xianyuSpiderTools: Tool[] = [
  {
    name: 'xianyu_search_products',
    description: '搜索闲鱼商品（单页）',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词'
        },
        page: {
          type: 'number',
          description: '页码（默认1）',
          default: 1
        },
        pageSize: {
          type: 'number',
          description: '每页数量（默认20）',
          default: 20
        },
        minPrice: {
          type: 'number',
          description: '最低价格（可选）'
        },
        maxPrice: {
          type: 'number',
          description: '最高价格（可选）'
        }
      },
      required: ['keyword']
    },
    handler: async (params) => {
      const response = await fetch('http://localhost:8080/api/bridge/spider/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return await response.json();
    }
  },
  {
    name: 'xianyu_search_multi_pages',
    description: '搜索闲鱼商品（多页）',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词'
        },
        totalPages: {
          type: 'number',
          description: '总页数（默认3）',
          default: 3
        },
        minPrice: {
          type: 'number',
          description: '最低价格（可选）'
        },
        maxPrice: {
          type: 'number',
          description: '最高价格（可选）'
        }
      },
      required: ['keyword']
    },
    handler: async (params) => {
      const response = await fetch('http://localhost:8080/api/bridge/spider/search-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return await response.json();
    }
  }
];
```


## 📝 使用示例

### 1. 直接调用 API

```bash
# 搜索单页商品
curl -X POST http://localhost:8080/api/bridge/spider/search \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "游泳卡",
    "page": 1,
    "pageSize": 20,
    "minPrice": 100,
    "maxPrice": 1200
  }'

# 搜索多页商品
curl -X POST http://localhost:8080/api/bridge/spider/search-multi \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "游泳卡",
    "totalPages": 5,
    "minPrice": 100,
    "maxPrice": 1200
  }'
```

### 2. OpenClaw Agent 调用

```javascript
// AI Agent 可以这样调用
const result = await tools.xianyu_search_products({
  keyword: "游泳卡",
  minPrice: 100,
  maxPrice: 1200
});

console.log(`找到 ${result.data.total} 个商品`);
result.data.items.forEach(item => {
  console.log(`${item.title} - ¥${item.price}`);
});
```

### 3. Python 代码调用

```python
from utils.item_search import search_xianyu_items

# 搜索商品
result = await search_xianyu_items(
    keyword="游泳卡",
    page=1,
    page_size=20
)

# 过滤价格
items = [
    item for item in result['items']
    if 100 <= item['price'] <= 1200
]

print(f"找到 {len(items)} 个符合条件的商品")
```

## 🎯 功能扩展建议

### 1. 价格监控

在 `db_manager.py` 中添加价格监控表：

```python
def create_price_monitor_table():
    """创建价格监控表"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_monitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id TEXT NOT NULL,
            keyword TEXT NOT NULL,
            min_price REAL,
            max_price REAL,
            notify_method TEXT DEFAULT 'message',
            enabled INTEGER DEFAULT 1,
            last_check TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
```

### 2. 定时任务

使用现有的 `cron` 系统添加定时搜索任务：

```json
{
  "id": "price-monitor-swimming-card",
  "name": "游泳卡价格监控",
  "schedule": "0 */2 * * *",
  "action": {
    "type": "api_call",
    "endpoint": "/api/bridge/spider/search-multi",
    "params": {
      "keyword": "游泳卡",
      "totalPages": 3,
      "minPrice": 100,
      "maxPrice": 1200
    }
  }
}
```

### 3. 数据分析

添加商品数据分析功能：

```python
async def analyze_price_trend(keyword: str, days: int = 7):
    """分析商品价格趋势"""
    # 从数据库获取历史搜索数据
    # 计算平均价格、价格区间、热门卖家等
    pass
```

## ⚠️ 注意事项

1. **Cookie 有效性**: 确保数据库中有有效的闲鱼 Cookie
2. **滑块验证**: 首次搜索可能需要人工处理滑块验证
3. **频率限制**: 避免过于频繁的搜索请求，建议间隔 2-5 秒
4. **数据存储**: 搜索结果可以存储到数据库供后续分析

## 📊 数据结构

### 搜索结果格式

```json
{
  "ok": true,
  "data": {
    "keyword": "游泳卡",
    "page": 1,
    "total": 15,
    "items": [
      {
        "id": "123456789",
        "title": "某某健身房游泳卡转让",
        "price": 800.0,
        "originalPrice": 1200.0,
        "location": "北京市朝阳区",
        "seller": {
          "id": "seller123",
          "name": "用户昵称",
          "avatar": "https://..."
        },
        "images": ["https://..."],
        "url": "https://goofish.com/item/...",
        "publishTime": "2024-01-01 12:00:00"
      }
    ]
  }
}
```

## 🔗 相关文件

- `utils/item_search.py` - 爬虫核心实现
- `reply_server.py` - API 端点
- `bridge_api.py` - Bridge API（需要添加爬虫端点）
- `openclaw-plugin/` - OpenClaw 插件（需要注册工具）

## ✅ 总结

**无需集成外部爬虫项目！** 现有系统已经实现了比外部项目更强大的功能：

1. ✅ 完整的 Playwright 爬虫实现
2. ✅ 滑块验证自动处理
3. ✅ Cookie 管理和持久化
4. ✅ FastAPI 接口暴露
5. ✅ 多页搜索支持
6. ✅ 错误处理和重试机制

**下一步行动**:
1. 在 `bridge_api.py` 中添加爬虫工具端点（复制上面的代码）
2. 在 OpenClaw Plugin 中注册工具
3. 测试 API 端点
4. 配置定时任务（可选）
5. 添加价格监控功能（可选）

