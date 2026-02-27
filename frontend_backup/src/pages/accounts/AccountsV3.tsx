import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, RefreshCw, QrCode, Key, Edit2, Trash2, Power, PowerOff, X, Loader2,
  Clock, CheckCircle, MessageSquare, Bot, Eye, EyeOff, AlertTriangle, Search,
  Zap, Settings, Shield, Activity, ChevronDown, ChevronUp, Users, Sun, Moon
} from 'lucide-react'
import {
  getAccountDetails, deleteAccount, updateAccountCookie, updateAccountStatus,
  updateAccountRemark, generateQRLogin, checkQRLoginStatus, passwordLogin,
  updateAccountAutoConfirm, updateAccountPauseDuration, getAllAIReplySettings,
  getAIReplySettings, updateAIReplySettings, updateAccountLoginInfo,
  type AIReplySettings
} from '@/api/accounts'
import { getKeywords } from '@/api/keywords'
import { checkDefaultPassword } from '@/api/settings'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import type { AccountDetail } from '@/types'

type ModalType = 'qrcode' | 'password' | 'manual' | 'edit' | 'ai-settings' | 'default-reply' | null
type ViewMode = 'grid' | 'list'

interface AccountWithKeywordCount extends AccountDetail {
  keywordCount?: number
  aiEnabled?: boolean
}

