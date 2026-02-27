import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, MessageSquare, RefreshCw, Shield, ShoppingCart, Users,
  Clock, CheckCircle, AlertCircle, Package, Settings,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { getAccountDetails } from '@/api/accounts'
import { getKeywords } from '@/api/keywords'
import { getOrders } from '@/api/orders'
import { type AdminStats, getAdminStats } from '@/api/admin'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { AccountDetail } from '@/types'

interface DashboardStats {
  totalAccounts: number
  totalKeywords: number
  activeAccounts: number
  totalOrders: number
}

interface StatCardData {
  icon: typeof Users
  label: string
  value: number
  change?: number
  changeType?: 'increase' | 'decrease'
  color: 'primary' | 'success' | 'warning' | 'info' | 'danger'
}

export function DashboardV2() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalAccounts: 0,
    totalKeywords: 0,
    activeAccounts: 0,
    totalOrders: 0,
  })
  const [accounts, setAccounts] = useState<AccountDetail[]>([])
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [recentActivity] = useState<Array<{
    id: string
    type: 'order' | 'account' | 'keyword'
    message: string
    time: string
    status: 'success' | 'warning' | 'error' | 'info'
  }>>([])

  const loadDashboard = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)

      // 获取账号详情
      const accountsData = await getAccountDetails()

      // 为每个账号获取关键词数量
      const accountsWithKeywords = await Promise.all(
        accountsData.map(async (account) => {
          try {
            const keywords = await getKeywords(account.id)
            return {
              ...account,
              keywordCount: keywords.length,
            }
          } catch {
            return { ...account, keywordCount: 0 }
          }
        }),
      )

      // 计算统计数据
      let totalKeywords = 0
      let activeAccounts = 0

      accountsWithKeywords.forEach((account) => {
        const isEnabled = account.enabled !== false
        if (isEnabled) {
          activeAccounts++
          totalKeywords += account.keywordCount || 0
        }
      })

      // 获取订单数量
      let ordersCount = 0
      try {
        const ordersResult = await getOrders()
        if (ordersResult.success) {
          ordersCount = ordersResult.data?.length || 0
        }
      } catch {
        // ignore
      }

      setStats({
        totalAccounts: accountsWithKeywords.length,
        totalKeywords,
        activeAccounts,
        totalOrders: ordersCount,
      })

      setAccounts(accountsWithKeywords)

      // 管理员获取全局统计
      if (user?.is_admin) {
        try {
          const adminResult = await getAdminStats()
          if (adminResult.success && adminResult.data) {
            setAdminStats(adminResult.data)
          }
        } catch {
          // ignore
        }
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

  const statCards: StatCardData[] = [
    {
      icon: Users,
      label: '总账号数',
      value: stats.totalAccounts,
      color: 'primary',
    },
    {
      icon: MessageSquare,
      label: '总关键词数',
      value: stats.totalKeywords,
      color: 'success',
    },
    {
      icon: Activity,
      label: '启用账号数',
      value: stats.activeAccounts,
      color: 'warning',
    },
    {
      icon: ShoppingCart,
      label: '总订单数',
      value: stats.totalOrders,
      color: 'info',
    },
  ]

  const iconColorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    info: 'bg-info-50 text-info-600',
    danger: 'bg-danger-50 text-danger-600',
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="text-sm text-gray-500 mt-1">系统概览和业务数据分析</p>
        </div>
        <Button onClick={loadDashboard} variant="secondary">
          <RefreshCw className="w-4 h-4" />
          刷新数据
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Card hover className="h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600 mb-1">{card.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mb-2">{card.value}</p>
                      {card.change !== undefined && (
                        <div className={`flex items-center gap-1 text-xs font-medium ${
                          card.changeType === 'increase' ? 'text-success-600' : 'text-danger-600'
                        }`}>
                          {card.changeType === 'increase' ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          <span>{Math.abs(card.change)}%</span>
                        </div>
                      )}
                    </div>
                    <div className={`p-3 rounded-xl ${iconColorClasses[card.color]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Admin Stats - 管理员专属 */}
      {user?.is_admin && adminStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary-50">
                  <Shield className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <CardTitle>全局统计</CardTitle>
                  <CardDescription>管理员视图 - 跨用户数据汇总</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-2xl font-bold text-primary-600">{adminStats.total_users}</p>
                  <p className="text-xs text-gray-500 mt-1">总用户数</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-2xl font-bold text-success-600">{adminStats.total_cookies}</p>
                  <p className="text-xs text-gray-500 mt-1">总账号数</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-2xl font-bold text-warning-600">{adminStats.active_cookies}</p>
                  <p className="text-xs text-gray-500 mt-1">活跃账号</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-2xl font-bold text-info-600">{adminStats.total_cards}</p>
                  <p className="text-xs text-gray-500 mt-1">总卡券数</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-2xl font-bold text-primary-600">{adminStats.total_keywords}</p>
                  <p className="text-xs text-gray-500 mt-1">总关键词</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-2xl font-bold text-danger-600">{adminStats.total_orders}</p>
                  <p className="text-xs text-gray-500 mt-1">总订单数</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary-50">
                  <Settings className="w-5 h-5 text-primary-600" />
                </div>
                <CardTitle>快捷操作</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="ghost" className="w-full justify-start text-left">
                  <Package className="w-4 h-4" />
                  查看待处理订单
                </Button>
                <Button variant="ghost" className="w-full justify-start text-left">
                  <Users className="w-4 h-4" />
                  管理账号
                </Button>
                <Button variant="ghost" className="w-full justify-start text-left">
                  <MessageSquare className="w-4 h-4" />
                  配置关键词
                </Button>
                <Button variant="ghost" className="w-full justify-start text-left">
                  <Settings className="w-4 h-4" />
                  系统设置
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-success-50">
                  <Activity className="w-5 h-5 text-success-600" />
                </div>
                <CardTitle>最近活动</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">暂无最近活动</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => {
                    const statusIcons = {
                      success: <CheckCircle className="w-4 h-4 text-success-600" />,
                      warning: <Clock className="w-4 h-4 text-warning-600" />,
                      error: <AlertCircle className="w-4 h-4 text-danger-600" />,
                      info: <Activity className="w-4 h-4 text-info-600" />,
                    }

                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="mt-0.5">{statusIcons[activity.status]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{activity.message}</p>
                          <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                        </div>
                        <Badge variant={activity.status as any}>{activity.type}</Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Accounts Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-info-50">
                  <Users className="w-5 h-5 text-info-600" />
                </div>
                <div>
                  <CardTitle>账号概览</CardTitle>
                  <CardDescription>共 {accounts.length} 个账号，{stats.activeAccounts} 个已启用</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">账号ID</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">备注</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">关键词数</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">状态</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">更新时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.slice(0, 10).map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-gray-900 font-mono">{account.id}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{account.note || '-'}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-xs font-medium">
                          <MessageSquare className="w-3 h-3" />
                          {account.keywordCount || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={account.enabled !== false ? 'success' : 'secondary'}>
                          {account.enabled !== false ? '已启用' : '已禁用'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {account.updated_at ? new Date(account.updated_at).toLocaleString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
