# 商品发布前端功能说明

## 📦 已创建的文件

### 1. API 服务层
- **`lib/request.ts`** - HTTP 请求工具（简化版，不依赖 axios）
- **`services/productService.ts`** - 商品发布 API 服务

### 2. 前端组件
- **`components/ProductPublish.tsx`** - 单个商品发布页面
- **`components/BatchProductPublish.tsx`** - 批量商品发布页面

### 3. 路由和导航
- **`App.tsx`** - 添加了 `publish` 和 `batch-publish` 路由
- **`components/Sidebar.tsx`** - 添加了"发布商品"和"批量发布"菜单项

## ✨ 功能特性

### 单个商品发布 (`/publish`)
- ✅ 选择发布账号（从已启用账号列表）
- ✅ 商品标题（最多 60 字符）
- ✅ 商品描述（最多 500 字符）
- ✅ 价格、原价、库存设置
- ✅ 分类和位置选择
- ✅ 多图上传（最多 9 张，支持预览和删除）
- ✅ 实时表单验证
- ✅ 发布进度显示
- ✅ 成功/失败提示弹窗

### 批量商品发布 (`/batch-publish`)
- ✅ CSV 文件上传
- ✅ 商品列表预览（表格形式）
- ✅ 单个商品删除
- ✅ 批量发布进度显示
- ✅ 发布结果统计（总数/成功/失败）
- ✅ 失败商品详情展示
- ✅ CSV 模板下载

## 🎨 UI 设计

### 复用的设计元素
- **卡片样式**: `.ios-card` - 圆角卡片，悬停效果
- **输入框**: `.ios-input` - 闲鱼风格输入框，聚焦高亮
- **按钮**: `.ios-btn-primary` - 黄色主按钮，悬停动画
- **弹窗**: `.modal-overlay-centered` - 居中模态框
- **图标**: Lucide React 图标库

### 颜色方案
- **主色**: `#FFE815` (闲鱼黄)
- **背景**: `#F4F5F7` (浅灰)
- **文字**: `#111111` (深黑)
- **成功**: 绿色系
- **失败**: 红色系

## 🔌 API 端点

### 后端需要实现的接口

```typescript
// 1. 发布单个商品
POST /api/products/publish
Body: {
  cookie_id: string,
  title: string,
  description: string,
  price: number,
  images: string[],
  category?: string,
  location?: string,
  original_price?: number,
  stock?: number
}
Response: {
  success: boolean,
  message: string,
  product?: { title: string, price: number }
}

// 2. 批量发布商品
POST /api/products/batch-publish
Body: {
  cookie_id: string,
  products: ProductInfo[]
}
Response: {
  success: boolean,
  message: string,
  results: {
    total: number,
    success: number,
    failed: number,
    details: Array<{
      title: string,
      status: 'success' | 'failed',
      error?: string
    }>
  }
}

// 3. 获取商品模板
GET /api/products/templates
Response: {
  success: boolean,
  templates: Array<{
    id: string,
    name: string,
    category: string,
    location: string,
    description_template: string
  }>
}

// 4. 上传图片
POST /api/products/upload-image
Body: FormData { image: File }
Response: {
  success: boolean,
  url: string,
  message?: string
}
```

## 📝 CSV 文件格式

### 表头
```csv
title,description,price,images,category,location,original_price,stock
```

### 示例数据
```csv
title,description,price,images,category,location,original_price,stock
全新 iPhone 15,全新未拆封,8999.00,img1.jpg|img2.jpg,数码产品/手机/苹果,北京市/朝阳区,9999.00,1
二手 MacBook Pro,9成新,12999.00,img3.jpg|img4.jpg,数码产品/笔记本/苹果,上海市/浦东新区,15999.00,1
```

### 字段说明
- **images**: 使用 `|` 分隔多张图片路径
- **price/original_price**: 数字格式，保留两位小数
- **stock**: 整数
- **category/location**: 可选字段

## 🚀 使用方式

### 1. 启动前端
```bash
cd xianyu-super-butler-repo/frontend
npm install
npm run dev
```

### 2. 访问页面
- 单个发布: 点击侧边栏"发布商品"
- 批量发布: 点击侧边栏"批量发布"

### 3. 发布流程

**单个商品发布:**
1. 选择发布账号
2. 填写商品信息
3. 上传商品图片
4. 点击"立即发布"
5. 查看发布结果

**批量发布:**
1. 选择发布账号
2. 下载 CSV 模板（可选）
3. 上传 CSV 文件
4. 预览商品列表
5. 点击"批量发布"
6. 查看发布统计

## ⚠️ 注意事项

1. **图片上传**: 前端会调用 `/api/products/upload-image` 接口，后端需要实现图片存储逻辑
2. **账号过滤**: 只显示已启用的账号（`enabled: true`）
3. **表单验证**: 前端已实现基础验证，后端也应进行验证
4. **错误处理**: 所有 API 调用都有 try-catch，会显示友好的错误提示
5. **批量发布**: 建议后端实现进度回调或分批处理，避免超时

## 🔗 相关文档

- 后端 API 文档: `PRODUCT_PUBLISH_README.md`
- Python 实现: `product_publisher.py`
- 前端主入口: `App.tsx`
- API 服务: `services/productService.ts`