export function AccountsV3() {
  const { addToast, darkMode, toggleDarkMode } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<AccountWithKeywordCount[]>([])
  const [filteredAccounts, setFilteredAccounts] = useState<AccountWithKeywordCount[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ModalType>(null)

  // Modal states
  const [showPasswordWarning, setShowPasswordWarning] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [, setQrSessionId] = useState('')
  const [qrStatus, setQrStatus] = useState<'loading' | 'ready' | 'scanned' | 'success' | 'expired' | 'error'>('loading')
  const qrCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [pwdAccount, setPwdAccount] = useState('')
  const [pwdPassword, setPwdPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdShowBrowser, setPwdShowBrowser] = useState(false)

  const [manualAccountId, setManualAccountId] = useState('')
  const [manualCookie, setManualCookie] = useState('')

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

  const [aiSettingsAccount, setAiSettingsAccount] = useState<AccountWithKeywordCount | null>(null)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiMaxDiscountPercent, setAiMaxDiscountPercent] = useState(10)
  const [aiMaxDiscountAmount, setAiMaxDiscountAmount] = useState(100)
  const [aiMaxBargainRounds, setAiMaxBargainRounds] = useState(3)
  const [aiCustomPrompts, setAiCustomPrompts] = useState('')

  // 默认回复状态
  const [defaultReplyAccount, setDefaultReplyAccount] = useState<AccountWithKeywordCount | null>(null)
  const [defaultReplyContent, setDefaultReplyContent] = useState('')
  const [defaultReplyImageUrl, setDefaultReplyImageUrl] = useState('')
  const [defaultReplySaving, setDefaultReplySaving] = useState(false)
  const [uploadingDefaultReplyImage, setUploadingDefaultReplyImage] = useState(false)
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false)
  const [aiSettingsLoading, setAiSettingsLoading] = useState(false)

  const loadAccounts = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const data = await getAccountDetails()
      let aiSettings: Record<string, AIReplySettings> = {}
      try {
        aiSettings = await getAllAIReplySettings()
      } catch {}

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
      setFilteredAccounts(accountsWithKeywords)

      try {
        const pwdCheck = await checkDefaultPassword()
        setShowPasswordWarning(pwdCheck.using_default ?? false)
      } catch {}
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

  useEffect(() => {
    const filtered = accounts.filter(
      (account) =>
        account.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.note?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setFilteredAccounts(filtered)
  }, [searchQuery, accounts])

  const closeModal = () => {
    setActiveModal(null)
    clearQrCheck()
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
        }
      } catch {}
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

  // ==================== 默认回复管理 ====================
  const handleOpenDefaultReply = async (account: AccountWithKeywordCount) => {
    setDefaultReplyAccount(account)
    setActiveModal('default-reply')
    // 加载当前默认回复（如果后端有数据就使用）
    try {
      const response = await fetch(`/api/default-reply/${account.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        // 后端直接返回数据对象，不需要检查 success 和 data 包装
        setDefaultReplyContent(data.reply_content || '')
        setDefaultReplyImageUrl(data.reply_image_url || '')
      } else {
        // 请求失败，使用空值
        setDefaultReplyContent('')
        setDefaultReplyImageUrl('')
      }
    } catch {
      // 忽略错误，使用空值
      setDefaultReplyContent('')
      setDefaultReplyImageUrl('')
    }
  }

  const handleSaveDefaultReply = async () => {
    if (!defaultReplyAccount) return
    setDefaultReplySaving(true)
    try {
      const response = await fetch(`/api/default-reply/${defaultReplyAccount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          enabled: true,
          reply_content: defaultReplyContent,
          reply_image_url: defaultReplyImageUrl,
          reply_once: false
        })
      })
      const data = await response.json()
      if (response.ok) {
        addToast({ type: 'success', message: '默认回复已保存' })
        closeModal()
      } else {
        addToast({ type: 'error', message: data.detail || data.message || '保存失败' })
      }
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setDefaultReplySaving(false)
    }
  }

  const handleUploadDefaultReplyImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      addToast({ type: 'error', message: '请选择图片文件' })
      return
    }

    // 验证文件大小（2MB限制）
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', message: '图片大小不能超过2MB' })
      return
    }

    setUploadingDefaultReplyImage(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch('/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      const data = await response.json()
      if (data.image_url) {
        setDefaultReplyImageUrl(data.image_url)
        addToast({ type: 'success', message: '图片上传成功' })
      } else {
        addToast({ type: 'error', message: data.message || '上传失败' })
      }
    } catch {
      addToast({ type: 'error', message: '上传失败' })
    } finally {
      setUploadingDefaultReplyImage(false)
    }
  }

  if (loading) {
    return <PageLoading />
  }

  const stats = {
    total: accounts.length,
    active: accounts.filter(a => a.enabled !== false).length,
    withAI: accounts.filter(a => a.aiEnabled).length,
    withKeywords: accounts.filter(a => (a.keywordCount || 0) > 0).length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50 dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 transition-colors duration-200">
      {/* Top Bar */}
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">账号管理</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                管理您的所有闲鱼账号 · {stats.total} 个账号 · {stats.active} 个运行中
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
                onClick={loadAccounts}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
              <button
                onClick={handleGenerateQRCode}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                添加账号
              </button>
            </div>
          </div>

          {/* Search and View Toggle */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="搜索账号ID或备注..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 border-0 rounded-xl text-sm placeholder:text-slate-500 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'grid' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                网格
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                列表
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Warning */}
      {showPasswordWarning && (
        <div className="mx-6 lg:mx-8 mt-6">
          <div className="bg-gradient-to-r from-orange-50 dark:from-orange-900/30 to-red-50 dark:to-red-900/30 border-l-4 border-orange-500 rounded-lg p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-400">安全提示</h3>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                您正在使用默认密码，建议立即修改以保护账号安全
              </p>
            </div>
            <button onClick={() => setShowPasswordWarning(false)} className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: '总账号', value: stats.total, icon: Users, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
            { label: '运行中', value: stats.active, icon: Zap, color: 'from-green-500 to-emerald-500', bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
            { label: 'AI助手', value: stats.withAI, icon: Bot, color: 'from-purple-500 to-pink-500', bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
            { label: '已配置', value: stats.withKeywords, icon: MessageSquare, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
          ].map((stat, index) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="relative group bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all overflow-hidden border border-slate-200 dark:border-slate-700"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 rounded-full -mr-12 -mt-12 group-hover:opacity-10 transition-opacity`}></div>
                <div className="relative">
                  <div className={`inline-flex p-3 ${stat.bg} rounded-xl mb-3`}>
                    <Icon className={`w-6 h-6 ${stat.text}`} />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Accounts Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAccounts.map((account, index) => {
              const isExpanded = expandedCard === account.id
              const isEnabled = account.enabled !== false

              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                          isEnabled ? 'from-purple-500 to-blue-600' : 'from-slate-400 to-slate-500'
                        } flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                          {(account.note || account.id).substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                            {account.note || account.id}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                            {account.id}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleStatus(account)}
                        className={`p-2 rounded-lg transition-colors ${
                          isEnabled
                            ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {isEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Status Tags */}
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                        isEnabled ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-green-500 dark:bg-green-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'}`}></span>
                        {isEnabled ? '运行中' : '已禁用'}
                      </span>

                      {account.aiEnabled && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-medium">
                          <Bot className="w-3.5 h-3.5" />
                          AI助手
                        </span>
                      )}

                      {account.auto_confirm && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          自动确认
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">关键词配置</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {account.keywordCount || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">最后更新</span>
                      <span className="text-slate-900 dark:text-white font-medium">
                        {account.updated_at
                          ? new Date(account.updated_at).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                            })
                          : '-'}
                      </span>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2"
                        >
                          {account.pause_duration && account.pause_duration > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600 dark:text-slate-400">暂停处理</span>
                              <span className="text-orange-600 dark:text-orange-400 font-medium">{account.pause_duration}分钟</span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={() => setExpandedCard(isExpanded ? null : account.id)}
                      className="w-full flex items-center justify-center gap-1 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isExpanded ? '收起' : '展开详情'}
                    </button>
                  </div>

                  {/* Card Actions */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(account)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      编辑
                    </button>
                    <button
                      onClick={() => handleOpenDefaultReply(account)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                      title="默认回复"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      默认回复
                    </button>
                    <button
                      onClick={() => handleOpenAISettings(account)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      AI设置
                    </button>
                    <button
                      onClick={() => handleDelete(account)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )
            })}

            {/* Add Account Card */}
            <motion.button
              onClick={handleGenerateQRCode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: filteredAccounts.length * 0.05 }}
              className="group bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-blue-50 dark:to-blue-900/20 hover:from-purple-100 dark:hover:from-purple-900/30 hover:to-blue-100 dark:hover:to-blue-900/30 rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-600 p-12 flex flex-col items-center justify-center gap-4 transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-700 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">添加新账号</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">扫码或密码登录</p>
              </div>
            </motion.button>
          </div>
        ) : (
          /* List View - Simplified for now */
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">账号</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">状态</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">关键词</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">AI</th>
                  <th className="text-right py-4 px-6 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredAccounts.map((account) => {
                  const isEnabled = account.enabled !== false
                  return (
                    <tr key={account.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                            isEnabled ? 'from-purple-500 to-blue-600' : 'from-slate-400 to-slate-500'
                          } flex items-center justify-center text-white font-bold text-sm`}>
                            {(account.note || account.id).substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{account.note || account.id}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{account.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          isEnabled ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-green-500 dark:bg-green-400' : 'bg-slate-400 dark:bg-slate-500'}`}></span>
                          {isEnabled ? '运行中' : '已禁用'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {account.keywordCount || 0}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {account.aiEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-medium">
                            <Bot className="w-3.5 h-3.5" />
                            已启用
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(account)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(account)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            {isEnabled ? (
                              <Power className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <PowerOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(account)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {activeModal === 'qrcode' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">扫码登录</h3>
                <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="flex flex-col items-center">
                  {qrStatus === 'loading' && (
                    <div className="w-64 h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <Loader2 className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-spin" />
                    </div>
                  )}
                  {qrStatus === 'ready' && qrCodeUrl && (
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-slate-700 p-4 rounded-2xl shadow-lg border-2 border-purple-200 dark:border-purple-700">
                        <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">请使用闲鱼App扫码登录</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">打开闲鱼 → 我的 → 扫一扫</p>
                      </div>
                    </div>
                  )}
                  {qrStatus === 'scanned' && (
                    <div className="w-64 h-64 flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/30 rounded-2xl space-y-3">
                      <CheckCircle className="w-16 h-16 text-blue-600 dark:text-blue-400" />
                      <p className="text-blue-900 dark:text-blue-400 font-medium">扫码成功，处理中...</p>
                    </div>
                  )}
                  {qrStatus === 'success' && (
                    <div className="w-64 h-64 flex flex-col items-center justify-center bg-green-50 dark:bg-green-900/30 rounded-2xl space-y-3">
                      <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
                      <p className="text-green-900 dark:text-green-400 font-medium">登录成功！</p>
                    </div>
                  )}
                  {qrStatus === 'expired' && (
                    <div className="w-64 h-64 flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/30 rounded-2xl space-y-3">
                      <Clock className="w-16 h-16 text-orange-600 dark:text-orange-400" />
                      <p className="text-orange-900 dark:text-orange-400 font-medium">二维码已过期</p>
                      <button
                        onClick={handleGenerateQRCode}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        重新生成
                      </button>
                    </div>
                  )}
                  {qrStatus === 'error' && (
                    <div className="w-64 h-64 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/30 rounded-2xl space-y-3">
                      <AlertTriangle className="w-16 h-16 text-red-600 dark:text-red-400" />
                      <p className="text-red-900 dark:text-red-400 font-medium">生成失败</p>
                      <button
                        onClick={handleGenerateQRCode}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        重试
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      closeModal()
                      setActiveModal('password')
                    }}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1"
                  >
                    <Key className="w-4 h-4" />
                    使用密码登录
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Login Modal */}
      <AnimatePresence>
        {activeModal === 'password' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">密码登录</h3>
                <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePasswordLogin} className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">账号</label>
                  <input
                    type="text"
                    value={pwdAccount}
                    onChange={(e) => setPwdAccount(e.target.value)}
                    placeholder="请输入闲鱼账号（手机号）"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                    disabled={pwdLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">密码</label>
                  <input
                    type="password"
                    value={pwdPassword}
                    onChange={(e) => setPwdPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                    disabled={pwdLoading}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pwd-show-browser"
                    checked={pwdShowBrowser}
                    onChange={(e) => setPwdShowBrowser(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-500 bg-white dark:bg-slate-700"
                  />
                  <label htmlFor="pwd-show-browser" className="text-sm text-slate-700 dark:text-slate-300">
                    显示浏览器窗口（调试用）
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {pwdLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      '登录'
                    )}
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeModal()
                      handleGenerateQRCode()
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                  >
                    <QrCode className="w-4 h-4" />
                    使用扫码登录
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Account Modal */}
      <AnimatePresence>
        {activeModal === 'edit' && editingAccount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
            >
              <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Edit2 className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-semibold text-white">编辑账号</h3>
                </div>
                <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Account ID (Read-only) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">账号ID</label>
                  <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-400 font-mono">
                    {editingAccount.id}
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">备注</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="为账号添加备注"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                  />
                </div>

                {/* Cookie */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cookie</label>
                  <textarea
                    value={editCookie}
                    onChange={(e) => setEditCookie(e.target.value)}
                    placeholder="更新账号Cookie"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all resize-none"
                  />
                </div>

                {/* Login Info */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    登录信息
                  </h4>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">用户名</label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="闲鱼账号/手机号"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">登录密码</label>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={editLoginPassword}
                        onChange={(e) => setEditLoginPassword(e.target.value)}
                        placeholder="用于自动登录"
                        className="w-full px-4 py-2.5 pr-12 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-show-browser"
                      checked={editShowBrowser}
                      onChange={(e) => setEditShowBrowser(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-slate-300 dark:border-slate-600 rounded focus:ring-purple-500 dark:focus:ring-purple-500 bg-white dark:bg-slate-700"
                    />
                    <label htmlFor="edit-show-browser" className="text-sm text-slate-700 dark:text-slate-300">
                      登录时显示浏览器
                    </label>
                  </div>
                </div>

                {/* Settings */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    账号设置
                  </h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">自动确认收货</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">自动点击确认收货按钮</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAutoConfirm}
                      onChange={(e) => setEditAutoConfirm(e.target.checked)}
                      className="w-11 h-6 bg-slate-300 dark:bg-slate-600 rounded-full relative cursor-pointer transition-colors checked:bg-blue-600 appearance-none
                        after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-transform after:shadow-md checked:after:translate-x-5"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">暂停处理时长（分钟）</label>
                    <input
                      type="number"
                      value={editPauseDuration}
                      onChange={(e) => setEditPauseDuration(Number(e.target.value))}
                      min="0"
                      placeholder="0表示不暂停"
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">设置后会暂停处理该账号的订单，到时间后自动恢复</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Settings Modal */}
      <AnimatePresence>
        {activeModal === 'ai-settings' && aiSettingsAccount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
            >
              <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-white" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">AI助手设置</h3>
                    <p className="text-sm text-purple-100">{aiSettingsAccount.note || aiSettingsAccount.id}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {aiSettingsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Enable AI */}
                    <div className="bg-gradient-to-r from-purple-50 dark:from-purple-900/30 to-pink-50 dark:to-pink-900/30 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                          <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">启用AI自动回复</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">AI将自动处理买家的砍价消息</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                        className="w-12 h-7 bg-slate-300 dark:bg-slate-600 rounded-full relative cursor-pointer transition-colors checked:bg-gradient-to-r checked:from-purple-600 checked:to-pink-600 appearance-none
                          after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-6 after:h-6 after:bg-white after:rounded-full after:transition-transform after:shadow-md checked:after:translate-x-5"
                      />
                    </div>

                    {/* AI Parameters */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        砍价策略
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            最大折扣比例 (%)
                          </label>
                          <input
                            type="number"
                            value={aiMaxDiscountPercent}
                            onChange={(e) => setAiMaxDiscountPercent(Number(e.target.value))}
                            min="0"
                            max="100"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">例如：10表示最多降价10%</p>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            最大折扣金额 (元)
                          </label>
                          <input
                            type="number"
                            value={aiMaxDiscountAmount}
                            onChange={(e) => setAiMaxDiscountAmount(Number(e.target.value))}
                            min="0"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">例如：100表示最多降价100元</p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            最大砍价轮次
                          </label>
                          <input
                            type="number"
                            value={aiMaxBargainRounds}
                            onChange={(e) => setAiMaxBargainRounds(Number(e.target.value))}
                            min="1"
                            max="10"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">买家最多可以砍价的次数</p>
                        </div>
                      </div>
                    </div>

                    {/* Custom Prompts */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        自定义提示词（可选）
                      </label>
                      <textarea
                        value={aiCustomPrompts}
                        onChange={(e) => setAiCustomPrompts(e.target.value)}
                        placeholder="输入自定义的AI回复规则或风格指引..."
                        rows={4}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 transition-all resize-none"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        例如：回复时保持礼貌专业、使用简洁的语言、强调产品质量等
                      </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg p-4 flex items-start gap-3">
                      <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900 dark:text-blue-400">
                        <p className="font-medium mb-1">AI如何工作</p>
                        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                          <li>自动识别买家的砍价请求</li>
                          <li>根据设定的策略智能回复</li>
                          <li>在合理范围内同意降价或礼貌拒绝</li>
                          <li>保持专业友好的沟通风格</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveAISettings}
                  disabled={aiSettingsSaving || aiSettingsLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {aiSettingsSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存设置'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Default Reply Modal */}
        <AnimatePresence>
          {activeModal === 'default-reply' && defaultReplyAccount && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closeModal}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">默认回复设置</h3>
                      <p className="text-sm text-green-100">{defaultReplyAccount.note || defaultReplyAccount.id}</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Reply Content */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      默认回复内容
                    </label>
                    <textarea
                      value={defaultReplyContent}
                      onChange={(e) => setDefaultReplyContent(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white dark:focus:bg-slate-600 transition-all resize-none"
                      rows={4}
                      placeholder="输入默认回复内容，留空表示不使用默认回复"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      当没有匹配到任何关键词时，将使用此默认回复
                    </p>
                  </div>

                  {/* Reply Image */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      回复图片（可选）
                    </label>
                    <div className="space-y-3">
                      {defaultReplyImageUrl ? (
                        <div className="relative group">
                          <img
                            src={defaultReplyImageUrl}
                            alt="默认回复图片"
                            className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-600"
                          />
                          <button
                            onClick={() => {
                              setDefaultReplyImageUrl('')
                              addToast({ type: 'success', message: '已移除图片' })
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-slate-700/90 hover:bg-white dark:hover:bg-slate-700 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:border-green-400 dark:hover:border-green-600 transition-colors">
                          <label className="block">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleUploadDefaultReplyImage}
                              disabled={uploadingDefaultReplyImage}
                              className="hidden"
                              id={`default-reply-image-${defaultReplyAccount.id}`}
                            />
                            <label
                              htmlFor={`default-reply-image-${defaultReplyAccount.id}`}
                              className="cursor-pointer"
                            >
                              <div className="mx-auto flex flex-col items-center gap-2">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                  <Plus className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <span className="text-sm text-green-600 dark:text-green-400 font-medium">上传图片</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">支持 jpg, png, gif, webp</span>
                              </div>
                              {uploadingDefaultReplyImage && (
                                <div className="mt-2">
                                  <Loader2 className="w-6 h-6 text-green-600 dark:text-green-400 animate-spin mx-auto" />
                                  <span className="text-xs text-slate-500 dark:text-slate-400">上传中...</span>
                                </div>
                              )}
                            </label>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-700/50">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveDefaultReply}
                      disabled={defaultReplySaving}
                      className="px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {defaultReplySaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        '保存'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  )
}
