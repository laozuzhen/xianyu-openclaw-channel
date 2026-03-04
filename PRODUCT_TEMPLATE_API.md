# 商品模板功能 API 文档

## 概述

为 xianyu-super-butler 项目添加了商品模板数据库支持，包括模板管理和发布历史记录功能。

## 数据库表结构

### 1. product_templates（商品模板表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 模板ID（自增） |
| user_id | INTEGER | 用户ID（外键关联users表） |
| name | TEXT | 模板名称 |
| category | TEXT | 分类路径 |
| location | TEXT | 位置 |
| description_template | TEXT | 描述模板（支持{title}等占位符） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 2. product_publish_history（商品发布历史表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 历史记录ID（自增） |
| user_id | INTEGER | 用户ID（外键关联users表） |
| cookie_id | TEXT | Cookie ID（外键关联cookies表） |
| title | TEXT | 商品标题 |
| price | REAL | 商品价格 |
| status | TEXT | 发布状态（success/failed） |
| error_message | TEXT | 错误信息（失败时） |
| published_at | TIMESTAMP | 发布时间 |

## 数据库管理方法

### 商品模板管理

#### 1. create_product_template()
创建商品模板

**参数:**
- `user_id` (int): 用户ID
- `name` (str): 模板名称
- `category` (str, 可选): 分类路径
- `location` (str, 可选): 位置
- `description_template` (str, 可选): 描述模板

**返回:** 模板ID（int）或 None（失败）

#### 2. get_product_templates()
获取用户的所有商品模板

**参数:**
- `user_id` (int): 用户ID

**返回:** 模板列表（List[Dict]）

#### 3. get_product_template_by_id()
获取单个商品模板

**参数:**
- `template_id` (int): 模板ID
- `user_id` (int): 用户ID（权限验证）

**返回:** 模板信息（Dict）或 None

#### 4. update_product_template()
更新商品模板

**参数:**
- `template_id` (int): 模板ID
- `user_id` (int): 用户ID（权限验证）
- `**kwargs`: 要更新的字段（name, category, location, description_template）

**返回:** 成功返回 True，失败返回 False

#### 5. delete_product_template()
删除商品模板

**参数:**
- `template_id` (int): 模板ID
- `user_id` (int): 用户ID（权限验证）

**返回:** 成功返回 True，失败返回 False

### 发布历史管理

#### 1. add_publish_history()
记录商品发布历史

**参数:**
- `user_id` (int): 用户ID
- `cookie_id` (str, 可选): Cookie ID
- `title` (str, 可选): 商品标题
- `price` (float, 可选): 商品价格
- `status` (str): 发布状态（success/failed，默认success）
- `error_message` (str, 可选): 错误信息

**返回:** 历史记录ID（int）或 None（失败）

#### 2. get_publish_history()
获取商品发布历史（分页）

**参数:**
- `user_id` (int): 用户ID
- `limit` (int): 每页数量（默认100）
- `offset` (int): 偏移量（默认0）

**返回:** 发布历史列表（List[Dict]）

#### 3. get_publish_statistics()
获取商品发布统计信息

**参数:**
- `user_id` (int): 用户ID

**返回:** 统计信息（Dict）
```python
{
    'total': 100,        # 总数
    'success': 85,       # 成功数
    'failed': 15,        # 失败数
    'success_rate': 85.0 # 成功率（%）
}
```

## API 端点

### 商品模板 API

#### 1. GET /api/products/templates
获取商品模板列表

**认证:** 需要登录

**响应:**
```json
{
    "success": true,
    "templates": [
        {
            "id": 1,
            "user_id": 1,
            "name": "数码产品模板",
            "category": "数码产品/手机/苹果",
            "location": "北京市/朝阳区",
            "description_template": "全新{title}，原装正品，支持验货。",
            "created_at": "2024-01-01 12:00:00",
            "updated_at": "2024-01-01 12:00:00"
        }
    ]
}
```

#### 2. POST /api/products/templates
创建商品模板

**认证:** 需要登录

**请求体:**
```json
{
    "name": "数码产品模板",
    "category": "数码产品/手机/苹果",
    "location": "北京市/朝阳区",
    "description_template": "全新{title}，原装正品，支持验货。"
}
```

