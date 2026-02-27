import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, RefreshCw, QrCode, Key, Edit2, Trash2, Power, PowerOff, X, Loader2, Clock, CheckCircle, MessageSquare, Bot, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { getAccountDetails, deleteAccount, updateAccountCookie, updateAccountStatus, updateAccountRemark, addAccount, generateQRLogin, checkQRLoginStatus, passwordLogin, updateAccountAutoConfirm, updateAccountPauseDuration, getAllAIReplySettings, getAIReplySettings, updateAIReplySettings, updateAccountLoginInfo, type AIReplySettings } from '@/api/accounts'
import { getKeywords, getDefaultReply, updateDefaultReply } from '@/api/keywords'
import { checkDefaultPassword } from '@/api/settings'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import type { AccountDetail } from '@/types'

type ModalType = 'qrcode' | 'password' | 'manual' | 'edit' | 'default-reply' | 'ai-settings' | null

interface AccountWithKeywordCount extends AccountDetail {
  keywordCount?: number
  aiEnabled?: boolean
}

export function Accounts() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated, user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<AccountWithKeywordCount[]>([])
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  
  // 默认密码检查状态
  const [usingDefaultPassword, setUsingDefaultPassword] = useState(false)
  const [showPasswordWarning, setShowPasswordWarning] = useState(false)

  // 默认回复管理状态
  const [defaultReplyAccount, setDefaultReplyAccount] = useState<AccountWithKeywordCount | null>(null)
  const [defaultReplyContent, setDefaultReplyContent] = useState('')
  const [defaultReplyImageUrl, setDefaultReplyImageUrl] = useState('')
  const [defaultReplySaving, setDefaultReplySaving] = useState(false)
  const [uploadingDefaultReplyImage, setUploadingDefaultReplyImage] = useState(false)

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
  const [manualLoading, setManualLoading] = useState(false)

  // 编辑账号状态
  const [editingAccount, setEditingAccount] = useState<AccountDetail | null>(null)
  const [editNote, setEditNote] = useState('')
  const [editCookie, setEditCookie] = useState('')
  const [editAutoConfirm, setEditAutoConfirm] = useState(false)
  const [editPauseDuration, setEditPauseDuration] = useState(0)
  const [editSaving, setEditSaving] = useState(false)
  // 登录信息
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
            return {
              ...account,
              keywordCount: 0,
              aiEnabled: aiSettings[account.id]?.ai_enabled ?? aiSettings[account.id]?.enabled ?? false,
            }
          }
        }),
      )

      setAccounts(accountsWithKeywords)
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

  // 单独的 useEffect 检查默认密码
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token || !user) return
    
    // 检查是否使用默认密码
    const checkPassword = async () => {
      if (user.is_admin) {
        const result = await checkDefaultPassword()
        setUsingDefaultPassword(result.using_default)
      }
    }
    checkPassword()
  }, [_hasHydrated, isAuthenticated, token, user])

  // 清理扫码检查定时器
  const clearQrCheck = useCallback(() => {
    if (qrCheckIntervalRef.current) {
      clearInterval(qrCheckIntervalRef.current)
      qrCheckIntervalRef.current = null
    }
  }, [])

  // 关闭弹窗时清理
  const closeModal = useCallback(() => {
    clearQrCheck()
    setActiveModal(null)
    setQrCodeUrl('')
    setQrSessionId('')
    setQrStatus('loading')
    setPwdAccount('')
    setPwdPassword('')
    setPwdLoading(false)
    setManualAccountId('')
    setManualCookie('')
    setManualLoading(false)
  }, [clearQrCheck])

  // ==================== 扫码登录 ====================
  const startQRCodeLogin = async () => {
    // 检查是否使用默认密码
    if (usingDefaultPassword) {
      setShowPasswordWarning(true)
      return
    }
    
    setActiveModal('qrcode')
    setQrStatus('loading')
    try {
      const result = await generateQRLogin()
      if (result.success && result.qr_code_url && result.session_id) {
        setQrCodeUrl(result.qr_code_url)
        setQrSessionId(result.session_id)
        setQrStatus('ready')
        // 开始轮询
        startQrCheck(result.session_id)
      } else {
        setQrStatus('error')
        addToast({ type: 'error', message: result.message || '生成二维码失败' })
      }
    } catch {
      setQrStatus('error')
      addToast({ type: 'error', message: '生成二维码失败' })
    }
  }
  
  // 检查默认密码后打开弹窗
  const handleOpenModal = (modal: ModalType) => {
    if (usingDefaultPassword && (modal === 'password' || modal === 'manual')) {
      setShowPasswordWarning(true)
      return
    }
    setActiveModal(modal)
  }

  const startQrCheck = (sessionId: string) => {
    clearQrCheck()
    qrCheckIntervalRef.current = setInterval(async () => {
      try {
        const result = await checkQRLoginStatus(sessionId)
        if (!result.success) return

        switch (result.status) {
          case 'scanned':
            setQrStatus('scanned')
            break
          case 'processing':
            // 正在处理中，显示已扫描状态
            setQrStatus('scanned')
            break
          case 'success':
          case 'already_processed':
            // 登录成功或已处理完成
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
        // 忽略网络错误，继续轮询
      }
    }, 2000)
  }

  const refreshQRCode = async () => {
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

  // ==================== 密码登录 ====================
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
        // 延迟刷新列表
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

  // ==================== 手动输入 ====================
  const handleManualAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!manualAccountId.trim()) {
      addToast({ type: 'warning', message: '请输入账号ID' })
      return
    }
    if (!manualCookie.trim()) {
      addToast({ type: 'warning', message: '请输入Cookie' })
      return
    }

    setManualLoading(true)
    try {
      const result = await addAccount({
        id: manualAccountId.trim(),
        cookie: manualCookie.trim(),
      })
      // 后端返回 {msg: 'success'} 或 {success: true}
      if (result.success || result.msg === 'success') {
        addToast({ type: 'success', message: '账号添加成功' })
        closeModal()
        loadAccounts()
      } else {
        addToast({ type: 'error', message: result.message || result.detail || '添加失败' })
      }
    } catch {
      addToast({ type: 'error', message: '添加账号失败' })
    } finally {
      setManualLoading(false)
    }
  }

  const handleToggleEnabled = async (account: AccountDetail) => {
    try {
      await updateAccountStatus(account.id, !account.enabled)
      addToast({ type: 'success', message: account.enabled ? '账号已禁用' : '账号已启用' })
      loadAccounts()
    } catch {
      addToast({ type: 'error', message: '操作失败' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个账号吗？')) return
    try {
      await deleteAccount(id)
      addToast({ type: 'success', message: '删除成功' })
      loadAccounts()
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  // ==================== 编辑账号 ====================
  const openEditModal = (account: AccountDetail) => {
    setEditingAccount(account)
    setEditNote(account.note || '')
    setEditCookie(account.cookie || '')
    setEditAutoConfirm(account.auto_confirm || false)
    setEditPauseDuration(account.pause_duration || 0)
    setEditUsername(account.username || '')
    setEditLoginPassword(account.login_password || '')
    setEditShowBrowser(account.show_browser || false)
    setShowLoginPassword(false)
    setActiveModal('edit')
  }

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingAccount) return

    setEditSaving(true)
    try {
      // 分别调用不同的 API 更新不同字段
      const promises: Promise<unknown>[] = []

      // 更新备注
      if (editNote.trim() !== (editingAccount.note || '')) {
        promises.push(updateAccountRemark(editingAccount.id, editNote.trim()))
      }

      // 更新 Cookie 值
      if (editCookie.trim() && editCookie.trim() !== editingAccount.cookie) {
        promises.push(updateAccountCookie(editingAccount.id, editCookie.trim()))
      }

      // 更新自动确认发货
      if (editAutoConfirm !== (editingAccount.auto_confirm || false)) {
        promises.push(updateAccountAutoConfirm(editingAccount.id, editAutoConfirm))
      }

      // 更新暂停时间
      if (editPauseDuration !== (editingAccount.pause_duration || 0)) {
        promises.push(updateAccountPauseDuration(editingAccount.id, editPauseDuration))
      }

      // 更新登录信息
      const loginInfoChanged = 
        editUsername !== (editingAccount.username || '') ||
        editLoginPassword !== (editingAccount.login_password || '') ||
        editShowBrowser !== (editingAccount.show_browser || false)
      
      if (loginInfoChanged) {
        promises.push(updateAccountLoginInfo(editingAccount.id, {
          username: editUsername,
          login_password: editLoginPassword,
          show_browser: editShowBrowser,
        }))
      }

      await Promise.all(promises)
      addToast({ type: 'success', message: '账号信息已更新' })
      closeModal()
      loadAccounts()
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setEditSaving(false)
    }
  }

  // ==================== 默认回复管理 ====================
  const openDefaultReplyModal = async (account: AccountWithKeywordCount) => {
    setDefaultReplyAccount(account)
    setDefaultReplyContent('')
    setDefaultReplyImageUrl('')
    setActiveModal('default-reply')
    
    // 加载当前默认回复
    try {
      const result = await getDefaultReply(account.id)
      setDefaultReplyContent(result.reply_content || '')
      setDefaultReplyImageUrl(result.reply_image_url || '')
    } catch {
      // ignore
    }
  }

  const handleSaveDefaultReply = async () => {
    if (!defaultReplyAccount) return
    
    try {
      setDefaultReplySaving(true)
      await updateDefaultReply(defaultReplyAccount.id, defaultReplyContent, true, false, defaultReplyImageUrl)
      addToast({ type: 'success', message: '默认回复已保存' })
      closeModal()
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setDefaultReplySaving(false)
    }
  }

  // 上传默认回复图片
  const handleUploadDefaultReplyImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setUploadingDefaultReplyImage(true)
      const formData = new FormData()
      formData.append('image', file)
      
      const response = await fetch('/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      })
      
      const result = await response.json()
      if (result.image_url) {
        setDefaultReplyImageUrl(result.image_url)
        addToast({ type: 'success', message: '图片上传成功' })
      } else {
        addToast({ type: 'error', message: result.detail || '图片上传失败' })
      }
    } catch {
      addToast({ type: 'error', message: '图片上传失败' })
    } finally {
      setUploadingDefaultReplyImage(false)
      e.target.value = ''
    }
  }

  // ==================== AI回复开关 ====================
  const handleToggleAI = async (account: AccountWithKeywordCount) => {
    const newEnabled = !account.aiEnabled
    try {
      // 先获取当前设置，避免覆盖其他字段（如custom_prompts）
      const currentSettings = await getAIReplySettings(account.id)
      await updateAIReplySettings(account.id, {
        ...currentSettings,
        enabled: newEnabled,
      })
      setAccounts(prev => prev.map(a =>
        a.id === account.id ? { ...a, aiEnabled: newEnabled } : a,
      ))
      addToast({ type: 'success', message: `AI回复已${newEnabled ? '开启' : '关闭'}` })
    } catch {
      addToast({ type: 'error', message: '操作失败' })
    }
  }

  // ==================== AI设置管理 ====================
  const openAISettings = async (account: AccountWithKeywordCount) => {
    setAiSettingsAccount(account)
    setActiveModal('ai-settings')
    setAiSettingsLoading(true)
    try {
      const settings = await getAIReplySettings(account.id)
      setAiEnabled(settings.ai_enabled ?? settings.enabled ?? false)
      setAiMaxDiscountPercent(settings.max_discount_percent ?? 10)
      setAiMaxDiscountAmount(settings.max_discount_amount ?? 100)
      setAiMaxBargainRounds(settings.max_bargain_rounds ?? 3)
      setAiCustomPrompts(settings.custom_prompts ?? '')
    } catch {
      addToast({ type: 'error', message: '加载AI设置失败' })
    } finally {
      setAiSettingsLoading(false)
    }
  }

  const handleSaveAISettings = async () => {
    if (!aiSettingsAccount) return
    try {
      setAiSettingsSaving(true)
      await updateAIReplySettings(aiSettingsAccount.id, {
        enabled: aiEnabled,
        max_discount_percent: aiMaxDiscountPercent,
        max_discount_amount: aiMaxDiscountAmount,
        max_bargain_rounds: aiMaxBargainRounds,
        custom_prompts: aiCustomPrompts,
      })
      // 更新本地状态
      setAccounts(prev => prev.map(a =>
        a.id === aiSettingsAccount.id ? { ...a, aiEnabled } : a,
      ))
      addToast({ type: 'success', message: 'AI设置已保存' })
      closeModal()
    } catch {
      addToast({ type: 'error', message: '保存失败' })
    } finally {
      setAiSettingsSaving(false)
    }
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => clearQrCheck()
  }, [clearQrCheck])

  if (loading) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">账号管理</h1>
          <p className="page-description">管理闲鱼账号Cookie信息</p>
        </div>
        <button onClick={loadAccounts} className="btn-ios-secondary">
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* Add Account Card */}
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title ">
            <Plus className="w-4 h-4" />
            添加新账号
          </h2>
        </div>
        <div className="vben-card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 扫码登录 */}
            <button
              onClick={startQRCodeLogin}
              className="flex items-center gap-3 p-4 rounded-md border border-amber-200 dark:border-amber-800
                         bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center flex-shrink-0">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">扫码登录</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">推荐方式</p>
              </div>
            </button>

            {/* 账号密码登录 */}
            <button
              onClick={() => handleOpenModal('password')}
              className="flex items-center gap-3 p-4 rounded-md border border-slate-200 dark:border-slate-700
                         hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Key className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">账号密码</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">使用账号和密码</p>
              </div>
            </button>

            {/* 手动输入 */}
            <button
              onClick={() => handleOpenModal('manual')}
              className="flex items-center gap-3 p-4 rounded-md border border-slate-200 dark:border-slate-700
                         hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">手动输入</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">手动输入Cookie</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="vben-card">
        <div className="vben-card-header">
          <h2 className="vben-card-title">账号列表</h2>
          <span className="badge-primary">{accounts.length} 个账号</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios">
            <thead>
              <tr>
                <th>账号ID</th>
                <th>关键词</th>
                <th>状态</th>
                <th>AI回复</th>
                <th>自动确认</th>
                <th>暂停时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state py-8">
                      <p className="text-slate-500 dark:text-slate-400">暂无账号，请添加新账号</p>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="font-medium text-amber-600 dark:text-amber-400">{account.id}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-medium">{account.keywordCount || 0}</span>
                        <span className="text-slate-400">个</span>
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 ${account.enabled !== false ? 'text-green-600' : 'text-gray-400'}`}>
                        <span className={`status-dot ${account.enabled !== false ? 'status-dot-success' : 'status-dot-danger'}`} />
                        {account.enabled !== false ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleAI(account)}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          account.aiEnabled 
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50' 
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                        title={account.aiEnabled ? '点击关闭AI回复' : '点击开启AI回复'}
                      >
                        <Bot className="w-3.5 h-3.5" />
                        {account.aiEnabled ? '已开启' : '已关闭'}
                      </button>
                    </td>
                    <td>
                      <span className={account.auto_confirm ? 'badge-success' : 'badge-gray'}>
                        {account.auto_confirm ? '开启' : '关闭'}
                      </span>
                    </td>
                    <td>
                      <span className="text-slate-600 dark:text-slate-300 text-sm">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        {account.pause_duration || 0} 分钟
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => openAISettings(account)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                          title="AI设置"
                        >
                          <Bot className="w-3.5 h-3.5 text-purple-500" />
                          <span className="text-purple-600 dark:text-purple-400">AI设置</span>
                        </button>
                        <button
                          onClick={() => openDefaultReplyModal(account)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                          title="默认回复"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">默认回复</span>
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(account)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title={account.enabled !== false ? '禁用' : '启用'}
                        >
                          {account.enabled !== false ? (
                            <><PowerOff className="w-3.5 h-3.5 text-amber-500" /><span className="text-amber-600 dark:text-amber-400">禁用</span></>
                          ) : (
                            <><Power className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400">启用</span></>
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(account)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="编辑"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-amber-600 dark:text-amber-400">编辑</span>
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-red-600 dark:text-red-400">删除</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 扫码登录弹窗 */}
      {activeModal === 'qrcode' && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <div className="modal-header">
              <h2 className="modal-title">扫码登录</h2>
              <button onClick={closeModal} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body flex flex-col items-center py-6">
              {qrStatus === 'loading' && (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-spin" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">正在生成二维码...</p>
                </div>
              )}
              {qrStatus === 'ready' && (
                <div className="flex flex-col items-center gap-3">
                  <img src={qrCodeUrl} alt="登录二维码" className="w-44 h-44 rounded-lg border" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">请使用闲鱼APP扫描二维码</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">二维码有效期约5分钟</p>
                </div>
              )}
              {qrStatus === 'scanned' && (
                <div className="flex flex-col items-center gap-3">
                  <img src={qrCodeUrl} alt="登录二维码" className="w-44 h-44 rounded-lg border opacity-50" />
                  <div className=" text-amber-600 dark:text-amber-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>已扫描，等待确认...</span>
                  </div>
                </div>
              )}
              {qrStatus === 'success' && (
                <div className="flex flex-col items-center gap-3 text-green-600">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <Power className="w-7 h-7" />
                  </div>
                  <p className="font-medium">登录成功！</p>
                </div>
              )}
              {qrStatus === 'expired' && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400">二维码已过期</p>
                  <button onClick={refreshQRCode} className="btn-ios-primary btn-sm">
                    刷新二维码
                  </button>
                </div>
              )}
              {qrStatus === 'error' && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-red-500">生成二维码失败</p>
                  <button onClick={refreshQRCode} className="btn-ios-primary btn-sm">
                    重试
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 密码登录弹窗 */}
      {activeModal === 'password' && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <div className="modal-header">
              <h2 className="modal-title">账号密码登录</h2>
              <button onClick={closeModal} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePasswordLogin}>
              <div className="modal-body space-y-4">
                <div className="input-group">
                  <label className="input-label">账号</label>
                  <input
                    type="text"
                    value={pwdAccount}
                    onChange={(e) => setPwdAccount(e.target.value)}
                    className="input-ios"
                    placeholder="请输入闲鱼账号/手机号"
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">密码</label>
                  <input
                    type="password"
                    value={pwdPassword}
                    onChange={(e) => setPwdPassword(e.target.value)}
                    className="input-ios"
                    placeholder="请输入密码"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={pwdShowBrowser}
                    onChange={(e) => setPwdShowBrowser(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-amber-600"
                  />
                  显示浏览器（调试用）
                </label>
                <p className="input-hint">
                  登录过程可能需要进行人脸验证，请确保手机畅通
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn-ios-secondary" disabled={pwdLoading}>
                  取消
                </button>
                <button type="submit" className="btn-ios-primary" disabled={pwdLoading}>
                  {pwdLoading ? (
                    <span className="">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      登录中...
                    </span>
                  ) : (
                    '登录'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 手动输入弹窗 */}
      {activeModal === 'manual' && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <h2 className="modal-title">手动输入Cookie</h2>
              <button onClick={closeModal} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleManualAdd}>
              <div className="modal-body space-y-4">
                <div className="input-group">
                  <label className="input-label">账号ID</label>
                  <input
                    type="text"
                    value={manualAccountId}
                    onChange={(e) => setManualAccountId(e.target.value)}
                    className="input-ios"
                    placeholder="请输入账号ID（如手机号或用户名）"
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Cookie</label>
                  <textarea
                    value={manualCookie}
                    onChange={(e) => setManualCookie(e.target.value)}
                    className="input-ios h-28 resize-none font-mono text-xs"
                    placeholder="请粘贴完整的Cookie值"
                  />
                  <p className="input-hint">
                    可从浏览器开发者工具中获取Cookie
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn-ios-secondary" disabled={manualLoading}>
                  取消
                </button>
                <button type="submit" className="btn-ios-primary" disabled={manualLoading}>
                  {manualLoading ? (
                    <span className="">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      添加中...
                    </span>
                  ) : (
                    '添加账号'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑账号弹窗 */}
      {activeModal === 'edit' && editingAccount && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <h2 className="modal-title">编辑账号</h2>
              <button onClick={closeModal} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body space-y-4">
                <div className="input-group">
                  <label className="input-label">账号ID</label>
                  <input
                    type="text"
                    value={editingAccount.id}
                    disabled
                    className="input-ios bg-slate-100 dark:bg-slate-700"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">备注</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="input-ios"
                    placeholder="添加备注信息"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Cookie</label>
                  <textarea
                    value={editCookie}
                    onChange={(e) => setEditCookie(e.target.value)}
                    className="input-ios h-20 resize-none font-mono text-xs"
                    placeholder="更新Cookie值"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    当前Cookie长度: {editCookie.length} 字符
                  </p>
                </div>

                {/* 自动确认发货 */}
                <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      自动确认发货
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">开启后系统会自动确认发货</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditAutoConfirm(!editAutoConfirm)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editAutoConfirm ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editAutoConfirm ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* 暂停时间 */}
                <div className="input-group">
                  <label className="input-label flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    暂停时间（分钟）
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={editPauseDuration}
                    onChange={(e) => setEditPauseDuration(parseInt(e.target.value) || 0)}
                    className="input-ios"
                    placeholder="0"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    检测到手动发出消息后，自动回复暂停的时间。设置为0表示不暂停。
                  </p>
                </div>

                {/* 登录信息管理 */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-500" />
                    登录信息（用于自动登录）
                  </h3>
                  <div className="space-y-3">
                    <div className="input-group">
                      <label className="input-label text-xs">登录账号</label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="input-ios"
                        placeholder="手机号或用户名"
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label text-xs">登录密码</label>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          value={editLoginPassword}
                          onChange={(e) => setEditLoginPassword(e.target.value)}
                          className="input-ios pr-10"
                          placeholder="登录密码"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">显示浏览器</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">调试时可开启查看登录过程</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditShowBrowser(!editShowBrowser)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          editShowBrowser ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            editShowBrowser ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    保存登录信息后，Cookie过期时系统可自动重新登录
                  </p>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                  提示：AI回复和默认回复设置请在"自动回复"页面配置
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn-ios-secondary" disabled={editSaving}>
                  取消
                </button>
                <button type="submit" className="btn-ios-primary" disabled={editSaving}>
                  {editSaving ? (
                    <span className="">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </span>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 默认回复管理弹窗 */}
      {activeModal === 'default-reply' && defaultReplyAccount && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h2 className="modal-title">默认回复管理</h2>
              <button onClick={closeModal} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="input-group">
                <label className="input-label">账号</label>
                <input
                  type="text"
                  value={defaultReplyAccount.id}
                  disabled
                  className="input-ios bg-slate-100 dark:bg-slate-700"
                />
              </div>
              <div className="input-group">
                <label className="input-label">默认回复内容</label>
                <textarea
                  value={defaultReplyContent}
                  onChange={(e) => setDefaultReplyContent(e.target.value)}
                  className="input-ios h-32 resize-none"
                  placeholder="输入默认回复内容，留空表示不使用默认回复"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  当没有匹配到任何关键词时，将使用此默认回复。留空表示不自动回复。
                </p>
              </div>
              <div className="input-group">
                <label className="input-label">回复图片（可选）</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={defaultReplyImageUrl}
                    onChange={(e) => setDefaultReplyImageUrl(e.target.value)}
                    className="input-ios flex-1"
                    placeholder="图片URL或上传图片"
                  />
                  <label className="btn-ios-secondary cursor-pointer">
                    {uploadingDefaultReplyImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '上传'
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadDefaultReplyImage}
                      disabled={uploadingDefaultReplyImage}
                    />
                  </label>
                </div>
                {defaultReplyImageUrl && (
                  <div className="mt-2 relative inline-block">
                    <img
                      src={defaultReplyImageUrl}
                      alt="回复图片预览"
                      className="max-w-32 max-h-32 rounded border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setDefaultReplyImageUrl('')}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  <strong>支持变量：</strong><br />
                  <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{send_user_name}'}</code> - 用户昵称<br />
                  <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{send_user_id}'}</code> - 用户ID<br />
                  <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{send_message}'}</code> - 用户消息内容
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={closeModal} className="btn-ios-secondary" disabled={defaultReplySaving}>
                取消
              </button>
              <button onClick={handleSaveDefaultReply} className="btn-ios-primary" disabled={defaultReplySaving}>
                {defaultReplySaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </span>
                ) : (
                  '保存'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI设置弹窗 */}
      {activeModal === 'ai-settings' && aiSettingsAccount && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header">
              <h2 className="modal-title">AI回复设置</h2>
              <button onClick={closeModal} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {aiSettingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label className="input-label">账号</label>
                    <input
                      type="text"
                      value={aiSettingsAccount.id}
                      disabled
                      className="input-ios bg-slate-100 dark:bg-slate-700"
                    />
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">议价设置</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="input-group">
                        <label className="input-label text-xs">最大折扣(%)</label>
                        <input
                          type="number"
                          value={aiMaxDiscountPercent}
                          onChange={(e) => setAiMaxDiscountPercent(Number(e.target.value))}
                          className="input-ios"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label text-xs">最大减价(元)</label>
                        <input
                          type="number"
                          value={aiMaxDiscountAmount}
                          onChange={(e) => setAiMaxDiscountAmount(Number(e.target.value))}
                          className="input-ios"
                          min="0"
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label text-xs">最大议价轮数</label>
                        <input
                          type="number"
                          value={aiMaxBargainRounds}
                          onChange={(e) => setAiMaxBargainRounds(Number(e.target.value))}
                          className="input-ios"
                          min="1"
                          max="10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">自定义提示词 (JSON格式)</label>
                    <textarea
                      value={aiCustomPrompts}
                      onChange={(e) => setAiCustomPrompts(e.target.value)}
                      className="input-ios h-32 resize-none font-mono text-xs"
                      placeholder='{"classify": "分类提示词", "price": "议价提示词", "tech": "技术提示词", "default": "默认提示词"}'
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      留空使用系统默认提示词。格式：{`{"classify": "...", "price": "...", "tech": "...", "default": "..."}`}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={closeModal} className="btn-ios-secondary" disabled={aiSettingsSaving}>
                取消
              </button>
              <button
                onClick={handleSaveAISettings}
                className="btn-ios-primary"
                disabled={aiSettingsSaving || aiSettingsLoading}
              >
                {aiSettingsSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </span>
                ) : (
                  '保存'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 默认密码警告弹窗 */}
      {showPasswordWarning && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <h2 className="modal-title flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                安全提醒
              </h2>
              <button onClick={() => setShowPasswordWarning(false)} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                <p className="text-amber-800 dark:text-amber-200 text-sm">
                  检测到您正在使用默认密码 <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">admin123</code>，
                  为了账号安全，请先修改密码后再添加闲鱼账号。
                </p>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                请前往 <strong>系统设置</strong> 页面修改您的登录密码。
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPasswordWarning(false)} className="btn-ios-secondary">
                稍后修改
              </button>
              <button
                onClick={() => {
                  setShowPasswordWarning(false)
                  window.location.href = '/settings'
                }}
                className="btn-ios-primary"
              >
                立即修改密码
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
