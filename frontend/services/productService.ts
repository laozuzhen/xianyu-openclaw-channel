import { get, post } from '../lib/request';

// 商品发布相关类型
export interface ProductInfo {
  title?: string;  // 可选，闲鱼页面没有标题输入框
  description: string;
  price: number;
  images: string[];
  category?: string;
  location?: string;
  original_price?: number;
  stock?: number;
}

export interface PublishProductRequest {
  cookie_id: string;
  title?: string;  // 可选，闲鱼页面没有标题输入框
  description: string;
  price: number;
  images: string[];
  category?: string;
  location?: string;
  original_price?: number;
  stock?: number;
}

export interface BatchPublishRequest {
  cookie_id: string;
  products: ProductInfo[];
}

export interface PublishResponse {
  success: boolean;
  message: string;
  product?: {
    title: string;
    price: number;
  };
}

export interface BatchPublishResponse {
  success: boolean;
  message: string;
  results: {
    total: number;
    success: number;
    failed: number;
    details: Array<{
      title: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  };
}

export interface ProductTemplate {
  id: string;
  name: string;
  category: string;
  location: string;
  description_template: string;
}

export interface TemplatesResponse {
  success: boolean;
  templates: ProductTemplate[];
}

// 发布单个商品
export const publishProduct = async (data: PublishProductRequest): Promise<PublishResponse> => {
  return post('/api/products/publish', data);
};

// 批量发布商品
export const batchPublishProducts = async (data: BatchPublishRequest): Promise<BatchPublishResponse> => {
  return post('/api/products/batch-publish', data);
};

// 获取商品模板
export const getProductTemplates = async (): Promise<TemplatesResponse> => {
  return get('/api/products/templates');
};

// 上传图片
export const uploadImage = async (file: File): Promise<{ success: boolean; url: string; image_url?: string; message?: string }> => {
  const formData = new FormData();
  formData.append('image', file);
  
  const token = localStorage.getItem('auth_token');
  const response = await fetch('/upload-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const result = await response.json();
  // 后端返回 image_url,前端需要 url
  return {
    success: response.ok,
    url: result.image_url || '',
    message: result.message
  };
};
