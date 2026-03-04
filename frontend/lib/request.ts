// 简化的请求工具，不依赖 axios
const API_BASE_URL = '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
}

const request = async <T = any>(url: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', headers = {}, body, params } = options;
  
  // 添加认证 token
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // 构建完整 URL
  let fullUrl = `${API_BASE_URL}${url}`;
  if (params) {
    const queryString = new URLSearchParams(params).toString();
    fullUrl += `?${queryString}`;
  }
  
  // 构建请求配置
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(fullUrl, config);
    
    // 处理 401 未授权
    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new Event('auth:logout'));
      throw new Error('未授权，请重新登录');
    }
    
    // 解析响应
    const data = await response.json();
    
    // 检查 HTTP 状态码
    if (!response.ok) {
      // FastAPI 错误格式: { detail: "错误信息" }
      const errorMessage = data.detail || data.message || `请求失败 (${response.status})`;
      throw new Error(errorMessage);
    }
    
    // 检查响应体中的 success 字段（业务逻辑错误）
    if (data.success === false) {
      const errorMessage = data.message || data.detail || '操作失败';
      throw new Error(errorMessage);
    }
    
    return data;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};

// 封装 GET 请求
export const get = async <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
  return request<T>(url, { method: 'GET', params });
};

// 封装 POST 请求
export const post = async <T = any>(url: string, data?: any): Promise<T> => {
  return request<T>(url, { method: 'POST', body: data });
};

// 封装 PUT 请求
export const put = async <T = any>(url: string, data?: any): Promise<T> => {
  return request<T>(url, { method: 'PUT', body: data });
};

// 封装 DELETE 请求
export const del = async <T = any>(url: string): Promise<T> => {
  return request<T>(url, { method: 'DELETE' });
};
