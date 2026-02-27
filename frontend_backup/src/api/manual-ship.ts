import { post } from '@/utils/request'

export interface ManualShipResponse {
  success: boolean
  message?: string
  total: number
  success_count: number
  failed_count: number
  results: Array<{
    order_id: string
    success: boolean
    message: string
  }>
}

// 手动补发货
export const manualShipOrders = async (
  orderIds: string[],
  shipMode: 'auto_match' | 'custom',
  customContent?: string
): Promise<ManualShipResponse> => {
  try {
    const result = await post<ManualShipResponse>('/api/orders/manual-ship', {
      order_ids: orderIds,
      ship_mode: shipMode,
      custom_content: customContent
    })
    return result
  } catch (error) {
    console.error('手动发货失败:', error)
    return {
      success: false,
      message: '手动发货失败',
      total: orderIds.length,
      success_count: 0,
      failed_count: orderIds.length,
      results: []
    }
  }
}
