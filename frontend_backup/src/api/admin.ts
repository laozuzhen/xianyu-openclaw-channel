import { del, get, post } from '@/utils/request'
import type { ApiResponse, User } from '@/types'

// ========== 用户管理 ==========

// 获取用户列表
export const getUsers = async (): Promise<{ success: boolean; data?: User[] }> => {
  const result = await get<{ users: Array<{
    id: number
    username: string
    email?: string
    is_admin: boolean
    cookie_count?: number
    card_count?: number
  }> }>('/admin/users')
  // 后端返回 { users: [...] } 格式，转换字段名
  const users: User[] = (result.users || []).map(u => ({
    user_id: u.id,
    username: u.username,
    email: u.email,
    is_admin: u.is_admin,
  }))
  return { success: true, data: users }
}

// TODO: 后端暂未实现 POST /admin/users 接口
// export const addUser = ...

// TODO: 后端暂未实现 PUT /admin/users/{userId} 接口
// export const updateUser = ...

// 删除用户
export const deleteUser = (userId: number): Promise<ApiResponse> => {
  return del(`/admin/users/${userId}`)
}

// ========== 系统日志 ==========

export interface SystemLog {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  module: string
  created_at: string
}

// 获取系统日志
export const getSystemLogs = async (params?: { page?: number; limit?: number; level?: string }): Promise<{ success: boolean; data?: SystemLog[]; total?: number }> => {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('lines', String(params.limit))  // 后端用 lines 参数
  if (params?.level) query.set('level', params.level.toUpperCase())
  const result = await get<{ logs?: string[]; total?: number }>(`/admin/logs?${query.toString()}`)
  // 后端返回 { logs: [...] } 格式，转换为 SystemLog 数组
  const logs: SystemLog[] = (result.logs || []).map((log, index) => ({
    id: String(index),
    level: log.includes('ERROR') ? 'error' : log.includes('WARNING') ? 'warning' : 'info',
    message: log,
    module: 'system',
    created_at: new Date().toISOString(),
  }))
  return { success: true, data: logs, total: result.total }
}

// 清空系统日志
export const clearSystemLogs = (): Promise<ApiResponse> => {
  return post('/admin/logs/clear')
}

// ========== 风控日志 ==========

export interface RiskLog {
  id: string
  cookie_id: string
  risk_type: string
  message: string
  processing_result: string
  processing_status: string
  error_message: string | null
  created_at: string
  updated_at: string
}

// 获取风控日志
export const getRiskLogs = async (params?: { page?: number; limit?: number; cookie_id?: string }): Promise<{ success: boolean; data?: RiskLog[]; total?: number }> => {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.cookie_id) query.set('cookie_id', params.cookie_id)
  const result = await get<{ success: boolean; data?: Array<{
    id: number
    cookie_id: string
    event_type: string
    event_description: string
    processing_result: string
    processing_status: string
    error_message: string | null
    created_at: string
    updated_at: string
    cookie_name: string
  }>; total?: number }>(`/admin/risk-control-logs?${query.toString()}`)
  // 转换后端格式为前端格式
  const logs: RiskLog[] = (result.data || []).map(item => ({
    id: String(item.id),
    cookie_id: item.cookie_id || item.cookie_name,
    risk_type: item.event_type,
    message: item.event_description || '',
    processing_result: item.processing_result || '',
    processing_status: item.processing_status || '',
    error_message: item.error_message,
    created_at: item.created_at,
    updated_at: item.updated_at || '',
  }))
  return { success: true, data: logs, total: result.total }
}

// 清空风控日志
export const clearRiskLogs = async (cookieId?: string): Promise<ApiResponse> => {
  const query = cookieId ? `?cookie_id=${cookieId}` : ''
  return del(`/admin/risk-control-logs${query}`)
}

// ========== 数据管理 ==========

