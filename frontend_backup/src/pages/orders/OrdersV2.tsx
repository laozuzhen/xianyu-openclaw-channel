import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Search, Trash2, X, ChevronLeft, ChevronRight,
  Sparkles, Edit, Package, User, MapPin, DollarSign,
  Calendar, CheckCircle, XCircle
} from 'lucide-react'
import {
  getOrders, deleteOrder, getOrderDetail, refreshOrdersStatus,
  updateOrder, refreshSingleOrder
} from '@/api/orders'
import { getAccounts } from '@/api/accounts'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { Order, Account } from '@/types'

const statusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'secondary' }> = {
  processing: { label: '处理中', variant: 'warning' },
  pending_ship: { label: '待发货', variant: 'info' },
  processed: { label: '已处理', variant: 'info' },
  shipped: { label: '已发货', variant: 'success' },
  completed: { label: '已完成', variant: 'success' },
  refunding: { label: '退款中', variant: 'warning' },
  refund_cancelled: { label: '退款撤销', variant: 'info' },
  cancelled: { label: '已关闭', variant: 'danger' },
  unknown: { label: '未知', variant: 'secondary' },
}

export function OrdersV2() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')

  // 侧边详情面板
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // 批量操作
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

  // 编辑模式
  const [editMode, setEditMode] = useState(false)
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

  const handleShowDetail = async (order: Order) => {
    setSelectedOrder(order)
    setSidebarOpen(true)
    setEditMode(false)
    setLoadingDetail(true)

    try {
      const result = await getOrderDetail(order.order_id)
      if (result.success && result.data) {
        // Order detail loaded
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
      } else {
        addToast({ type: 'error', message: '获取订单详情失败' })
      }
    } catch {
      addToast({ type: 'error', message: '获取订单详情失败' })
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个订单吗？')) return
    try {
      const result = await deleteOrder(id)
      if (result.success) {
        addToast({ type: 'success', message: '删除成功' })
        loadOrders()
        if (selectedOrder?.order_id === id) {
          setSidebarOpen(false)
        }
      } else {
        addToast({ type: 'error', message: result.message || '删除失败' })
      }
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  const handleSubmitEdit = async () => {
    if (!selectedOrder) return

    setSubmittingEdit(true)
    try {
      const result = await updateOrder(selectedOrder.order_id, editFormData)
      if (result.success) {
        addToast({ type: 'success', message: '订单更新成功' })
        setEditMode(false)
        loadOrders()
        if (selectedOrder) {
          handleShowDetail({ ...selectedOrder, ...editFormData } as Order)
        }
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
        await loadOrders(currentPage)
        if (selectedOrder?.order_id === orderId) {
          const updatedOrder = orders.find(o => o.order_id === orderId)
          if (updatedOrder) {
            handleShowDetail(updatedOrder)
          }
        }
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

  const handleRefreshAll = async () => {
    if (!confirm('确定要刷新所有订单状态吗？这可能需要一些时间。')) return

    setRefreshing(true)
    try {
      const result = await refreshOrdersStatus()
      if (result.success && result.summary) {
        setRefreshResult({ ...result.summary, updated_orders: result.updated_orders || [] })
        setRefreshModalOpen(true)
        loadOrders()
      } else {
        addToast({ type: 'error', message: result.message || '刷新失败' })
      }
    } catch {
      addToast({ type: 'error', message: '批量刷新失败' })
    } finally {
      setRefreshing(false)
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
  }, [selectedAccount, selectedStatus])

  // 过滤订单
  const filteredOrders = orders.filter(order => {
    if (!searchKeyword) return true
    const keyword = searchKeyword.toLowerCase()
    return (
      order.order_id.toLowerCase().includes(keyword) ||
      order.order_id.toLowerCase().includes(keyword) ||
      order.receiver_name?.toLowerCase().includes(keyword) ||
      order.receiver_phone?.toLowerCase().includes(keyword)
    )
  })

  if (loading && !orders.length) {
    return <PageLoading />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">订单管理</h1>
              <p className="text-sm text-gray-500 mt-1">
                共 {total} 个订单
                {filteredOrders.length !== orders.length && ` · 筛选显示 ${filteredOrders.length} 个`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => loadOrders(currentPage)} variant="secondary" size="sm">
                <RefreshCw className="w-4 h-4" />
                刷新
              </Button>
              <Button onClick={handleRefreshAll} loading={refreshing} variant="primary" size="sm">
                <Sparkles className="w-4 h-4" />
                批量刷新状态
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="搜索订单号、收件人、手机号..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Select
              value={selectedAccount || ""}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="">所有账号</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.note || account.id}
                </option>
              ))}
            </Select>
            <Select
              value={selectedStatus || ""}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="">所有状态</option>
              {Object.entries(statusMap).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">订单号</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">收件人</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">金额</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">状态</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">创建时间</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">暂无订单数据</p>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr
                          key={order.order_id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleShowDetail(order)}
                        >
                          <td className="py-3 px-4">
                            <div className="text-sm font-mono text-gray-900">{order.order_id}</div>
                            <div className="text-xs text-gray-500 mt-0.5">ID: {order.order_id}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-gray-900">{order.receiver_name || '-'}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{order.receiver_phone || '-'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-semibold text-gray-900">
                              ¥{parseFloat(order.amount || "0").toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={statusMap[order.status]?.variant || 'secondary'}>
                              {statusMap[order.status]?.label || order.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '-'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRefreshSingle(order.order_id)
                                }}
                                loading={refreshingOrders.has(order.order_id)}
                              >
                                <Sparkles className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(order.order_id)
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-600">
                第 {currentPage} 页，共 {totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => loadOrders(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => loadOrders(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Detail Panel */}
      <AnimatePresence>
        {sidebarOpen && selectedOrder && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-full sm:w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl"
          >
            {/* Sidebar Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">订单详情</h2>
                  <p className="text-xs text-gray-500 mt-1 font-mono">{selectedOrder.order_id}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSidebarOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-4">
                {!editMode ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
                      <Edit className="w-3 h-3" />
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRefreshSingle(selectedOrder.order_id)}
                      loading={refreshingOrders.has(selectedOrder.order_id)}
                    >
                      <Sparkles className="w-3 h-3" />
                      刷新
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="primary" onClick={handleSubmitEdit} loading={submittingEdit}>
                      <CheckCircle className="w-3 h-3" />
                      保存
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                      <XCircle className="w-3 h-3" />
                      取消
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <>
                  {/* Status */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      订单状态
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusMap[selectedOrder.status]?.variant || 'secondary'} className="text-sm">
                        {statusMap[selectedOrder.status]?.label || selectedOrder.status}
                      </Badge>
                      {selectedOrder.system_shipped && (
                        <Badge variant="info" className="text-xs">已发货</Badge>
                      )}
                    </div>
                  </div>

                  {/* Buyer Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      买家信息
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">买家ID</span>
                        <span className="text-gray-900 font-mono">{selectedOrder.buyer_id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Receiver Info */}
                  {!editMode ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        收货信息
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">收件人</span>
                          <span className="text-gray-900">{selectedOrder.receiver_name || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">联系电话</span>
                          <span className="text-gray-900">{selectedOrder.receiver_phone || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block mb-1">收货地址</span>
                          <span className="text-gray-900">{selectedOrder.receiver_address || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        label="收件人"
                        value={editFormData.receiver_name || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, receiver_name: e.target.value })}
                      />
                      <Input
                        label="联系电话"
                        value={editFormData.receiver_phone || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, receiver_phone: e.target.value })}
                      />
                      <Input
                        label="收货地址"
                        value={editFormData.receiver_address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, receiver_address: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Order Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      订单信息
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">商品ID</span>
                        <span className="text-gray-900 font-mono">{selectedOrder.item_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">规格</span>
                        <span className="text-gray-900">{selectedOrder.spec_value || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">数量</span>
                        <span className="text-gray-900">{selectedOrder.quantity || 1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">金额</span>
                        <span className="text-lg font-semibold text-primary-600">
                          ¥{parseFloat(selectedOrder.amount || "0").toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      时间信息
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">创建时间</span>
                        <span className="text-gray-900 text-xs">
                          {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('zh-CN') : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">更新时间</span>
                        <span className="text-gray-900 text-xs">
                          {selectedOrder.updated_at ? new Date(selectedOrder.updated_at).toLocaleString('zh-CN') : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <Button
                variant="danger"
                className="w-full"
                onClick={() => handleDelete(selectedOrder.order_id)}
              >
                <Trash2 className="w-4 h-4" />
                删除订单
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refresh Result Modal */}
      {refreshModalOpen && refreshResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">批量刷新结果</h2>
                <Button size="sm" variant="ghost" onClick={() => setRefreshModalOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{refreshResult.total}</p>
                  <p className="text-xs text-gray-600 mt-1">总数</p>
                </div>
                <div className="text-center p-4 bg-success-50 rounded-lg">
                  <p className="text-2xl font-bold text-success-600">{refreshResult.updated}</p>
                  <p className="text-xs text-gray-600 mt-1">已更新</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{refreshResult.no_change}</p>
                  <p className="text-xs text-gray-600 mt-1">无变化</p>
                </div>
                <div className="text-center p-4 bg-danger-50 rounded-lg">
                  <p className="text-2xl font-bold text-danger-600">{refreshResult.failed}</p>
                  <p className="text-xs text-gray-600 mt-1">失败</p>
                </div>
              </div>
              {refreshResult.updated_orders.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">更新详情</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {refreshResult.updated_orders.map((order) => (
                      <div key={order.order_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <span className="font-mono text-gray-900">{order.order_id}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{order.old_status}</Badge>
                          <span className="text-gray-400">→</span>
                          <Badge variant="success">{order.new_status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
