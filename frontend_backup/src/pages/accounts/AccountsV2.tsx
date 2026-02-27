import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, RefreshCw, QrCode, Key, Edit2, Trash2, Power, PowerOff, X, Loader2,
  Clock, CheckCircle, MessageSquare, Bot, Eye, EyeOff, AlertTriangle
} from 'lucide-react'
import {
  getAccountDetails, deleteAccount, updateAccountCookie, updateAccountStatus,
  updateAccountRemark, addAccount, generateQRLogin, checkQRLoginStatus, passwordLogin,
  updateAccountAutoConfirm, updateAccountPauseDuration, getAllAIReplySettings,
  getAIReplySettings, updateAIReplySettings, updateAccountLoginInfo,
  type AIReplySettings
} from '@/api/accounts'
import { getKeywords } from '@/api/keywords'
import { checkDefaultPassword } from '@/api/settings'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'
import type { AccountDetail } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

type ModalType = 'qrcode' | 'password' | 'manual' | 'edit' | 'default-reply' | 'ai-settings' | null

interface AccountWithKeywordCount extends AccountDetail {
  keywordCount?: number
  aiEnabled?: boolean
}

export function AccountsV2() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<AccountWithKeywordCount[]>([])
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  // 默认密码检查状态
  const [showPasswordWarning, setShowPasswordWarning] = useState(false)

  // 扫码登录状态
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [, setQrSessionId] = useState('')
  const [qrStatus, setQrStatus] = useState<'loading' | 'ready' | 'scanned' | 'success' | 'expired' | 'error'>('loading')
  const qrCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 密码登录状态
  const [pwdAccount, setPwdAccount] = useState('')
  const [pwdPassword, setPwdPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdShowBrowser, setPwdShowBrowser] = useState(false)

  // 手动输入状态
  const [manualAccountId, setManualAccountId] = useState('')
  const [manualCookie, setManualCookie] = useState('')

  // 编辑账号状态
  const [editingAccount, setEditingAccount] = useState<AccountDetail | null>(null)
  const [editNote, setEditNote] = useState('')
  const [editCookie, setEditCookie] = useState('')
  const [editAutoConfirm, setEditAutoConfirm] = useState(false)
  const [editPauseDuration, setEditPauseDuration] = useState(0)
  const [editSaving, setEditSaving] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editLoginPassword, setEditLoginPassword] = useState('')
  const [editShowBrowser, setEditShowBrowser] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // AI设置状态
  const [aiSettingsAccount, setAiSettingsAccount] = useState<AccountWithKeywordCount | null>(null)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiMaxDiscountPercent, setAiMaxDiscountPercent] = useState(10)
  const [aiMaxDiscountAmount, setAiMaxDiscountAmount] = useState(100)
  const [aiMaxBargainRounds, setAiMaxBargainRounds] = useState(3)
  const [aiCustomPrompts, setAiCustomPrompts] = useState('')
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false)
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false)

  const loadAccounts = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const data = await getAccountDetails()

      // 获取所有账号的AI回复设置
      let aiSettings: Record<string, AIReplySettings> = {}
      try {
        aiSettings = await getAllAIReplySettings()
      } catch {
        // ignore
      }

      // 为每个账号获取关键词数量
      const accountsWithKeywords = await Promise.all(
        data.map(async (account) => {
          try {
            const keywords = await getKeywords(account.id)
            return {
              ...account,
              keywordCount: keywords.length,
              aiEnabled: aiSettings[account.id]?.ai_enabled ?? aiSettings[account.id]?.enabled ?? false,
            }
          } catch {
            return { ...account, keywordCount: 0, aiEnabled: false }
          }
        }),
      )

      setAccounts(accountsWithKeywords)

      // 检查默认密码
      try {
        const pwdCheck = await checkDefaultPassword()
        setShowPasswordWarning(pwdCheck.using_default ?? false)
      } catch {
        // ignore
      }
    } catch {
      addToast({ type: 'error', message: '加载账号列表失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadAccounts()
  }, [_hasHydrated, isAuthenticated, token])

  const closeModal = () => {
    setActiveModal(null)
    clearQrCheck()
    // Reset forms
    setPwdAccount('')
    setPwdPassword('')
    setManualAccountId('')
    setManualCookie('')
    setEditingAccount(null)
  }

  const clearQrCheck = () => {
    if (qrCheckIntervalRef.current) {
      clearInterval(qrCheckIntervalRef.current)
      qrCheckIntervalRef.current = null
    }
  }

  // QR Code Login
  const startQrCheck = (sessionId: string) => {
    clearQrCheck()
    qrCheckIntervalRef.current = setInterval(async () => {
      try {
        const result = await checkQRLoginStatus(sessionId)
        if (!result.success) return

        switch (result.status) {
          case 'scanned':
          case 'processing':
            setQrStatus('scanned')
            break
          case 'success':
          case 'already_processed':
            setQrStatus('success')
            clearQrCheck()
            addToast({
              type: 'success',
              message: result.account_info?.is_new_account
                ? `新账号 ${result.account_info.account_id} 添加成功`
                : result.account_info?.account_id
                  ? `账号 ${result.account_info.account_id} 登录成功`
                  : '账号登录成功',
            })
            setTimeout(() => {
              closeModal()
              loadAccounts()
            }, 1500)
            break
          case 'expired':
            setQrStatus('expired')
            clearQrCheck()
            break
          case 'cancelled':
            clearQrCheck()
            addToast({ type: 'warning', message: '用户取消登录' })
            closeModal()
            break
          case 'verification_required':
            addToast({ type: 'warning', message: '需要手机验证，请在手机上完成' })
            break
        }
      } catch {
        // ignore
      }
    }, 2000)
  }

  const handleGenerateQRCode = async () => {
    setActiveModal('qrcode')
    setQrStatus('loading')
    clearQrCheck()
    try {
      const result = await generateQRLogin()
      if (result.success && result.qr_code_url && result.session_id) {
        setQrCodeUrl(result.qr_code_url)
        setQrSessionId(result.session_id)
        setQrStatus('ready')
        startQrCheck(result.session_id)
      } else {
        setQrStatus('error')
      }
    } catch {
      setQrStatus('error')
    }
  }

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!pwdAccount.trim() || !pwdPassword.trim()) {
      addToast({ type: 'warning', message: '请输入账号和密码' })
      return
    }

    setPwdLoading(true)
    try {
      const result = await passwordLogin({
        account_id: pwdAccount.trim(),
        account: pwdAccount.trim(),
        password: pwdPassword,
        show_browser: pwdShowBrowser,
      })
      if (result.success) {
        addToast({ type: 'success', message: '登录请求已提交，请等待处理' })
        closeModal()
        setTimeout(loadAccounts, 3000)
      } else {
        addToast({ type: 'error', message: result.message || '登录失败' })
      }
    } catch {
      addToast({ type: 'error', message: '登录请求失败' })
    } finally {
      setPwdLoading(false)
    }
  }

  const _handleManualAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!manualAccountId.trim() || !manualCookie.trim()) {
      addToast({ type: 'warning', message: '请输入账号ID和Cookie' })
      return
    }

    try {
      const result = await addAccount({
        id: manualAccountId.trim(),
        cookie: manualCookie.trim(),
      })
      if (result.success) {
        addToast({ type: 'success', message: '账号添加成功' })
        closeModal()
        loadAccounts()
      } else {
        addToast({ type: 'error', message: result.message || '添加失败' })
      }
    } catch {
      addToast({ type: 'error', message: '添加账号失败' })
    }
  }

  const handleToggleStatus = async (account: AccountDetail) => {
    const newStatus = !account.enabled
    try {
      const result = await updateAccountStatus(account.id, newStatus)
      if (result.success) {
        addToast({ type: 'success', message: newStatus ? '账号已启用' : '账号已禁用' })
        loadAccounts()
      } else {
        addToast({ type: 'error', message: result.message || '状态更新失败' })
      }
    } catch {
      addToast({ type: 'error', message: '状态更新失败' })
    }
  }

  const handleDelete = async (account: AccountDetail) => {
    if (!confirm(`确定要删除账号 ${account.id} 吗？`)) return
    try {
      const result = await deleteAccount(account.id)
      if (result.success) {
        addToast({ type: 'success', message: '删除成功' })
        loadAccounts()
      } else {
        addToast({ type: 'error', message: result.message || '删除失败' })
      }
    } catch {
      addToast({ type: 'error', message: '删除账号失败' })
    }
  }

  const handleEdit = (account: AccountDetail) => {
    setEditingAccount(account)
    setEditNote(account.note || '')
    setEditCookie(account.cookie || '')
    setEditAutoConfirm(account.auto_confirm ?? false)
    setEditPauseDuration(account.pause_duration || 0)
    setEditUsername(account.username || '')
    setEditLoginPassword(account.login_password || '')
    setEditShowBrowser(account.show_browser ?? false)
    setActiveModal('edit')
  }

  const handleSaveEdit = async () => {
    if (!editingAccount) return

    setEditSaving(true)
    try {
      // Update various fields
      await Promise.all([
        editNote !== editingAccount.note && updateAccountRemark(editingAccount.id, editNote),
        editCookie !== editingAccount.cookie && updateAccountCookie(editingAccount.id, editCookie),
        editAutoConfirm !== editingAccount.auto_confirm && updateAccountAutoConfirm(editingAccount.id, editAutoConfirm),
        editPauseDuration !== editingAccount.pause_duration && updateAccountPauseDuration(editingAccount.id, editPauseDuration),
        (editUsername !== editingAccount.username || editLoginPassword !== editingAccount.login_password || editShowBrowser !== editingAccount.show_browser) &&
          updateAccountLoginInfo(editingAccount.id, {
            username: editUsername,
            login_password: editLoginPassword,
            show_browser: editShowBrowser,
          }),
      ].filter(Boolean))

      addToast({ type: 'success', message: '更新成功' })
      closeModal()
      loadAccounts()
    } catch {
      addToast({ type: 'error', message: '更新失败' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenAISettings = async (account: AccountWithKeywordCount) => {
    setAiSettingsAccount(account)
    setActiveModal('ai-settings')
    setAiSettingsLoading(true)

    try {
      const result = await getAIReplySettings(account.id)
      if (result.ai_enabled !== undefined) {
        setAiEnabled(result.ai_enabled ?? result.enabled ?? false)
        setAiMaxDiscountPercent(result.max_discount_percent ?? 10)
        setAiMaxDiscountAmount(result.max_discount_amount ?? 100)
        setAiMaxBargainRounds(result.max_bargain_rounds ?? 3)
        setAiCustomPrompts(result.custom_prompts || '')
      }
    } catch {
      addToast({ type: 'error', message: '获取AI设置失败' })
    } finally {
      setAiSettingsLoading(false)
    }
  }

  const handleSaveAISettings = async () => {
    if (!aiSettingsAccount) return

    setAiSettingsSaving(true)
    try {
      const result = await updateAIReplySettings(aiSettingsAccount.id, {
        ai_enabled: aiEnabled,
        max_discount_percent: aiMaxDiscountPercent,
        max_discount_amount: aiMaxDiscountAmount,
        max_bargain_rounds: aiMaxBargainRounds,
        custom_prompts: aiCustomPrompts,
      })

      if (result.success) {
        addToast({ type: 'success', message: 'AI设置已更新' })
        closeModal()
        loadAccounts()
      } else {
        addToast({ type: 'error', message: result.message || '更新失败' })
      }
    } catch {
      addToast({ type: 'error', message: '更新AI设置失败' })
    } finally {
      setAiSettingsSaving(false)
    }
  }

  if (loading) {
    return <PageLoading />
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">账号管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {accounts.length} 个账号，{accounts.filter((a) => a.enabled !== false).length} 个已启用
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadAccounts} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4" />
            刷新
          </Button>
          <Button onClick={handleGenerateQRCode} variant="primary" size="sm">
            <Plus className="w-4 h-4" />
            添加账号
          </Button>
        </div>
      </div>

      {/* Password Warning */}
      {showPasswordWarning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-warning-900">安全警告</h3>
            <p className="text-sm text-warning-700 mt-1">
              您正在使用默认密码，这可能存在安全风险。请前往设置页面修改密码。
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowPasswordWarning(false)}>
            <X className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account, index) => (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <Card hover className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{account.note || account.id}</CardTitle>
                    <CardDescription className="font-mono text-xs truncate">
                      {account.id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {account.aiEnabled && (
                      <div className="p-1 rounded-md bg-primary-50">
                        <Bot className="w-4 h-4 text-primary-600" />
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(account)}
                      className="p-1"
                    >
                      {account.enabled !== false ? (
                        <Power className="w-4 h-4 text-success-600" />
                      ) : (
                        <PowerOff className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{account.keywordCount || 0} 关键词</span>
                    </div>
                    <Badge variant={account.enabled !== false ? 'success' : 'secondary'} className="text-xs">
                      {account.enabled !== false ? '已启用' : '已禁用'}
                    </Badge>
                  </div>

                  {/* Config Status */}
                  <div className="flex flex-wrap gap-2">
                    {account.auto_confirm && (
                      <Badge variant="info" className="text-xs">
                        <CheckCircle className="w-3 h-3" />
                        自动确认
                      </Badge>
                    )}
                    {account.pause_duration && account.pause_duration > 0 && (
                      <Badge variant="warning" className="text-xs">
                        <Clock className="w-3 h-3" />
                        暂停{account.pause_duration}分钟
                      </Badge>
                    )}
                  </div>

                  {/* Update Time */}
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {account.updated_at ? new Date(account.updated_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '未更新'}
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <div className="flex items-center gap-1 w-full">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEdit(account)}
                    className="flex-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenAISettings(account)}
                    className="flex-1"
                  >
                    <Bot className="w-3 h-3" />
                    AI
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(account)}
                  >
                    <Trash2 className="w-3 h-3 text-danger-600" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        ))}

        {/* Add Account Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: accounts.length * 0.05, duration: 0.3 }}
        >
          <Card hover className="h-full border-dashed border-2 cursor-pointer" onClick={handleGenerateQRCode}>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-primary-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">添加新账号</p>
              <p className="text-xs text-gray-500 mt-1">扫码或密码登录</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden"
            >
              {/* QR Code Modal */}
              {activeModal === 'qrcode' && (
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">扫码登录</h2>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setActiveModal('password')}>
                          <Key className="w-3 h-3" />
                          密码
                        </Button>
                        <Button size="sm" variant="ghost" onClick={closeModal}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-col items-center">
                      {qrStatus === 'loading' && (
                        <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                        </div>
                      )}
                      {qrStatus === 'ready' && qrCodeUrl && (
                        <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 rounded-lg" />
                      )}
                      {qrStatus === 'scanned' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center bg-success-50 rounded-lg">
                          <CheckCircle className="w-16 h-16 text-success-600 mb-3" />
                          <p className="text-sm font-medium text-success-900">已扫描</p>
                          <p className="text-xs text-success-700 mt-1">请在手机上确认</p>
                        </div>
                      )}
                      {qrStatus === 'success' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center bg-success-50 rounded-lg">
                          <CheckCircle className="w-16 h-16 text-success-600 mb-3" />
                          <p className="text-sm font-medium text-success-900">登录成功</p>
                        </div>
                      )}
                      {qrStatus === 'expired' && (
                        <div className="w-64 h-64 flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                          <AlertTriangle className="w-16 h-16 text-warning-600 mb-3" />
                          <p className="text-sm font-medium text-gray-900">二维码已过期</p>
                          <Button size="sm" variant="primary" onClick={handleGenerateQRCode} className="mt-3">
                            刷新二维码
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-center text-gray-500 mt-4">
                      使用闲鱼APP扫描二维码登录
                    </p>
                  </div>
                </>
              )}

              {/* Password Login Modal */}
              {activeModal === 'password' && (
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">密码登录</h2>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={handleGenerateQRCode}>
                          <QrCode className="w-3 h-3" />
                          扫码
                        </Button>
                        <Button size="sm" variant="ghost" onClick={closeModal}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handlePasswordLogin} className="p-6 space-y-4">
                    <Input
                      label="账号"
                      value={pwdAccount}
                      onChange={(e) => setPwdAccount(e.target.value)}
                      placeholder="手机号或邮箱"
                    />
                    <Input
                      label="密码"
                      type="password"
                      value={pwdPassword}
                      onChange={(e) => setPwdPassword(e.target.value)}
                      placeholder="登录密码"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={pwdShowBrowser}
                        onChange={(e) => setPwdShowBrowser(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700">显示浏览器（调试用）</span>
                    </label>
                    <Button type="submit" variant="primary" className="w-full" loading={pwdLoading}>
                      登录
                    </Button>
                  </form>
                </>
              )}

              {/* Edit Account Modal */}
              {activeModal === 'edit' && editingAccount && (
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">编辑账号</h2>
                      <Button size="sm" variant="ghost" onClick={closeModal}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <Input
                      label="备注名称"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="账号备注"
                    />
                    <Textarea
                      label="Cookie"
                      value={editCookie}
                      onChange={(e) => setEditCookie(e.target.value)}
                      placeholder="Cookie字符串"
                      rows={3}
                    />
                    <Input
                      label="登录用户名"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="用于自动登录的用户名"
                    />
                    <div className="relative">
                      <Input
                        label="登录密码"
                        type={showLoginPassword ? 'text' : 'password'}
                        value={editLoginPassword}
                        onChange={(e) => setEditLoginPassword(e.target.value)}
                        placeholder="用于自动登录的密码"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editAutoConfirm}
                        onChange={(e) => setEditAutoConfirm(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700">自动确认收货</span>
                    </label>
                    <Input
                      label="暂停处理时长（分钟）"
                      type="number"
                      value={editPauseDuration}
                      onChange={(e) => setEditPauseDuration(Number(e.target.value))}
                      placeholder="0 表示不暂停"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editShowBrowser}
                        onChange={(e) => setEditShowBrowser(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-700">显示浏览器（调试）</span>
                    </label>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-2">
                    <Button variant="secondary" onClick={closeModal} className="flex-1">
                      取消
                    </Button>
                    <Button variant="primary" onClick={handleSaveEdit} loading={editSaving} className="flex-1">
                      保存
                    </Button>
                  </div>
                </>
              )}

              {/* AI Settings Modal */}
              {activeModal === 'ai-settings' && aiSettingsAccount && (
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-gray-900">AI议价设置</h2>
                      </div>
                      <Button size="sm" variant="ghost" onClick={closeModal}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {aiSettingsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                      </div>
                    ) : (
                      <>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={aiEnabled}
                            onChange={(e) => setAiEnabled(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-700">启用AI自动议价</span>
                        </label>
                        <Input
                          label="最大折扣比例（%）"
                          type="number"
                          value={aiMaxDiscountPercent}
                          onChange={(e) => setAiMaxDiscountPercent(Number(e.target.value))}
                          disabled={!aiEnabled}
                        />
                        <Input
                          label="最大折扣金额（元）"
                          type="number"
                          value={aiMaxDiscountAmount}
                          onChange={(e) => setAiMaxDiscountAmount(Number(e.target.value))}
                          disabled={!aiEnabled}
                        />
                        <Input
                          label="最大议价轮次"
                          type="number"
                          value={aiMaxBargainRounds}
                          onChange={(e) => setAiMaxBargainRounds(Number(e.target.value))}
                          disabled={!aiEnabled}
                        />
                        <Textarea
                          label="自定义提示词"
                          value={aiCustomPrompts}
                          onChange={(e) => setAiCustomPrompts(e.target.value)}
                          placeholder="可选的自定义AI行为指令"
                          rows={4}
                          disabled={!aiEnabled}
                        />
                      </>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-2">
                    <Button variant="secondary" onClick={closeModal} className="flex-1">
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSaveAISettings}
                      loading={aiSettingsSaving}
                      className="flex-1"
                    >
                      保存
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
