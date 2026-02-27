import { get } from '@/utils/request'

// ==================== 类型定义 ====================

/**
 * 收益统计
 */
export interface RevenueStats {
  total_orders: number          // 总订单数
  total_amount: number          // 总收益（估值）
  avg_amount: number            // 平均订单金额
  unique_buyers: number         // 独立买家数
  unique_items: number          // 独立商品数
}

/**
 * 每日统计
 */
export interface DailyStat {
  date: string                  // 日期
  order_count: number           // 订单数
  amount: number                // 金额
}

/**
 * 状态统计
 */
export interface StatusStat {
  status: string                // 订单状态
  count: number                 // 订单数
  amount: number                // 金额
}

/**
 * 城市统计
 */
export interface CityStat {
  city: string                  // 城市
  order_count: number           // 订单数
  total_amount: number          // 总金额
}

/**
 * 商品统计
 */
export interface ItemStat {
  item_id: string               // 商品ID
  order_count: number           // 订单数
  total_amount: number          // 总金额
  avg_amount: number            // 平均金额
}

/**
 * 订单分析数据
 */
export interface OrderAnalytics {
  revenue_stats: RevenueStats
  daily_stats: DailyStat[]
  status_stats: StatusStat[]
  city_stats: CityStat[]
  item_stats: ItemStat[]
}

/**
 * 有效订单详情
 */
export interface ValidOrder {
  order_id: string
  item_id: string
  buyer_id: string
  amount: string
  order_status: string
  spec_name: string
  spec_value: string
  quantity: string
  created_at: string
  receiver_city: string
}

// ==================== 常量定义 ====================

/**
 * 无效订单状态（退货、取消等，不计入统计）
 * 注：数据库中存储为小写，这里同时包含小写和大写以确保兼容
 */
export const INVALID_ORDER_STATUSES = [
  // 小写形式（数据库实际存储格式）
  'returned', 'cancelled', 'refunded', 'return_processing',
  'cancel_buyer', 'cancel_seller', 'cancel_platform',
  'return_requested', 'return_approved', 'return_rejected',
  // 大写形式（兼容性）
  'RETURNED', 'CANCELLED', 'REFUNDED', 'RETURN_PROCESSING',
  'CANCEL_BUYER', 'CANCEL_SELLER', 'CANCEL_PLATFORM',
  'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED'
]

/**
 * 订单状态中文映射
 */
export const ORDER_STATUS_MAP: Record<string, string> = {
  'CREATED': '已创建',
  'PAID': '已付款',
  'PENDING_SHIP': '待发货',
  'SHIPPED': '已发货',
  'RECEIVED': '已收货',
  'COMPLETED': '已完成',
  'RETURNED': '已退货',
  'CANCELLED': '已取消',
  'REFUNDED': '已退款',
  'RETURN_PROCESSING': '退货处理中',
  'CANCEL_BUYER': '买家取消',
  'CANCEL_SELLER': '卖家取消',
  'CANCEL_PLATFORM': '平台取消',
  'RETURN_REQUESTED': '申请退货',
  'RETURN_APPROVED': '退货已批准',
  'RETURN_REJECTED': '退货已拒绝',
  'PENDING_PAY': '待付款',
  'PENDING_CONFIRM': '待确认',
  'unknown': '未知状态'
}

/**
 * 订单状态颜色映射
 */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  'CREATED': 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  'PAID': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'PENDING_SHIP': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'SHIPPED': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  'RECEIVED': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  'COMPLETED': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  'RETURNED': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  'CANCELLED': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  'REFUNDED': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  'PENDING_PAY': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  'PENDING_CONFIRM': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  'unknown': 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
}

// ==================== 工具函数 ====================

/**
 * 过滤无效订单状态
 */
export const filterInvalidOrders = <T extends { status?: string }>(items: T[]): T[] => {
  return items.filter(item => {
    const status = (item as any).order_status || (item as any).status || ''
    return !INVALID_ORDER_STATUSES.includes(status)
  })
}

/**
 * 过滤统计数据中的无效订单
 */
export const filterAnalyticsData = (data: OrderAnalytics): OrderAnalytics => {
  return {
    ...data,
    status_stats: data.status_stats.filter(stat => !INVALID_ORDER_STATUSES.includes(stat.status)),
    // 注意：这里不过滤daily_stats, city_stats, item_stats，因为它们可能已经在后端过滤了
    // 如果需要，可以根据实际情况调整
  }
}

/**
 * 获取订单状态中文名称
 */
export const getStatusName = (status: string): string => {
  if (!status) return ORDER_STATUS_MAP['unknown']
  // 统一转大写匹配
  const upperStatus = status.toUpperCase()
  return ORDER_STATUS_MAP[upperStatus] || status
}

/**
 * 获取订单状态颜色
 */
export const getStatusColor = (status: string): string => {
  if (!status) return ORDER_STATUS_COLORS['unknown']
  // 统一转大写匹配
  const upperStatus = status.toUpperCase()
  return ORDER_STATUS_COLORS[upperStatus] || ORDER_STATUS_COLORS['unknown']
}

// ==================== API函数 ====================

/**
 * 获取订单分析数据
 */
export const getOrderAnalytics = async (params?: {
  start_date?: string
  end_date?: string
}): Promise<{ success: boolean; data?: OrderAnalytics }> => {
  try {
    const query = new URLSearchParams()
    if (params?.start_date) query.set('start_date', params.start_date)
    if (params?.end_date) query.set('end_date', params.end_date)

    const queryString = query.toString()
    const url = queryString ? `/analytics/orders?${queryString}` : '/analytics/orders'

    const result = await get<any>(url)

    // 过滤掉无效订单状态的数据
    const filteredData = filterAnalyticsData(result)

    return { success: true, data: filteredData }
  } catch (error) {
    console.error('获取订单分析数据失败:', error)
    return { success: false }
  }
}

/**
 * 获取有效订单列表
 */
export const getValidOrders = async (params?: {
  start_date?: string
  end_date?: string
}): Promise<{ success: boolean; data?: ValidOrder[] }> => {
  try {
    const query = new URLSearchParams()
    if (params?.start_date) query.set('start_date', params.start_date)
    if (params?.end_date) query.set('end_date', params.end_date)

    const queryString = query.toString()
    const url = queryString ? `/analytics/orders/valid?${queryString}` : '/analytics/orders/valid'

    const result = await get<{ orders: ValidOrder[] }>(url)

    return { success: true, data: result.orders }
  } catch (error) {
    console.error('获取有效订单列表失败:', error)
    return { success: false }
  }
}

/**
 * 预设时间范围快捷选项
 */
export const DateRangePresets = {
  today: () => {
    const today = new Date()
    return {
      start_date: today.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
      label: '今天'
    }
  },
  yesterday: () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return {
      start_date: yesterday.toISOString().split('T')[0],
      end_date: yesterday.toISOString().split('T')[0],
      label: '昨天'
    }
  },
  last7Days: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 6)
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      label: '最近7天'
    }
  },
  last30Days: () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 29)
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      label: '最近30天'
    }
  },
  thisWeek: () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - dayOfWeek)
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
      label: '本周'
    }
  },
  lastWeek: () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - dayOfWeek - 7)
    const end = new Date(now)
    end.setDate(now.getDate() - dayOfWeek - 1)
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      label: '上周'
    }
  },
  thisMonth: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
      label: '本月'
    }
  },
  lastMonth: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      label: '上月'
    }
  }
}
