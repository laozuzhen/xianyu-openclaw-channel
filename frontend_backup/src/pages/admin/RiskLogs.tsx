import { useState, useEffect } from 'react'
import { ShieldAlert, RefreshCw, Trash2 } from 'lucide-react'
import { getRiskLogs, clearRiskLogs, type RiskLog } from '@/api/admin'
import { getAccounts } from '@/api/accounts'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import type { Account } from '@/types'

export function RiskLogs() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<RiskLog[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')

  const loadLogs = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getRiskLogs({ cookie_id: selectedAccount || undefined })
      if (result.success) {
        setLogs(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载风控日志失败' })
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
    loadLogs()
  }, [_hasHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadLogs()
  }, [_hasHydrated, isAuthenticated, token, selectedAccount])

  const handleClear = async () => {
    if (!confirm('确定要清空所有风控日志吗？此操作不可恢复！')) return
    try {
      const result = await clearRiskLogs()
      if (result.success) {
        addToast({ type: 'success', message: '日志已清空' })
        loadLogs()
      } else {
        addToast({ type: 'error', message: result.message || '清空失败' })
      }
    } catch {
      addToast({ type: 'error', message: '清空失败' })
    }
  }

  if (loading && logs.length === 0) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">风控日志</h1>
          <p className="page-description">查看账号风控相关日志</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleClear} className="btn-ios-danger ">
            <Trash2 className="w-4 h-4" />
            清空日志
          </button>
          <button onClick={loadLogs} className="btn-ios-secondary ">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="vben-card">
        <div className="vben-card-body">
          <div className="max-w-md">
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
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            风控日志
          </h2>
          <span className="badge-primary">{logs.length} 条记录</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios">
            <thead>
              <tr>
                <th>账号ID</th>
                <th>风控类型</th>
                <th>事件描述</th>
                <th>处理结果</th>
                <th>处理状态</th>
                <th>错误信息</th>
                <th>创建时间</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                      <p>暂无风控日志</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-medium text-amber-600 dark:text-amber-400">{log.cookie_id}</td>
                    <td>
                      <span className="badge-danger">{log.risk_type}</span>
                    </td>
                    <td className="max-w-[200px] text-slate-500 dark:text-slate-400">
                      <span 
                        className="block truncate cursor-help" 
                        title={log.message}
                      >
                        {log.message || '-'}
                      </span>
                    </td>
                    <td className="max-w-[200px] text-slate-500 dark:text-slate-400">
                      <span 
                        className="block truncate cursor-help" 
                        title={log.processing_result}
                      >
                        {log.processing_result || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs px-2 py-1 rounded ${
                        log.processing_status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        log.processing_status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        log.processing_status === 'processing' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {log.processing_status === 'success' ? '成功' :
                         log.processing_status === 'failed' ? '失败' :
                         log.processing_status === 'processing' ? '处理中' :
                         log.processing_status || '-'}
                      </span>
                    </td>
                    <td className="max-w-[150px] text-red-500 dark:text-red-400">
                      <span 
                        className="block truncate cursor-help" 
                        title={log.error_message || ''}
                      >
                        {log.error_message || '-'}
                      </span>
                    </td>
                    <td className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
                      {log.updated_at ? new Date(log.updated_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
