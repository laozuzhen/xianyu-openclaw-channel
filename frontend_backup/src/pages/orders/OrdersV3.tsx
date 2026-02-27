import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// 导入订单表单模式
import {
  RefreshCw, Search, Trash2, X, ChevronLeft, ChevronRight,
  Sparkles, Edit, Package, User, MapPin, DollarSign,
  Calendar, CheckCircle, XCircle, Filter,
  Loader2, Upload, Download, Sun, Moon
} from 'lucide-react'
import {
  getOrders, deleteOrder, getOrderDetail, refreshOrdersStatus,
  updateOrder, refreshSingleOrder, importOrders
} from '@/api/orders'
import { getAccounts } from '@/api/accounts'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import type { Order, Account } from '@/types'

const statusMap: Record<string, { label: string; color: string; bg: string; text: string }> = {
  processing: { label: '处理中', color: 'from-yellow-500 to-amber-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  pending_ship: { label: '待发货', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  processed: { label: '已处理', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  shipped: { label: '已发货', color: 'from-green-500 to-emerald-500', bg: 'bg-green-50', text: 'text-green-700' },
  completed: { label: '已完成', color: 'from-green-500 to-emerald-500', bg: 'bg-green-50', text: 'text-green-700' },
  refunding: { label: '退款中', color: 'from-orange-500 to-red-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  refund_cancelled: { label: '退款撤销', color: 'from-slate-500 to-gray-500', bg: 'bg-slate-50', text: 'text-slate-700' },
  cancelled: { label: '已关闭', color: 'from-red-500 to-rose-500', bg: 'bg-red-50', text: 'text-red-700' },
  unknown: { label: '未知', color: 'from-gray-500 to-slate-500', bg: 'bg-gray-50', text: 'text-gray-700' },
}

export function OrdersV3() {
  const { addToast, darkMode, toggleDarkMode } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  // Detail panel
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Batch refresh
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

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<Order>>({})
  const [submittingEdit, setSubmittingEdit] = useState(false)

  // Single refresh
  const [refreshingOrders, setRefreshingOrders] = useState<Set<string>>(new Set())

  // Import orders
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [importFormData, setImportFormData] = useState({
    order_id: '',
    cookie_id: '',
    item_id: '',
    buyer_id: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    status: '',
    quantity: '1',
    amount: ''
  })

  const loadOrders = async (page: number) => {
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
    setEditMode(false)
    setLoadingDetail(true)

    try {
      const result = await getOrderDetail(order.order_id)
      if (result.success && result.data) {
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
        loadOrders(currentPage)
        if (selectedOrder?.order_id === id) {
          setSelectedOrder(null)
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
        loadOrders(currentPage)
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

  const handleImportOrders = async () => {
    // 验证必填字段
    if (!importFormData.order_id.trim()) {
      addToast({ type: 'error', message: '请输入订单号' })
      return
    }

    if (!importFormData.cookie_id.trim()) {
      addToast({ type: 'error', message: '请选择账号' })
      return
    }

    setImporting(true)
    try {
      // 构建订单数据 - 只使用 Order 类型中存在的字段
      const orderData: Partial<Order> = {
        order_id: importFormData.order_id.trim(),
        cookie_id: importFormData.cookie_id.trim(),
      }

      // 添加可选字段（只存在于 Order 类型中的）
      if (importFormData.item_id.trim()) orderData.item_id = importFormData.item_id.trim()
      if (importFormData.quantity.trim()) orderData.quantity = parseInt(importFormData.quantity)
      if (importFormData.amount.trim()) orderData.amount = String(parseFloat(importFormData.amount))
      if (importFormData.receiver_name.trim()) orderData.receiver_name = importFormData.receiver_name.trim()
      if (importFormData.receiver_phone.trim()) orderData.receiver_phone = importFormData.receiver_phone.trim()
      if (importFormData.receiver_address.trim()) orderData.receiver_address = importFormData.receiver_address.trim()
      if (importFormData.status.trim()) orderData.status = importFormData.status.trim() as any

      const result = await importOrders([orderData])

      if (result.success) {
        setImportResult({
          success: true,
          message: result.message || '导入成功'
        })
        addToast({
          type: 'success',
          message: result.message || '订单导入成功'
        })
        loadOrders(currentPage)

        // 清空表单
        setImportFormData({
          order_id: '',
          cookie_id: '',
          item_id: '',
          buyer_id: '',
          receiver_name: '',
          receiver_phone: '',
          receiver_address: '',
          status: '',
          quantity: '1',
          amount: ''
        })
      } else {
        setImportResult({
          success: false,
          message: result.message || '导入失败'
        })
        addToast({ type: 'error', message: result.message || '导入失败' })
      }
    } catch (e) {
      addToast({ type: 'error', message: '导入失败' })
    } finally {
      setImporting(false)
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
        loadOrders(currentPage)
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
    loadOrders(currentPage)
  }, [_hasHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    setCurrentPage(1)
    loadOrders(1)
  }, [selectedAccount, selectedStatus, token])

  const filteredOrders = orders.filter(order => {
    if (!searchKeyword) return true
    const keyword = searchKeyword.toLowerCase()
    return (
      order.order_id.toLowerCase().includes(keyword) ||
      order.receiver_name?.toLowerCase().includes(keyword) ||
      order.receiver_phone?.toLowerCase().includes(keyword)
    )
  })

  if (loading && !orders.length) {
    return <PageLoading />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50 dark:from-slate-900 dark:via-orange-950/20 dark:to-slate-900 transition-colors duration-200">
      {/* Top Bar */}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">订单管理</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                共 {total} 个订单
                {filteredOrders.length !== orders.length && ` · 筛选显示 ${filteredOrders.length} 个`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* 暗色模式切换 */}
              <button
                onClick={toggleDarkMode}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="切换暗色模式"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={() => loadOrders(currentPage)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
              <button
                onClick={handleRefreshAll}
                disabled={refreshing}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {refreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    刷新中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    批量刷新
                  </>
                )}
              </button>
              <button
                onClick={() => setImportModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-sm transition-all flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                导入订单
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="搜索订单号、收件人、手机号..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 border-0 rounded-xl text-sm placeholder:text-slate-500 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
              />
            </div>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${
                filterOpen || selectedAccount || selectedStatus
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              筛选
              {(selectedAccount || selectedStatus) && (
                <span className="px-1.5 py-0.5 bg-white/30 rounded text-xs">
                  {(selectedAccount ? 1 : 0) + (selectedStatus ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">账号筛选</label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    >
                      <option value="">所有账号</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.note || account.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">状态筛选</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    >
                      <option value="">所有状态</option>
                      {Object.entries(statusMap).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="px-6 lg:px-8 py-6 flex gap-6">
        {/* Orders List */}
        <div className={`transition-all ${selectedOrder ? 'flex-1' : 'w-full'}`}>
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-slate-600 dark:text-slate-400">暂无订单数据</p>
              </div>
            ) : (
              filteredOrders.map((order, index) => {
                const statusInfo = statusMap[order.status] || statusMap.unknown
                const isSelected = selectedOrder?.order_id === order.order_id
                const isRefreshing = refreshingOrders.has(order.order_id)

                return (
                  <motion.div
                    key={order.order_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.01, duration: 0.3 }}
                    onClick={() => handleShowDetail(order)}
                    className={`group bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden border border-slate-200 dark:border-slate-700 ${
                      isSelected ? 'ring-2 ring-orange-500' : ''
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono font-semibold text-slate-900 dark:text-white">
                              {order.order_id}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${statusInfo.bg} ${statusInfo.text} rounded-lg text-xs font-medium`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '-'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRefreshSingle(order.order_id)
                            }}
                            disabled={isRefreshing}
                            className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isRefreshing ? (
                              <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4 text-orange-600" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(order.order_id)
                            }}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">收件人</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {order.receiver_name || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">联系电话</p>
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {order.receiver_phone || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">订单金额</p>
                          <p className="text-lg font-bold text-orange-600">
                            ¥{parseFloat(order.amount || "0").toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl shadow-sm px-6 py-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                第 {currentPage} 页，共 {totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadOrders(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </button>
                <button
                  onClick={() => loadOrders(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedOrder && (
            <motion.div
              key={selectedOrder.order_id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full lg:w-96 flex-shrink-0"
            >
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl sticky top-24 overflow-hidden border border-slate-200 dark:border-slate-700">
                {/* Detail Header */}
                <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 text-white">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold">订单详情</h3>
                      <p className="text-sm text-orange-100 mt-0.5 font-mono">{selectedOrder.order_id}</p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {!editMode ? (
                      <>
                        <button
                          onClick={() => setEditMode(true)}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          onClick={() => handleRefreshSingle(selectedOrder.order_id)}
                          disabled={refreshingOrders.has(selectedOrder.order_id)}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {refreshingOrders.has(selectedOrder.order_id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          刷新
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleSubmitEdit}
                          disabled={submittingEdit}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {submittingEdit ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          保存
                        </button>
                        <button
                          onClick={() => setEditMode(false)}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Detail Content */}
                <div className="p-6 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Status Section */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4 text-orange-600" />
                          订单状态
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          {(() => {
                            const statusInfo = statusMap[selectedOrder.status] || statusMap.unknown
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${statusInfo.bg} ${statusInfo.text} rounded-lg text-sm font-medium`}>
                                <span className="w-2 h-2 rounded-full bg-current"></span>
                                {statusInfo.label}
                              </span>
                            )
                          })()}
                          {selectedOrder.system_shipped && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                              <CheckCircle className="w-3.5 h-3.5" />
                              已发货
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Buyer Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                          <User className="w-4 h-4 text-orange-600" />
                          买家信息
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">买家ID</span>
                            <span className="text-slate-900 dark:text-white font-mono">{selectedOrder.buyer_id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Receiver Info */}
                      {!editMode ? (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-orange-600" />
                            收货信息
                          </h4>
                          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">收件人</span>
                              <span className="text-slate-900 dark:text-white">{selectedOrder.receiver_name || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600 dark:text-slate-400">联系电话</span>
                              <span className="text-slate-900 dark:text-white">{selectedOrder.receiver_phone || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-600 dark:text-slate-400 block mb-1">收货地址</span>
                              <span className="text-slate-900 dark:text-white text-xs">{selectedOrder.receiver_address || '-'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">收件人</label>
                            <input
                              type="text"
                              value={editFormData.receiver_name || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, receiver_name: e.target.value })}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">联系电话</label>
                            <input
                              type="text"
                              value={editFormData.receiver_phone || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, receiver_phone: e.target.value })}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">收货地址</label>
                            <textarea
                              value={editFormData.receiver_address || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, receiver_address: e.target.value })}
                              rows={3}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-slate-600 transition-all resize-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Order Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-orange-600" />
                          订单信息
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">商品ID</span>
                            <span className="text-slate-900 dark:text-white font-mono text-xs">{selectedOrder.item_id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">规格</span>
                            <span className="text-slate-900 dark:text-white">{selectedOrder.spec_value || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">数量</span>
                            <span className="text-slate-900 dark:text-white">{selectedOrder.quantity || 1}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-600">
                            <span className="text-slate-600 dark:text-slate-400 font-medium">订单金额</span>
                            <span className="text-2xl font-bold text-orange-600">
                              ¥{parseFloat(selectedOrder.amount || "0").toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Time Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-orange-600" />
                          时间信息
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">创建时间</span>
                            <span className="text-slate-900 dark:text-white text-xs">
                              {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('zh-CN') : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">更新时间</span>
                            <span className="text-slate-900 dark:text-white text-xs">
                              {selectedOrder.updated_at ? new Date(selectedOrder.updated_at).toLocaleString('zh-CN') : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Detail Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => handleDelete(selectedOrder.order_id)}
                    className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除订单
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Refresh Result Modal */}
      <AnimatePresence>
        {refreshModalOpen && refreshResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setRefreshModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">批量刷新结果</h3>
                <button
                  onClick={() => setRefreshModalOpen(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{refreshResult.total}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">总数</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-3xl font-bold text-green-600">{refreshResult.updated}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">已更新</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-3xl font-bold text-blue-600">{refreshResult.no_change}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">无变化</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-3xl font-bold text-red-600">{refreshResult.failed}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">失败</p>
                  </div>
                </div>

                {/* Updated Orders List */}
                {refreshResult.updated_orders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">更新详情</h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {refreshResult.updated_orders.map((order) => (
                        <div key={order.order_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm">
                          <span className="font-mono text-slate-900 dark:text-white text-xs">{order.order_id}</span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-xs">
                              {order.old_status}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">→</span>
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                              {order.new_status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Orders Modal */}
      <AnimatePresence>
        {importModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setImportModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">导入订单</h3>
                  <p className="text-sm text-white/80 mt-1">手动添加订单信息</p>
                </div>
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                {/* Import Result */}
                {importResult && (
                  <div className={`mb-4 p-4 rounded-xl ${importResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                    <p className={`text-sm font-semibold ${importResult.success ? 'text-green-900 dark:text-green-400' : 'text-red-900 dark:text-red-400'}`}>
                      {importResult.message}
                    </p>
                  </div>
                )}

                {/* Form */}
                <div className="space-y-4">
                  {/* 必填字段 */}
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                    <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-400 mb-3">必填信息</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          订单号 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={importFormData.order_id}
                          onChange={(e) => setImportFormData({ ...importFormData, order_id: e.target.value })}
                          placeholder="请输入订单号"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          账号 <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={importFormData.cookie_id}
                          onChange={(e) => setImportFormData({ ...importFormData, cookie_id: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        >
                          <option value="">请选择账号</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.note || account.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 商品信息 */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">商品信息（选填）</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">商品ID</label>
                        <input
                          type="text"
                          value={importFormData.item_id}
                          onChange={(e) => setImportFormData({ ...importFormData, item_id: e.target.value })}
                          placeholder="商品ID"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">买家ID</label>
                        <input
                          type="text"
                          value={importFormData.buyer_id}
                          onChange={(e) => setImportFormData({ ...importFormData, buyer_id: e.target.value })}
                          placeholder="买家ID"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">订单金额</label>
                        <input
                          type="number"
                          step="0.01"
                          value={importFormData.amount}
                          onChange={(e) => setImportFormData({ ...importFormData, amount: e.target.value })}
                          placeholder="99.99"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">数量</label>
                        <input
                          type="number"
                          value={importFormData.quantity}
                          onChange={(e) => setImportFormData({ ...importFormData, quantity: e.target.value })}
                          placeholder="1"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 收货信息 */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">收货信息（选填）</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">收件人</label>
                        <input
                          type="text"
                          value={importFormData.receiver_name}
                          onChange={(e) => setImportFormData({ ...importFormData, receiver_name: e.target.value })}
                          placeholder="收件人姓名"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">联系电话</label>
                        <input
                          type="text"
                          value={importFormData.receiver_phone}
                          onChange={(e) => setImportFormData({ ...importFormData, receiver_phone: e.target.value })}
                          placeholder="手机号码"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">收货地址</label>
                        <textarea
                          value={importFormData.receiver_address}
                          onChange={(e) => setImportFormData({ ...importFormData, receiver_address: e.target.value })}
                          placeholder="详细地址"
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                          disabled={importing}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">订单状态</label>
                        <select
                          value={importFormData.status}
                          onChange={(e) => setImportFormData({ ...importFormData, status: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          disabled={importing}
                        >
                          <option value="">请选择状态</option>
                          <option value="processing">处理中</option>
                          <option value="pending_ship">待发货</option>
                          <option value="shipped">已发货</option>
                          <option value="completed">已完成</option>
                          <option value="cancelled">已关闭</option>
                          <option value="refunding">退款中</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setImportModalOpen(false)
                      setImportFormData({
                        order_id: '',
                        cookie_id: '',
                        item_id: '',
                        buyer_id: '',
                        receiver_name: '',
                        receiver_phone: '',
                        receiver_address: '',
                        status: '',
                        quantity: '1',
                        amount: ''
                      })
                      setImportResult(null)
                    }}
                    disabled={importing}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImportOrders}
                    disabled={importing || !importFormData.order_id.trim() || !importFormData.cookie_id.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        导入订单
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