**响应:**
```json
{
    "success": true,
    "message": "模板创建成功",
    "template_id": 1
}
```

#### 3. PUT /api/products/templates/{template_id}
更新商品模板

**认证:** 需要登录

**请求体:**
```json
{
    "name": "更新后的模板名称",
    "location": "上海市/浦东新区"
}
```

**响应:**
```json
{
    "success": true,
    "message": "模板更新成功"
}
```

#### 4. DELETE /api/products/templates/{template_id}
删除商品模板

**认证:** 需要登录

**响应:**
```json
{
    "success": true,
    "message": "模板删除成功"
}
```

### 发布历史 API

#### 1. GET /api/products/publish-history
获取商品发布历史

**认证:** 需要登录

**查询参数:**
- `limit` (int, 可选): 每页数量（默认100，最大1000）
- `offset` (int, 可选): 偏移量（默认0）

**响应:**
```json
{
    "success": true,
    "history": [
        {
            "id": 1,
            "user_id": 1,
            "cookie_id": "cookie_123",
            "title": "iPhone 15 Pro",
            "price": 7999.0,
            "status": "success",
            "error_message": null,
            "published_at": "2024-01-01 12:00:00"
        }
    ]
}
```

#### 2. GET /api/products/publish-statistics
获取商品发布统计信息

**认证:** 需要登录

**响应:**
```json
{
    "success": true,
    "statistics": {
        "total": 100,
        "success": 85,
        "failed": 15,
        "success_rate": 85.0
    }
}
```

## 使用示例

### Python 示例

```python
from db_manager import db_manager

# 创建模板
template_id = db_manager.create_product_template(
    user_id=1,
    name="数码产品模板",
    category="数码产品/手机/苹果",
    location="北京市/朝阳区",
    description_template="全新{title}，原装正品，支持验货。"
)

# 获取模板列表
templates = db_manager.get_product_templates(user_id=1)

# 更新模板
db_manager.update_product_template(
    template_id=template_id,
    user_id=1,
    name="更新后的模板"
)

# 记录发布历史
db_manager.add_publish_history(
    user_id=1,
    cookie_id="cookie_123",
    title="iPhone 15 Pro",
    price=7999.0,
    status="success"
)

# 获取发布统计
stats = db_manager.get_publish_statistics(user_id=1)
print(f"成功率: {stats['success_rate']}%")
```

### JavaScript/前端示例

```javascript
// 获取模板列表
const response = await fetch('/api/products/templates', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
const data = await response.json();

// 创建模板
await fetch('/api/products/templates', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: "数码产品模板",
        category: "数码产品/手机/苹果",
        location: "北京市/朝阳区",
        description_template: "全新{title}，原装正品，支持验货。"
    })
});

// 获取发布统计
const statsResponse = await fetch('/api/products/publish-statistics', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
const stats = await statsResponse.json();
console.log(`成功率: ${stats.statistics.success_rate}%`);
```

## 测试

运行测试脚本验证功能:

```bash
cd xianyu-super-butler-repo
python test_product_templates.py
```

测试覆盖:
- ✓ 创建商品模板
- ✓ 获取模板列表
- ✓ 获取单个模板
- ✓ 更新模板
- ✓ 删除模板
- ✓ 记录发布历史
- ✓ 获取发布历史
- ✓ 获取发布统计

## 注意事项

1. **权限控制**: 所有模板操作都会验证 user_id，确保用户只能操作自己的模板
2. **数据隔离**: 每个用户的模板和发布历史是独立的
3. **外键约束**: 
   - 删除用户时会级联删除其模板和发布历史
   - 删除 Cookie 时会将发布历史中的 cookie_id 设为 NULL
4. **时间戳**: 所有时间字段使用 SQLite 的 CURRENT_TIMESTAMP
5. **描述模板**: 支持占位符（如 {title}），可在发布时动态替换

## 更新日志

### 2024-01-01
- ✅ 添加 product_templates 表
- ✅ 添加 product_publish_history 表
- ✅ 实现模板 CRUD 操作
- ✅ 实现发布历史记录和统计
- ✅ 添加 REST API 端点
- ✅ 完成功能测试
