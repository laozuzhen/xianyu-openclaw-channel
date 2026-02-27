import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  DollarSign,
  MapPin,
  Package,
  RefreshCw,
  PieChart,
  Activity,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react'
import {
  getOrderAnalytics,
  getValidOrders,
  DateRangePresets,
  getStatusName,
  getStatusColor,
  INVALID_ORDER_STATUSES,
  type OrderAnalytics,
  type ValidOrder
} from '@/api/analytics'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'

/**
 * 日期范围选择器快捷选项
 */
const dateRangeOptions = [
  { key: 'today', ...DateRangePresets.today() },
  { key: 'yesterday', ...DateRangePresets.yesterday() },
  { key: 'last7Days', ...DateRangePresets.last7Days() },
  { key: 'last30Days', ...DateRangePresets.last30Days() },
  { key: 'thisWeek', ...DateRangePresets.thisWeek() },
  { key: 'lastWeek', ...DateRangePresets.lastWeek() },
  { key: 'thisMonth', ...DateRangePresets.thisMonth() },
  { key: 'lastMonth', ...DateRangePresets.lastMonth() }
]

export function About() {
  const { addToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null)
  const [validOrders, setValidOrders] = useState<ValidOrder[]>([])
  const [showOrders, setShowOrders] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedRange, setSelectedRange] = useState('last30Days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDate, setShowCustomDate] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  // 加载分析数据
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)

      let start_date, end_date

      if (showCustomDate && customStartDate && customEndDate) {
        start_date = customStartDate
        end_date = customEndDate
      } else if (selectedRange !== 'custom') {
        const preset = dateRangeOptions.find(opt => opt.key === selectedRange)
        if (preset) {
          start_date = preset.start_date
          end_date = preset.end_date
        }
      }

      const result = await getOrderAnalytics({ start_date, end_date })

      if (result.success && result.data) {
        setAnalytics(result.data)
      } else {
        addToast({ type: 'error', message: '加载数据失败' })
      }
    } catch (error) {
      console.error('加载订单分析失败:', error)
      addToast({ type: 'error', message: '加载数据失败' })
    } finally {
      setLoading(false)
    }
  }, [selectedRange, showCustomDate, customStartDate, customEndDate, addToast])

  // 加载有效订单列表
  const loadValidOrders = useCallback(async () => {
    try {
      setOrdersLoading(true)

      let start_date, end_date

      if (showCustomDate && customStartDate && customEndDate) {
        start_date = customStartDate
        end_date = customEndDate
      } else if (selectedRange !== 'custom') {
        const preset = dateRangeOptions.find(opt => opt.key === selectedRange)
        if (preset) {
          start_date = preset.start_date
          end_date = preset.end_date
        }
      }

      const result = await getValidOrders({ start_date, end_date })

      if (result.success && result.data) {
        setValidOrders(result.data)
      }
    } catch (error) {
      console.error('加载有效订单失败:', error)
    } finally {
      setOrdersLoading(false)
    }
  }, [selectedRange, showCustomDate, customStartDate, customEndDate])

  // 初始加载
  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // 当前选择的日期范围
  const currentRange = dateRangeOptions.find(opt => opt.key === selectedRange)

  // 格式化货币
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/[¥,]/g, '')) : amount
    return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // SVG饼状图组件
  const PieChartSVG = ({ data }: { data: Array<{ label: string; value: number; color: string }> }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    let currentAngle = 0

    const slices = data.map((item, index) => {
      if (total === 0) return null
      const angle = (item.value / total) * 360

      const x1 = 50 + 50 * Math.cos((Math.PI * currentAngle) / 180)
      const y1 = 50 + 50 * Math.sin((Math.PI * currentAngle) / 180)
      const x2 = 50 + 50 * Math.cos((Math.PI * (currentAngle + angle)) / 180)
      const y2 = 50 + 50 * Math.sin((Math.PI * (currentAngle + angle)) / 180)

      const largeArcFlag = angle > 180 ? 1 : 0

      const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`

      currentAngle += angle

      return (
        <g key={index} style={{ transformOrigin: 'center', transition: 'transform 0.3s ease' }}>
          <path
            d={pathData}
            fill={item.color}
            stroke="white"
            strokeWidth="1"
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        </g>
      )
    })

    return (
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
        {slices}
        {total === 0 && (
          <circle cx="50" cy="50" r="50" fill="#e2e8f0" />
        )}
      </svg>
    )
  }

  // SVG曲线图组件
  const LineChartSVG = ({ data }: { data: Array<{ label: string; value: number }> }) => {
    if (data.length === 0) return null

    const max = Math.max(...data.map(d => d.value), 1)
    const padding = 10
    const width = 300
    const height = 100
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * chartWidth
      const y = padding + chartHeight - (d.value / max) * chartHeight
      return { x, y, value: d.value, label: d.label }
    })

    const pathD = points.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = points[i - 1]
      const cp1x = prev.x + (p.x - prev.x) / 2
      const cp1y = prev.y
      const cp2x = prev.x + (p.x - prev.x) / 2
      const cp2y = p.y
      return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`
    }).join(' ')

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {[0, 25, 50, 75, 100].map((percent, i) => (
          <line
            key={i}
            x1={padding}
            y1={padding + (chartHeight * percent) / 100}
            x2={width - padding}
            y2={padding + (chartHeight * percent) / 100}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        ))}

        <path
          d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
          fill="rgba(245, 158, 11, 0.1)"
          className="animate-pulse"
        />

        <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2" className="drop-shadow-md" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#f59e0b"
            className="hover:r-5 transition-all duration-200 cursor-pointer"
          />
        ))}
      </svg>
    )
  }

  return (
    <div className="max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div className="page-header flex-between flex-wrap gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            订单数据报表
          </h1>
          <p className="page-description">BI数据大屏 - 订单分析与收益统计</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button
              className={cn(
                'btn-ios-secondary flex items-center gap-2',
                showCustomDate && 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
              )}
              onClick={() => {
                const dropdown = document.getElementById('date-range-dropdown')
                dropdown?.classList.toggle('hidden')
              }}
            >
              <Calendar className="w-4 h-4" />
              {showCustomDate ? '自定义' : (currentRange?.label || '选择时间范围')}
              <ChevronDown className="w-4 h-4" />
            </button>

            <div
              id="date-range-dropdown"
              className="hidden absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50"
            >
              <div className="p-2 space-y-1">
                {dateRangeOptions.map(option => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setSelectedRange(option.key)
                      setShowCustomDate(false)
                      document.getElementById('date-range-dropdown')?.classList.add('hidden')
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200',
                      selectedRange === option.key && !showCustomDate
                        ? 'bg-amber-500 text-white scale-105'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                <button
                  onClick={() => {
                    setShowCustomDate(true)
                    setSelectedRange('custom')
                    document.getElementById('date-range-dropdown')?.classList.add('hidden')
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    showCustomDate
                      ? 'bg-amber-500 text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  )}
                >
                  自定义日期
                </button>
              </div>
            </div>
          </div>

          {showCustomDate && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input-ios w-40"
              />
              <span className="text-slate-500 dark:text-slate-400">至</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input-ios w-40"
              />
            </>
          )}

          <button
            onClick={loadAnalytics}
            className="btn-ios-primary"
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="vben-card">
          <div className="vben-card-body flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">加载数据中...</p>
            </div>
          </div>
        </div>
      ) : analytics ? (
        <>
          {/* 核心收益指标 - 突出显示 */}
          <div className="vben-card bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
            <div className="vben-card-header">
              <div className="flex items-center justify-between">
                <h2 className="vben-card-title flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <DollarSign className="w-5 h-5" />
                  收益总览（估值）
                </h2>
                <button
                  onClick={() => {
                    if (!showOrders) {
                      loadValidOrders()
                    }
                    setShowOrders(!showOrders)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {showOrders ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    {showOrders ? '隐藏' : '查看'}有效订单明细
                  </span>
                  <ChevronRight className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    showOrders && 'rotate-90'
                  )} />
                </button>
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded mt-2 inline-block">
                * 实际收益会扣除平台费用、税费等
              </span>
            </div>
            <div className="vben-card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div
                  className="text-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-default"
                  onMouseEnter={() => setHoveredCard('total')}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">期间总收益</p>
                  <p className="text-4xl lg:text-5xl font-bold text-amber-600 dark:text-amber-400 mb-2 transition-transform duration-300"
                     style={{ transform: hoveredCard === 'total' ? 'scale(1.1)' : 'scale(1)' }}>
                    {formatCurrency(analytics.revenue_stats.total_amount)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    共 {analytics.revenue_stats.total_orders.toLocaleString()} 个有效订单
                  </p>
                </div>

                <div
                  className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg transition-all duration-300 hover:shadow-lg cursor-default"
                  onMouseEnter={() => setHoveredCard('avg')}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">平均客单价</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(analytics.revenue_stats.avg_amount)}
                  </p>
                </div>

                <div
                  className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg transition-all duration-300 hover:shadow-lg cursor-default"
                  onMouseEnter={() => setHoveredCard('buyers')}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">独立买家</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {analytics.revenue_stats.unique_buyers.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    人均 {(analytics.revenue_stats.total_amount / Math.max(analytics.revenue_stats.unique_buyers, 1)).toFixed(2)}
                  </p>
                </div>

                <div
                  className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg transition-all duration-300 hover:shadow-lg cursor-default"
                  onMouseEnter={() => setHoveredCard('items')}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">独立商品</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {analytics.revenue_stats.unique_items.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 有效订单明细 - 折叠面板 */}
          {showOrders && (
            <div className="vben-card overflow-hidden">
              <div className="vben-card-header">
                <h2 className="vben-card-title flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  有效订单明细（已排除退货、取消等无效订单）
                </h2>
              </div>
              <div className="vben-card-body">
                {ordersLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
                    <p className="text-slate-500 dark:text-slate-400">加载中...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 统计信息 */}
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <span>共 <strong className="text-amber-600 dark:text-amber-400">{validOrders.length}</strong> 个有效订单</span>
                      <span>•</span>
                      <span>已排除状态: {INVALID_ORDER_STATUSES.join('、')}</span>
                    </div>

                    {/* 订单列表 */}
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-white dark:bg-slate-800 shadow-sm">
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">订单ID</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">商品ID</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">金额</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">状态</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">规格</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">数量</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">城市</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">创建时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validOrders.map((order, index) => (
                            <tr
                              key={index}
                              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <td className="py-3 px-4 text-sm font-mono text-slate-700 dark:text-slate-300">
                                {order.order_id}
                              </td>
                              <td className="py-3 px-4 text-sm font-mono text-slate-600 dark:text-slate-400">
                                {order.item_id || '-'}
                              </td>
                              <td className="py-3 px-4 text-sm font-semibold text-amber-600 dark:text-amber-400">
                                {formatCurrency(order.amount)}
                              </td>
                              <td className="py-3 px-4">
                                <span className={cn('text-xs px-2 py-1 rounded', getStatusColor(order.order_status))}>
                                  {getStatusName(order.order_status)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                                {order.spec_name && order.spec_value ? `${order.spec_name}: ${order.spec_value}` : '-'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">
                                {order.quantity || '-'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                                {order.receiver_city || '-'}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                                {order.created_at}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 收益趋势曲线图 */}
            <div className="vben-card">
              <div className="vben-card-header">
                <h2 className="vben-card-title flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  收益趋势（最近30天）
                </h2>
              </div>
              <div className="vben-card-body">
                {analytics.daily_stats.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-48">
                      <LineChartSVG
                        data={analytics.daily_stats.slice(0, 30).reverse().map(d => ({
                          label: d.date,
                          value: d.amount
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      {analytics.daily_stats.slice(0, 10).reverse().map((day, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm p-2 bg-slate-50 dark:bg-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-default"
                        >
                          <span className="text-slate-600 dark:text-slate-400">{day.date}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-700 dark:text-slate-300">{day.order_count}单</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {formatCurrency(day.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">暂无数据</div>
                )}
              </div>
            </div>

            {/* 订单状态分布饼状图 */}
            <div className="vben-card">
              <div className="vben-card-header">
                <h2 className="vben-card-title flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  订单状态分布
                </h2>
              </div>
              <div className="vben-card-body">
                {analytics.status_stats.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="aspect-square max-w-[200px] mx-auto">
                      <PieChartSVG
                        data={analytics.status_stats.map((stat, index) => ({
                          label: stat.status,
                          value: stat.count,
                          color: [
                            '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
                            '#ec4899', '#06b6d4', '#84cc16', '#f97316'
                          ][index % 8]
                        }))}
                      />
                    </div>

                    <div className="space-y-3">
                      {analytics.status_stats.map((stat, index) => {
                        const percentage = analytics.revenue_stats.total_orders > 0
                          ? (stat.count / analytics.revenue_stats.total_orders * 100).toFixed(1)
                          : 0

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-default"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full transition-transform hover:scale-125"
                                style={{
                                  backgroundColor: [
                                    '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
                                    '#ec4899', '#06b6d4', '#84cc16', '#f97316'
                                  ][index % 8]
                                }}
                              />
                              <span className={cn('text-sm px-2 py-1 rounded', getStatusColor(stat.status))}>
                                {getStatusName(stat.status)}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {stat.count}单 ({percentage}%)
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {formatCurrency(stat.amount)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">暂无数据</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 地区分布 */}
            <div className="vben-card">
              <div className="vben-card-header">
                <h2 className="vben-card-title flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  地区分布 TOP 10
                </h2>
              </div>
              <div className="vben-card-body">
                {analytics.city_stats.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.city_stats.slice(0, 10).map((stat, index) => {
                      const maxCount = Math.max(...analytics.city_stats.map(s => s.order_count), 1)
                      const percentage = (stat.order_count / maxCount) * 100

                      return (
                        <div
                          key={index}
                          className="space-y-1 group"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white transition-transform group-hover:scale-110',
                                  index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-orange-400' : 'bg-slate-300'
                                )}
                              >
                                {index + 1}
                              </span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {stat.city || '未知城市'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 dark:text-slate-400">{stat.order_count}单</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrency(stat.total_amount)}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500 ease-out',
                                index === 0 ? 'bg-amber-500' : 'bg-amber-300 dark:bg-amber-700'
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无地区数据</p>
                    <p className="text-xs mt-1">需要刷新订单状态以获取收货地址</p>
                  </div>
                )}
              </div>
            </div>

            {/* 商品排行 */}
            <div className="vben-card">
              <div className="vben-card-header">
                <h2 className="vben-card-title flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  商品排行 TOP 10
                </h2>
              </div>
              <div className="vben-card-body">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">排名</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">商品ID</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">订单数</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">总金额</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">平均金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.item_stats.slice(0, 10).map((item, index) => (
                        <tr
                          key={index}
                          className={cn(
                            'border-b border-slate-100 dark:border-slate-800 transition-colors',
                            index === 0 && 'bg-amber-50/50 dark:bg-amber-900/10'
                          )}
                        >
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-transform hover:scale-110',
                                index === 0
                                  ? 'bg-amber-500 text-white'
                                  : index === 1
                                  ? 'bg-slate-400 text-white'
                                  : index === 2
                                  ? 'bg-orange-400 text-white'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              )}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm font-mono text-slate-700 dark:text-slate-300">
                            {item.item_id}
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-slate-900 dark:text-slate-100">
                            {item.order_count}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-medium text-amber-600 dark:text-amber-400">
                            {formatCurrency(item.total_amount)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-slate-600 dark:text-slate-400">
                            {formatCurrency(item.avg_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="vben-card">
          <div className="vben-card-body text-center py-12 text-slate-500 dark:text-slate-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无数据</p>
          </div>
        </div>
      )}
    </div>
  )
}
