import { get, del, put } from '@/utils/request'
import type { Order, ApiResponse } from '@/types'

// 订单详情类型
export interface OrderDetail extends Order {
  spec_name?: string
  spec_value?: string
}

// 获取订单列表（支持分页）
export const getOrders = async (
  cookieId?: string,
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ success: boolean; data: Order[]; total?: number; total_pages?: number }> => {
  const params = new URLSearchParams()
  if (cookieId) params.append('cookie_id', cookieId)
  if (status) params.append('status', status)
  params.append('page', String(page))
  params.append('page_size', String(pageSize))
  const queryString = params.toString()
  
  try {
    const result = await get<{ orders?: Order[]; data?: Order[]; total?: number; total_pages?: number }>(`/api/orders?${queryString}`)
    const orders = result.orders || result.data || []
    return {
      success: true,
      data: orders,
      total: result.total || orders.length,
      total_pages: result.total_pages || Math.ceil((result.total || orders.length) / pageSize)
    }
  } catch {
    return { success: false, data: [], total: 0, total_pages: 0 }
  }
}

// 获取订单详情
export const getOrderDetail = async (orderId: string): Promise<{ success: boolean; data?: OrderDetail }> => {
  try {
    const result = await get<{ order?: OrderDetail; data?: OrderDetail }>(`/api/orders/${orderId}`)
    return {
      success: true,
      data: result.order || result.data
    }
  } catch {
    return { success: false }
  }
}

// 删除订单
export const deleteOrder = async (id: string): Promise<ApiResponse> => {
  try {
    await del(`/api/orders/${id}`)
    return { success: true, message: '删除成功' }
  } catch {
    return { success: false, message: '删除失败' }
  }
}

// 更新订单信息
export const updateOrder = async (orderId: string, data: Partial<Order>): Promise<{success: boolean; message?: string; data?: Order}> => {
  try {
    const result = await put<{success: boolean; message?: string; data?: Order}>(`/api/orders/${orderId}`, data)
    return {
      success: result.success !== false,
      message: result.message || '更新成功',
      data: result.data
    }
  } catch (error) {
    console.error('更新订单失败:', error)
    return { success: false, message: '更新订单失败' }
  }
}

// 批量删除订单
export const batchDeleteOrders = async (_ids: string[]): Promise<ApiResponse> => {
  return { success: false, message: '后端暂未实现批量删除订单接口' }
}

// 更新订单状态
export const updateOrderStatus = async (id: string, status: string): Promise<ApiResponse> => {
  return await updateOrder(id, { status: status as any })
}

// 刷新订单状态
export const refreshOrdersStatus = async (
  cookieId?: string,
  status?: string
): Promise<{
  success: boolean
  message?: string
  summary?: {
    total: number
    updated: number
    no_change: number
    failed: number
  }
  updated_orders?: Array<{
    order_id: string
    old_status: string
    new_status: string
    status_text: string
  }>
}> => {
  try {
    const formData = new FormData()
    if (cookieId) formData.append('cookie_id', cookieId)
    if (status) formData.append('status', status)

    const response = await fetch('/api/orders/refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error('刷新失败')
    }

    const result = await response.json()
    return result
  } catch (error) {
    return { success: false, message: '刷新订单状态失败' }
  }
}

// 刷新单个订单（自动获取完整数据）
export const refreshSingleOrder = async (orderId: string): Promise<{ success: boolean; message?: string; data?: Order; refreshed?: boolean }> => {
  try {
    const result = await put<{ success: boolean; message?: string; data?: Order; refreshed?: boolean }>(`/api/orders/${orderId}`, {})
    return result
  } catch (error) {
    console.error('刷新订单失败:', error)
    return { success: false, message: '刷新订单失败' }
  }
}

// 导入订单
export const importOrders = async (orders: Partial<Order>[]): Promise<{
  success: boolean
  message?: string
  total?: number
  success_count?: number
  failed_count?: number
  results?: Array<{ order_id: string; success: boolean; message: string }>
}> => {
  try {
    const response = await fetch('/api/orders/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify(orders)
    })
    const result = await response.json()
    return result
  } catch (error) {
    console.error('导入订单失败:', error)
    return { success: false, message: '导入订单失败' }
  }
}