// 导出数据 - 后端只支持导出整个数据库
export const exportData = async (type: string): Promise<Blob> => {
  // 后端 /admin/backup/download 不支持 type 参数，只能导出整个数据库
  // 如果需要导出特定表数据，可以使用 /admin/data/{table_name} 获取后转换为 JSON
  if (type === 'all') {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`/admin/backup/download?token=${token}`)
    if (!response.ok) throw new Error('导出失败')
    return response.blob()
  }

  // 导出特定表数据
  const tableMap: Record<string, string> = {
    accounts: 'cookies',
    keywords: 'keywords',
    items: 'item_info',
    orders: 'orders',
    cards: 'cards',
  }
  const tableName = tableMap[type] || type
  const data = await get<{ data: unknown[] }>(`/admin/data/${tableName}`)
  const jsonStr = JSON.stringify(data.data || [], null, 2)
  return new Blob([jsonStr], { type: 'application/json' })
}

// 导入数据
export const importData = (formData: FormData): Promise<ApiResponse> => {
  return post('/admin/backup/upload', formData)
}

// 清理数据
export const cleanupData = (type: string): Promise<ApiResponse> => {
  // 清理类型映射表名
  const tableMap: Record<string, string> = {
    logs: 'logs',
    orders: 'orders',
    cards_used: 'cards',
    all_data: 'all',
  }
  const tableName = tableMap[type] || type

  // 如果是清空日志，使用通用接口
  if (type === 'logs') {
    return post('/logs/clear')
  }

  return del(`/admin/data/${tableName}`)
}

// 获取表数据
export interface TableData {
  success: boolean
  data: Record<string, unknown>[]
  columns: string[]
  count: number
}

export const getTableData = async (tableName: string): Promise<TableData> => {
  return get<TableData>(`/admin/data/${tableName}`)
}

// 清空表数据
export const clearTableData = (tableName: string): Promise<ApiResponse> => {
  return del(`/admin/data/${tableName}`)
}

// 删除表记录
export const deleteTableRecord = (tableName: string, recordId: string): Promise<ApiResponse> => {
  return del(`/admin/data/${tableName}/${recordId}`)
}

// ========== 日志管理 ==========

// 获取日志文件列表
export const getLogFiles = async (): Promise<{ files: string[] }> => {
  return get('/admin/log-files')
}

// 导出日志
export const exportLogs = (): string => {
  const token = localStorage.getItem('auth_token')
  return `/admin/logs/export?token=${token}`
}

// ========== 实时数据日志 API ==========

// 实时日志条目类型
export interface RealtimeLogEntry {
  timestamp: string
  level: string
  source: string
  function: string
  line: number
  message: string
}

// 获取实时日志
export const getRealtimeLogs = async (params?: { lines?: number; level?: string; source?: string }): Promise<{ success: boolean; data?: RealtimeLogEntry[] }> => {
  const query = new URLSearchParams()
  if (params?.lines) query.set('lines', String(params.lines))
  if (params?.level) query.set('level', params.level)
  if (params?.source) query.set('source', params.source)
  const result = await get<{ logs?: RealtimeLogEntry[]; success: boolean }>(`/logs?${query.toString()}`)
  return { success: result.success !== false, data: result.logs || [] }
}

// 获取日志统计信息
export const getLogStats = async (): Promise<{ success: boolean; data?: { total_logs: number; level_counts: Record<string, number>; source_counts: Record<string, number>; max_capacity: number; log_file: string } }> => {
  const result = await get<{ stats?: { total_logs: number; level_counts: Record<string, number>; source_counts: Record<string, number>; max_capacity: number; log_file: string } }>('/logs/stats')
  return { success: true, data: result.stats }
}

// 清空实时日志
export const clearRealtimeLogs = async (): Promise<ApiResponse> => {
  return post('/logs/clear')
}

// ========== 管理员统计 ==========

export interface AdminStats {
  total_users: number
  total_cookies: number
  total_cards: number
  total_keywords: number
  total_orders: number
  active_cookies: number
}

// 获取管理员统计数据
export const getAdminStats = async (): Promise<{ success: boolean; data?: AdminStats }> => {
  try {
    const data = await get<AdminStats>('/admin/stats')
    return { success: true, data }
  } catch {
    return { success: false }
  }
}
