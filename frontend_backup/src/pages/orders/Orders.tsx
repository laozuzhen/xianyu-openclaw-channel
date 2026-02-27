import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, RefreshCw, Search, Trash2, Eye, X, ChevronLeft, ChevronRight, Sparkles, Edit } from 'lucide-react'
import { getOrders, deleteOrder, getOrderDetail, refreshOrdersStatus, updateOrder, refreshSingleOrder, type OrderDetail } from '@/api/orders'
import { getAccounts } from '@/api/accounts'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import type { Order, Account } from '@/types'

const statusMap: Record<string, { label: string; class: string }> = {
  processing: { label: '处理中', class: 'badge-warning' },
  pending_ship: { label: '待发货', class: 'badge-info' },
  processed: { label: '已处理', class: 'badge-info' },
  shipped: { label: '已发货', class: 'badge-success' },
  completed: { label: '已完成', class: 'badge-success' },
  refunding: { label: '退款中', class: 'badge-warning' },
  refund_cancelled: { label: '退款撤销', class: 'badge-info' },
  cancelled: { label: '已关闭', class: 'badge-danger' },
  unknown: { label: '未知', class: 'badge-gray' },
}

export function Orders() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  // 订单状态更新
  const [refreshing, setRefreshing] = useState(false)
  const [refreshModalOpen, setRefreshModalOpen] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{
    total: number
    updated: number
    no_change: number
    failed: number
    updated_orders: Array<{
      order_id: string
      old_status: string
      new_status: string
      status_text: string
    }>
  } | null>(null)
  // 订单编辑
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editFormData, setEditFormData] = useState<Partial<Order>>({})
  const [submittingEdit, setSubmittingEdit] = useState(false)
  // 单个订单刷新状态
  const [refreshingOrders, setRefreshingOrders] = useState<Set<string>>(new Set())

  const loadOrders = async (page: number = currentPage) => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getOrders(selectedAccount || undefined, selectedStatus || undefined, page, pageSize)
      if (result.success) {
        setOrders(result.data || [])
        setTotal(result.total || 0)
        setTotalPages(result.total_pages || 0)
        setCurrentPage(page)
      }
    } catch {
      addToast({ type: 'error', message: '加载订单列表失败' })
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      const data = await getAccounts()
      setAccounts(data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadAccounts()
    loadOrders(1)
  }, [_hasHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    setCurrentPage(1)
    loadOrders(1)
  }, [_hasHydrated, isAuthenticated, token, selectedAccount, selectedStatus])

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个订单吗？')) return
    try {
      const result = await deleteOrder(id)
      if (result.success) {
        addToast({ type: 'success', message: '删除成功' })
        loadOrders()
      } else {
        addToast({ type: 'error', message: result.message || '删除失败' })
      }
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  const handleShowDetail = async (orderNo: string) => {
    setLoadingDetail(true)
    setDetailModalOpen(true)
    try {
      const result = await getOrderDetail(orderNo)
      if (result.success && result.data) {
        setOrderDetail(result.data)
      } else {
        addToast({ type: 'error', message: '获取订单详情失败' })
        setDetailModalOpen(false)
      }
    } catch {
      addToast({ type: 'error', message: '获取订单详情失败' })
      setDetailModalOpen(false)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order)
    setEditFormData({
      item_id: order.item_id,
      buyer_id: order.buyer_id,
      spec_name: order.spec_name,
      spec_value: order.spec_value,
      quantity: order.quantity,
      amount: order.amount,
      status: order.status,
      receiver_name: order.receiver_name,
      receiver_phone: order.receiver_phone,
      receiver_address: order.receiver_address,
      system_shipped: order.system_shipped
    })
    setEditModalOpen(true)
  }

  const handleSubmitEdit = async () => {
    if (!editingOrder) return

    setSubmittingEdit(true)
    try {
      const result = await updateOrder(editingOrder.order_id, editFormData)
      if (result.success) {
        addToast({ type: 'success', message: '订单更新成功' })
        setEditModalOpen(false)
        loadOrders()
      } else {
        addToast({ type: 'error', message: result.message || '更新失败' })
      }
    } catch {
      addToast({ type: 'error', message: '更新订单失败' })
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleRefreshSingle = async (orderId: string) => {
    if (refreshingOrders.has(orderId)) return

    setRefreshingOrders(prev => new Set(prev).add(orderId))

    try {
      const result = await refreshSingleOrder(orderId)

      if (result.success) {
        addToast({
          type: 'success',
          message: result.message || (result.refreshed ? '订单已刷新完整数据' : '订单更新成功')
        })
        // 刷新订单列表
        await loadOrders(currentPage)
      } else {
        addToast({ type: 'error', message: result.message || '刷新失败' })
      }
    } catch {
      addToast({ type: 'error', message: '刷新订单失败' })
    } finally {
      setRefreshingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  const handleSmartRefresh = async () => {
    if (refreshing) return

    setRefreshing(true)
    setRefreshModalOpen(true)
    setRefreshResult(null)

    try {
      const result = await refreshOrdersStatus(
        selectedAccount || undefined,
        selectedStatus || undefined
      )

      if (result.success && result.summary) {
        setRefreshResult({
          total: result.summary.total,
          updated: result.summary.updated,
          no_change: result.summary.no_change,
          failed: result.summary.failed,
          updated_orders: result.updated_orders || []
        })

        addToast({
          type: 'success',
          message: result.message || '刷新完成'
        })

        // 刷新订单列表
        await loadOrders(currentPage)
      } else {
        addToast({ type: 'error', message: result.message || '刷新失败' })
        setRefreshModalOpen(false)
      }
    } catch {
      addToast({ type: 'error', message: '刷新订单状态失败' })
      setRefreshModalOpen(false)
    } finally {
      setRefreshing(false)
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (!searchKeyword) return true
    const keyword = searchKeyword.toLowerCase()
    return (
      order.order_id?.toLowerCase().includes(keyword) ||
      order.item_id?.toLowerCase().includes(keyword) ||
      order.buyer_id?.toLowerCase().includes(keyword)
    )
  })

  if (loading && orders.length === 0) {
    return <PageLoading />
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="page-title">订单管理</h1>
          <p className="page-description">查看和管理所有订单信息</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadOrders(currentPage)}
            disabled={loading}
            className="btn-ios-secondary w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新列表
          </button>
          <button
            onClick={handleSmartRefresh}
            disabled={refreshing}
            className="btn-ios-primary w-full sm:w-auto"
          >
            <Sparkles className={`w-4 h-4 ${refreshing ? 'animate-pulse' : ''}`} />
            {refreshing ? '更新中...' : '更新订单状态'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="vben-card"
      >
        <div className="vben-card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="input-group">
              <label className="input-label">筛选账号</label>
              <Select
                value={selectedAccount}
                onChange={setSelectedAccount}
                options={[
                  { value: '', label: '所有账号' },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: account.id,
                  })),
                ]}
                placeholder="所有账号"
              />
            </div>
            <div className="input-group">
              <label className="input-label">订单状态</label>
              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={[
                  { value: '', label: '所有状态' },
                  { value: 'processing', label: '处理中' },
                  { value: 'pending_ship', label: '待发货' },
                  { value: 'shipped', label: '已发货' },
                  { value: 'completed', label: '已完成' },
                  { value: 'refunding', label: '退款中' },
                  { value: 'cancelled', label: '已关闭' },
                ]}
                placeholder="所有状态"
              />
            </div>
            <div className="input-group">
              <label className="input-label">搜索订单</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索订单ID或商品ID..."
                  className="input-ios pl-9"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Orders List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="vben-card"
      >
        <div className="vben-card-header flex items-center justify-between">
          <h2 className="vben-card-title">
            <ShoppingCart className="w-4 h-4" />
            订单列表
          </h2>
          <span className="badge-primary">共 {total} 个订单</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios">
            <thead>
              <tr>
                <th>订单ID</th>
                <th>商品ID</th>
                <th>买家ID</th>
                <th>数量</th>
                <th>金额</th>
                <th>状态</th>
                <th>小刀</th>
                <th>系统发货</th>
                <th>账号ID</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="w-12 h-12 text-gray-300" />
                      <p>暂无订单数据</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const status = statusMap[order.status] || statusMap.unknown
                  return (
                    <tr key={order.id}>
                      <td className="font-mono text-sm">{order.order_id}</td>
                      <td className="text-sm">{order.item_id}</td>
                      <td className="text-sm">{order.buyer_id}</td>
                      <td>{order.quantity}</td>
                      <td className="text-amber-600 font-medium">¥{order.amount}</td>
                      <td>
                        <span className={status.class}>{status.label}</span>
                      </td>
                      <td>
                        {order.is_bargain ? (
                          <span className="badge-warning">是</span>
                        ) : (
                          <span className="badge-gray">否</span>
                        )}
                      </td>
                      <td>
                        {order.system_shipped ? (
                          <span className="badge-success">已发货</span>
                        ) : (
                          <span className="badge-gray">未发货</span>
                        )}
                      </td>
                      <td className="font-medium text-amber-600 dark:text-amber-400">{order.cookie_id}</td>
                      <td className="text-sm text-gray-500">
                        {order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleShowDetail(order.order_id)}
                            className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4 text-amber-500" />
                          </button>
                          <button
                            onClick={() => handleRefreshSingle(order.order_id)}
                            disabled={refreshingOrders.has(order.order_id)}
                            className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="刷新订单"
                          >
                            <RefreshCw className={`w-4 h-4 text-green-500 ${refreshingOrders.has(order.order_id) ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleEditOrder(order)}
                            className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500">
              第 {currentPage} 页，共 {totalPages} 页，{total} 条记录
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadOrders(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => loadOrders(pageNum)}
                      disabled={loading}
                      className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                        currentPage === pageNum
                          ? 'bg-amber-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => loadOrders(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* 订单详情弹窗 */}
      {detailModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">订单详情</h2>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="modal-body">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <span className="ml-2 text-gray-500">加载中...</span>
                </div>
              ) : orderDetail ? (
                <div className="space-y-4">
                  {/* 基本信息 */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">基本信息</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">订单ID</span>
                        <span className="font-mono">{orderDetail.order_id}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">商品ID</span>
                        <span>{orderDetail.item_id || '未知'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">买家ID</span>
                        <span>{orderDetail.buyer_id || '未知'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">账号ID</span>
                        <span className="text-amber-600">{orderDetail.cookie_id || '未知'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">订单状态</span>
                        <span className={statusMap[orderDetail.status]?.class || 'badge-gray'}>
                          {statusMap[orderDetail.status]?.label || '未知'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">是否小刀</span>
                        {orderDetail.is_bargain ? (
                          <span className="badge-warning">是</span>
                        ) : (
                          <span className="badge-gray">否</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 商品信息 */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">商品信息</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">规格名称</span>
                        <span>{orderDetail.spec_name || '无'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">规格值</span>
                        <span>{orderDetail.spec_value || '无'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">数量</span>
                        <span>{orderDetail.quantity || 1}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">金额</span>
                        <span className="text-amber-600 font-medium">¥{orderDetail.amount || '0.00'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 时间信息 */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">时间信息</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">创建时间</span>
                        <span>{orderDetail.created_at ? new Date(orderDetail.created_at).toLocaleString('zh-CN') : '未知'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">更新时间</span>
                        <span>{orderDetail.updated_at ? new Date(orderDetail.updated_at).toLocaleString('zh-CN') : '未知'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">暂无数据</div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setDetailModalOpen(false)} className="btn-ios-secondary">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 更新订单状态结果弹窗 */}
      {refreshModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                更新订单状态结果
              </h2>
              {!refreshing && (
                <button
                  onClick={() => setRefreshModalOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>
            <div className="modal-body">
              {refreshing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4"></div>
                  <span className="text-gray-500">正在刷新订单状态...</span>
                  <span className="text-sm text-gray-400 mt-2">这可能需要几分钟时间</span>
                </div>
              ) : refreshResult ? (
                <div className="space-y-4">
                  {/* 统计摘要 */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{refreshResult.total}</div>
                      <div className="text-sm text-gray-500">总订单</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{refreshResult.updated}</div>
                      <div className="text-sm text-gray-500">已更新</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{refreshResult.no_change}</div>
                      <div className="text-sm text-gray-500">无变化</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{refreshResult.failed}</div>
                      <div className="text-sm text-gray-500">失败</div>
                    </div>
                  </div>

                  {/* 更新的订单列表 */}
                  {refreshResult.updated_orders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        已更新的订单 ({refreshResult.updated_orders.length})
                      </h3>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {refreshResult.updated_orders.map((order, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-mono text-sm">{order.order_id}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {statusMap[order.old_status]?.label || order.old_status} → {statusMap[order.new_status]?.label || order.new_status}
                              </div>
                            </div>
                            <div className="text-sm text-green-600 font-medium">
                              {order.status_text}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {refreshResult.updated_orders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>没有订单状态发生变化</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setRefreshModalOpen(false)}
                disabled={refreshing}
                className="btn-ios-secondary"
              >
                {refreshing ? '刷新中...' : '关闭'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editModalOpen && editingOrder && (
        <div className="modal-overlay" onClick={() => !submittingEdit && setEditModalOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="modal-container max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">编辑订单</h3>
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={submittingEdit}
                className="modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                {/* 订单ID（只读） */}
                <div className="input-group">
                  <label className="input-label">订单ID</label>
                  <input
                    type="text"
                    value={editingOrder.order_id}
                    disabled
                    className="input-ios bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                  />
                </div>

                {/* 商品ID */}
                <div className="input-group">
                  <label className="input-label">商品ID</label>
                  <input
                    type="text"
                    value={editFormData.item_id || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, item_id: e.target.value })}
                    className="input-ios"
                  />
                </div>

                {/* 买家ID */}
                <div className="input-group">
                  <label className="input-label">买家ID</label>
                  <input
                    type="text"
                    value={editFormData.buyer_id || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, buyer_id: e.target.value })}
                    className="input-ios"
                  />
                </div>

                {/* 规格名称和值 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="input-group">
                    <label className="input-label">规格名称</label>
                    <input
                      type="text"
                      value={editFormData.spec_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, spec_name: e.target.value })}
                      className="input-ios"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">规格值</label>
                    <input
                      type="text"
                      value={editFormData.spec_value || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, spec_value: e.target.value })}
                      className="input-ios"
                    />
                  </div>
                </div>

                {/* 数量和金额 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="input-group">
                    <label className="input-label">数量</label>
                    <input
                      type="number"
                      value={editFormData.quantity || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, quantity: Number(e.target.value) })}
                      className="input-ios"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">金额</label>
                    <input
                      type="text"
                      value={editFormData.amount || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                      className="input-ios"
                      placeholder="¥99.99"
                    />
                  </div>
                </div>

                {/* 订单状态 */}
                <div className="input-group">
                  <label className="input-label">订单状态</label>
                  <Select
                    value={editFormData.status || ''}
                    onChange={(value) => setEditFormData({ ...editFormData, status: value as any })}
                    options={[
                      { value: 'processing', label: '处理中' },
                      { value: 'pending_ship', label: '待发货' },
                      { value: 'shipped', label: '已发货' },
                      { value: 'completed', label: '已完成' },
                      { value: 'refunding', label: '退款中' },
                      { value: 'cancelled', label: '已关闭' },
                    ]}
                  />
                </div>

                {/* 系统发货状态 */}
                <div className="input-group">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.system_shipped || false}
                      onChange={(e) => setEditFormData({ ...editFormData, system_shipped: e.target.checked })}
                      className="w-4 h-4 text-amber-500 rounded"
                    />
                    <span className="input-label mb-0">系统已发货</span>
                  </label>
                </div>

                {/* 收货人信息 */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">收货人信息</h4>

                  <div className="input-group">
                    <label className="input-label">收货人姓名</label>
                    <input
                      type="text"
                      value={editFormData.receiver_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, receiver_name: e.target.value })}
                      className="input-ios"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">收货人手机号</label>
                    <input
                      type="text"
                      value={editFormData.receiver_phone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, receiver_phone: e.target.value })}
                      className="input-ios"
                      placeholder="13800138000"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">收货地址</label>
                    <textarea
                      value={editFormData.receiver_address || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, receiver_address: e.target.value })}
                      className="input-ios min-h-[80px] resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={submittingEdit}
                className="btn-ios-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSubmitEdit}
                disabled={submittingEdit}
                className="btn-ios-primary"
              >
                {submittingEdit ? '保存中...' : '保存'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
