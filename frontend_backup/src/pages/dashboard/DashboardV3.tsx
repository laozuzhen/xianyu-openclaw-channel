import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, MessageSquare, RefreshCw, Shield, ShoppingCart, Users,
  TrendingUp, TrendingDown, Filter, Download,
  MoreVertical, ArrowRight, Bell, Settings as SettingsIcon, Sun, Moon
} from 'lucide-react'
import { getAccountDetails } from '@/api/accounts'
import { getKeywords } from '@/api/keywords'
import { getOrders } from '@/api/orders'
import { type AdminStats, getAdminStats } from '@/api/admin'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import type { AccountDetail } from '@/types'

interface DashboardStats {
  totalAccounts: number
  totalKeywords: number
  activeAccounts: number
  totalOrders: number
}

interface QuickAction {
  id: string
  label: string
  icon: typeof Users
  href: string
  color: string
  bgColor: string
}

export function DashboardV3() {
  const { addToast, darkMode, toggleDarkMode } = useUIStore()
  const { isAuthenticated, token, _hasHydrated, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')
  const [stats, setStats] = useState<DashboardStats>({
    totalAccounts: 0,
    totalKeywords: 0,
    activeAccounts: 0,
    totalOrders: 0,
  })
  const [accounts, setAccounts] = useState<AccountDetail[]>([])
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)

  const loadDashboard = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)

      const accountsData = await getAccountDetails()
      const accountsWithKeywords = await Promise.all(
        accountsData.map(async (account) => {
          try {
            const keywords = await getKeywords(account.id)
            return { ...account, keywordCount: keywords.length }
          } catch {
            return { ...account, keywordCount: 0 }
          }
        }),
      )

      let totalKeywords = 0
      let activeAccounts = 0

      accountsWithKeywords.forEach((account) => {
        const isEnabled = account.enabled !== false
        if (isEnabled) {
          activeAccounts++
          totalKeywords += account.keywordCount || 0
        }
      })

      let ordersCount = 0
      try {
        const ordersResult = await getOrders()
        if (ordersResult.success) {
          ordersCount = ordersResult.data?.length || 0
        }
      } catch {}

      setStats({
        totalAccounts: accountsWithKeywords.length,
        totalKeywords,
        activeAccounts,
        totalOrders: ordersCount,
      })

      setAccounts(accountsWithKeywords)

      if (user?.is_admin) {
        try {
          const adminResult = await getAdminStats()
          if (adminResult.success && adminResult.data) {
            setAdminStats(adminResult.data)
          }
        } catch {}
      }
    } catch {
      addToast({ type: 'error', message: '加载仪表盘数据失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadDashboard()
  }, [_hasHydrated, isAuthenticated, token])

  if (loading) {
    return <PageLoading />
  }

  const quickActions: QuickAction[] = [
    { id: 'accounts', label: '管理账号', icon: Users, href: '/accounts', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 'orders', label: '查看订单', icon: ShoppingCart, href: '/orders', color: 'text-green-600', bgColor: 'bg-green-50' },
    { id: 'keywords', label: '配置关键词', icon: MessageSquare, href: '/keywords', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: 'settings', label: '系统设置', icon: SettingsIcon, href: '/settings', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors duration-200">
      {/* 顶部导航栏 */}
      <div className="bg-white dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-sm">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">工作台</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">欢迎回来，{user?.username || '管理员'}</p>
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

              {/* 时间范围选择 */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                {['today', 'week', 'month'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as any)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      timeRange === range
                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {range === 'today' ? '今日' : range === 'week' ? '本周' : '本月'}
                  </button>
                ))}
              </div>

              <button className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <button
                onClick={loadDashboard}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新数据
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6 space-y-6">
        {/* 核心指标卡片 - 大卡片设计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: '总账号数',
              value: stats.totalAccounts,
              change: '+12.5%',
              trend: 'up',
              icon: Users,
              color: 'from-blue-500 to-blue-600',
              lightBg: 'bg-blue-50',
              darkIcon: 'text-blue-600',
            },
            {
              label: '总关键词',
              value: stats.totalKeywords,
              change: '+8.2%',
              trend: 'up',
              icon: MessageSquare,
              color: 'from-green-500 to-green-600',
              lightBg: 'bg-green-50',
              darkIcon: 'text-green-600',
            },
            {
              label: '活跃账号',
              value: stats.activeAccounts,
              change: '+23.1%',
              trend: 'up',
              icon: Activity,
              color: 'from-purple-500 to-purple-600',
              lightBg: 'bg-purple-50',
              darkIcon: 'text-purple-600',
            },
            {
              label: '总订单数',
              value: stats.totalOrders,
              change: '+15.3%',
              trend: 'up',
              icon: ShoppingCart,
              color: 'from-orange-500 to-orange-600',
              lightBg: 'bg-orange-50',
              darkIcon: 'text-orange-600',
            },
          ].map((stat, index) => {
            const Icon = stat.icon
            const TrendIcon = stat.trend === 'up' ? TrendingUp : TrendingDown

            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl dark:hover:shadow-slate-900/50 transition-all duration-300 overflow-hidden"
              >
                {/* 渐变背景装饰 */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-5 dark:opacity-10 rounded-full -mr-16 -mt-16 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity`}></div>

                <div className="p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${stat.lightBg} dark:bg-opacity-20 rounded-xl`}>
                      <Icon className={`w-6 h-6 ${stat.darkIcon} dark:brightness-150`} />
                    </div>
                    <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value.toLocaleString()}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</p>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div className={`flex items-center gap-1 text-xs font-medium ${
                      stat.trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      <TrendIcon className="w-3.5 h-3.5" />
                      <span>{stat.change}</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">vs 上周</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：快捷操作 + 管理员统计 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 快捷操作 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">快捷操作</h2>
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1">
                  查看全部
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon
                  return (
                    <motion.a
                      key={action.id}
                      href={action.href}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      className="group relative p-5 rounded-xl border-2 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                    >
                      <div className={`${action.bgColor} dark:bg-opacity-20 w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-6 h-6 ${action.color} dark:brightness-125`} />
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{action.label}</p>
                    </motion.a>
                  )
                })}
              </div>
            </motion.div>

            {/* 管理员全局统计 */}
            {user?.is_admin && adminStats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 text-white"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold">管理员全局统计</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: '总用户数', value: adminStats.total_users, color: 'text-blue-400' },
                    { label: '总账号数', value: adminStats.total_cookies, color: 'text-green-400' },
                    { label: '活跃账号', value: adminStats.active_cookies, color: 'text-yellow-400' },
                    { label: '总卡券数', value: adminStats.total_cards, color: 'text-purple-400' },
                    { label: '总关键词', value: adminStats.total_keywords, color: 'text-pink-400' },
                    { label: '总订单数', value: adminStats.total_orders, color: 'text-orange-400' },
                  ].map((item, index) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/15 transition-colors"
                    >
                      <p className={`text-2xl font-bold ${item.color} mb-1`}>
                        {item.value.toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-300">{item.label}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 账号状态概览 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">账号状态概览</h2>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <Filter className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">账号</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">关键词</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">状态</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">更新时间</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {accounts.slice(0, 5).map((account, index) => {
                      const isEnabled = account.enabled !== false
                      const keywordCount = account.keywordCount || 0

                      return (
                        <motion.tr
                          key={account.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7 + index * 0.05 }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                {account.id.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{account.id}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">ID: {account.id.substring(0, 8)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {keywordCount}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${
                              isEnabled
                                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isEnabled ? 'bg-green-500' : 'bg-slate-400'
                              }`}></span>
                              {isEnabled ? '运行中' : '已禁用'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">
                            {account.updated_at
                              ? new Date(account.updated_at).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
                              查看详情
                            </button>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {accounts.length > 5 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-center">
                  <a
                    href="/accounts"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                  >
                    查看全部 {accounts.length} 个账号
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              )}
            </motion.div>
          </div>

          {/* 右侧：活动日志 */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">最近活动</h2>
                <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                  查看全部
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { type: 'success', message: '新订单已创建', time: '2分钟前', icon: ShoppingCart },
                  { type: 'info', message: '账号状态已更新', time: '15分钟前', icon: Users },
                  { type: 'warning', message: '关键词配置已修改', time: '1小时前', icon: MessageSquare },
                  { type: 'info', message: '系统自动回复已发送', time: '2小时前', icon: Activity },
                ].map((activity, index) => {
                  const Icon = activity.icon
                  const colors = {
                    success: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                    info: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                    warning: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
                  }

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${colors[activity.type as keyof typeof colors]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.message}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activity.time}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>

            {/* 系统健康状态 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 p-6"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">系统状态</h2>

              <div className="space-y-4">
                {[
                  { label: 'API 服务', status: 'running', value: '99.9%' },
                  { label: '数据库', status: 'running', value: '正常' },
                  { label: '浏览器池', status: 'running', value: '3/3' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</span>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
