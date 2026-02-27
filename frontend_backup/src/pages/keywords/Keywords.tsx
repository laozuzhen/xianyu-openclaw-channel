import { useState, useEffect, useRef } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, RefreshCw, Plus, Edit2, Trash2, Upload, Download, Info, Image } from 'lucide-react'
import { getKeywords, deleteKeyword, addKeyword, updateKeyword, exportKeywords, importKeywords as importKeywordsApi, addImageKeyword } from '@/api/keywords'
import { getAccounts } from '@/api/accounts'
import { getItems } from '@/api/items'
import { useUIStore } from '@/store/uiStore'
import { PageLoading } from '@/components/common/Loading'
import { useAuthStore } from '@/store/authStore'
import { Select } from '@/components/common/Select'
import type { Keyword, Account, Item } from '@/types'

export function Keywords() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null)
  const [keywordText, setKeywordText] = useState('')
  const [replyText, setReplyText] = useState('')
  const [itemIdText, setItemIdText] = useState('')  // 绑定的商品ID
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  
  // 图片关键词相关状态
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [imageKeyword, setImageKeyword] = useState('')
  const [imageItemId, setImageItemId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [savingImage, setSavingImage] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  
  // 图片预览弹窗状态
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')

  const loadKeywords = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) {
      return
    }
    if (!selectedAccount) {
      setKeywords([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await getKeywords(selectedAccount)
      // 确保 data 是数组，防止后端返回非数组或请求失败时出错
      setKeywords(Array.isArray(data) ? data : [])
    } catch {
      setKeywords([])
      addToast({ type: 'error', message: '加载关键词列表失败' })
    } finally {
      setLoading(false)
    }
  }

  const loadAccounts = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) {
      return
    }
    try {
      setLoading(true)
      const data = await getAccounts()
      setAccounts(data)
      if (data.length > 0) {
        if (!selectedAccount) {
          setSelectedAccount(data[0].id)
        }
      } else {
        setSelectedAccount('')
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadAccounts()
  }, [_hasHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    if (selectedAccount) {
      loadKeywords()
      loadItems()
    }
  }, [_hasHydrated, isAuthenticated, token, selectedAccount])

  const loadItems = async () => {
    if (!selectedAccount) {
      setItems([])
      return
    }
    try {
      const result = await getItems(selectedAccount)
      setItems(result.data || [])
    } catch {
      setItems([])
    }
  }

  const openAddModal = () => {
    if (!selectedAccount) {
      addToast({ type: 'warning', message: '请先选择账号' })
      return
    }
    setEditingKeyword(null)
    setKeywordText('')
    setReplyText('')
    setItemIdText('')
    setIsModalOpen(true)
  }

  const openEditModal = (keyword: Keyword) => {
    // 图片关键词不支持编辑
    if (keyword.type === 'image') {
      addToast({ type: 'warning', message: '图片关键词不支持编辑，请删除后重新添加' })
      return
    }
    
    setEditingKeyword(keyword)
    setKeywordText(keyword.keyword)
    setReplyText(keyword.reply)
    setItemIdText(keyword.item_id || '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!selectedAccount) {
      addToast({ type: 'warning', message: '请先选择账号' })
      return
    }

    if (!keywordText.trim()) {
      addToast({ type: 'warning', message: '请输入关键词' })
      return
    }

    if (!replyText.trim()) {
      addToast({ type: 'warning', message: '请输入回复内容' })
      return
    }

    try {
      setSaving(true)

      if (editingKeyword) {
        const result = await updateKeyword(
          selectedAccount, 
          editingKeyword.keyword,
          editingKeyword.item_id || '',
          {
            keyword: keywordText.trim(),
            reply: replyText.trim(),
            item_id: itemIdText.trim(),
          }
        )
        if (result.success === false) {
          addToast({ type: 'error', message: result.message || '更新失败' })
          return
        }
        addToast({ type: 'success', message: '关键词已更新' })
      } else {
        const result = await addKeyword(selectedAccount, {
          keyword: keywordText.trim(),
          reply: replyText.trim(),
          item_id: itemIdText.trim(),
        })
        if (result.success === false) {
          addToast({ type: 'error', message: result.message || '添加失败' })
          return
        }
        addToast({ type: 'success', message: '关键词已添加' })
      }

      await loadKeywords()
      setIsModalOpen(false)
    } catch {
      addToast({ type: 'error', message: '保存关键词失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (!selectedAccount) {
      addToast({ type: 'warning', message: '请先选择账号' })
      return
    }

    try {
      setExporting(true)
      const blob = await exportKeywords(selectedAccount)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `keywords_${selectedAccount}_${date}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      addToast({ type: 'success', message: '关键词导出成功' })
    } catch {
      addToast({ type: 'error', message: '关键词导出失败' })
    } finally {
      setExporting(false)
    }
  }

  const handleImportButtonClick = () => {
    if (!selectedAccount) {
      addToast({ type: 'warning', message: '请先选择账号' })
      return
    }
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)
      const result = await importKeywordsApi(selectedAccount, file)
      // 后端返回 { msg, total, added, updated } 格式
      const resultData = result as unknown as { msg?: string; added?: number; updated?: number; success?: boolean; message?: string }
      if (resultData.msg || resultData.added !== undefined) {
        addToast({
          type: 'success',
          message: `导入成功：新增 ${resultData.added ?? 0} 条，更新 ${resultData.updated ?? 0} 条`,
        })
        await loadKeywords()
      } else if (resultData.success === false) {
        addToast({ type: 'error', message: resultData.message || '导入失败' })
      } else {
        addToast({ type: 'error', message: '导入失败' })
      }
    } catch {
      addToast({ type: 'error', message: '导入关键词失败' })
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const handleDelete = async (keyword: Keyword) => {
    if (!confirm('确定要删除这个关键词吗？')) return
    try {
      await deleteKeyword(selectedAccount, keyword.keyword, keyword.item_id || '')
      addToast({ type: 'success', message: '删除成功' })
      loadKeywords()
    } catch {
      addToast({ type: 'error', message: '删除失败' })
    }
  }

  // 图片关键词功能
  const openImageModal = () => {
    if (!selectedAccount) {
      addToast({ type: 'warning', message: '请先选择账号' })
      return
    }
    setImageKeyword('')
    setImageItemId('')
    setImageFile(null)
    setImagePreview('')
    setIsImageModalOpen(true)
  }

  const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', message: '请选择图片文件' })
      return
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast({ type: 'error', message: '图片大小不能超过5MB' })
      return
    }

    setImageFile(file)
    // 生成预览
    const reader = new FileReader()
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!imageKeyword.trim()) {
      addToast({ type: 'warning', message: '请输入关键词' })
      return
    }
    if (!imageFile) {
      addToast({ type: 'warning', message: '请选择图片' })
      return
    }

    setSavingImage(true)
    try {
      const result = await addImageKeyword(
        selectedAccount,
        imageKeyword.trim(),
        imageFile,
        imageItemId.trim() || undefined
      )
      // 后端返回 { msg, keyword, image_url, item_id }
      if (result && (result as unknown as { keyword?: string }).keyword) {
        addToast({ type: 'success', message: '图片关键词添加成功' })
        setIsImageModalOpen(false)
        loadKeywords()
      } else {
        addToast({ type: 'error', message: '添加失败' })
      }
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } }
      addToast({ type: 'error', message: error.response?.data?.detail || '添加图片关键词失败' })
    } finally {
      setSavingImage(false)
    }
  }

  if (loading && accounts.length === 0) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">自动回复</h1>
          <p className="page-description">管理关键词自动回复规则</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openAddModal}
            className="btn-ios-primary"
          >
            <Plus className="w-4 h-4" />
            添加文本关键词
          </button>
          <button
            type="button"
            onClick={openImageModal}
            className="btn-ios-primary"
          >
            <Image className="w-4 h-4" />
            添加图片关键词
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!selectedAccount || exporting}
            className="btn-ios-secondary"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            type="button"
            onClick={handleImportButtonClick}
            disabled={!selectedAccount || importing}
            className="btn-ios-secondary "
          >
            <Upload className="w-4 h-4" />
            导入
          </button>
          <button onClick={loadKeywords} className="btn-ios-secondary ">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </div>
      </div>

      {/* Account Select */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="vben-card"
      >
        <div className="vben-card-body">
          <div className="max-w-md">
            <label className="input-label">选择账号</label>
            <Select
              value={selectedAccount}
              onChange={setSelectedAccount}
              options={
                accounts.length === 0
                  ? [{ value: '', label: '暂无账号' }]
                  : accounts.map((account) => ({
                      value: account.id,
                      label: account.id,
                    }))
              }
              placeholder="选择账号"
            />
          </div>
        </div>
      </motion.div>

      {/* 变量提示说明 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="vben-card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
      >
        <div className="vben-card-body py-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">支持变量替换</p>
              <div className="text-amber-600 dark:text-amber-400 space-y-0.5">
                <p><code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{send_user_name}'}</code> - 用户昵称</p>
                <p><code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{send_user_id}'}</code> - 用户ID</p>
                <p><code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{'{send_message}'}</code> - 用户消息内容</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Keywords List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="vben-card"
      >
        <div className="vben-card-header">
          <h2 className="vben-card-title flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            关键词列表
          </h2>
          <span className="badge-primary">{keywords.length} 个关键词</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios">
            <thead>
              <tr>
                <th>关键词</th>
                <th>商品ID</th>
                <th>回复内容</th>
                <th>类型</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {!selectedAccount ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    请先选择一个账号
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : keywords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquare className="w-12 h-12 text-gray-300" />
                      <p>暂无关键词，点击上方按钮添加</p>
                    </div>
                  </td>
                </tr>
              ) : (
                keywords.map((keyword, index) => (
                  <tr key={keyword.id || `keyword-${index}`}>
                    <td className="font-medium">
                      <code className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded">
                        {keyword.keyword}
                      </code>
                    </td>
                    <td>
                      {keyword.item_id ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{keyword.item_id}</span>
                      ) : (
                        <span className="text-xs text-gray-400">通用</span>
                      )}
                    </td>
                    <td className="max-w-[300px]">
                      {keyword.type === 'image' ? (
                        <button
                          onClick={() => {
                            setPreviewImageUrl(keyword.image_url || '')
                            setIsImagePreviewOpen(true)
                          }}
                          className="text-amber-600 dark:text-amber-400 hover:underline text-sm"
                        >
                          查看大图
                        </button>
                      ) : (
                        <p className="truncate text-slate-600 dark:text-slate-300" title={keyword.reply}>
                          {keyword.reply || <span className="text-gray-400">不回复</span>}
                        </p>
                      )}
                    </td>
                    <td>
                      {keyword.type === 'image' ? (
                        <span className="badge-primary">图片</span>
                      ) : (
                        <span className="badge-gray">文本</span>
                      )}
                    </td>
                    <td>
                      <div className="">
                        <button
                          onClick={() => openEditModal(keyword)}
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(keyword)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingKeyword ? '编辑关键词' : '添加关键词'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body space-y-4 overflow-y-auto">
                <div>
                  <label className="input-label">所属账号</label>
                  <input
                    type="text"
                    value={selectedAccount}
                    disabled
                    className="input-ios bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="input-label">关键词</label>
                  <input
                    type="text"
                    value={keywordText}
                    onChange={(e) => setKeywordText(e.target.value)}
                    className="input-ios"
                    placeholder="请输入关键词"
                  />
                </div>
                <div>
                  <label className="input-label">商品ID（可选）</label>
                  <select
                    value={itemIdText}
                    onChange={(e) => setItemIdText(e.target.value)}
                    className="input-ios"
                  >
                    <option value="">通用关键词（所有商品）</option>
                    {items.map((item) => (
                      <option key={item.item_id} value={item.item_id}>
                        {item.item_id} - {item.title || item.item_title || '未命名商品'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    绑定商品ID后，此关键词仅在该商品对话中生效
                  </p>
                </div>
                <div>
                  <label className="input-label">回复内容</label>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="input-ios h-28 resize-none"
                    placeholder="请输入自动回复内容，留空表示不回复"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    回复内容留空时，匹配到关键词但不会自动回复，可用于屏蔽特定消息
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ios-secondary"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-ios-primary"
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 图片关键词弹窗 */}
      {isImageModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Image className="w-5 h-5 text-amber-500" />
                添加图片关键词
              </h2>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleImageSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body space-y-4 overflow-y-auto">
                {/* 关键词输入 */}
                <div>
                  <label className="input-label">关键词 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={imageKeyword}
                    onChange={(e) => setImageKeyword(e.target.value)}
                    className="input-ios"
                    placeholder="例如：图片、照片"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">用户发送此关键词时将回复上传的图片</p>
                </div>

                {/* 图片上传区域 */}
                <div>
                  <label className="input-label">上传图片 <span className="text-red-500">*</span></label>
                  <div
                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center hover:border-amber-400 dark:hover:border-amber-500 transition-colors cursor-pointer"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <div className="flex flex-col items-center">
                        <img src={imagePreview} alt="预览" className="max-h-32 rounded-lg mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">{imageFile?.name}</p>
                        <p className="text-xs text-amber-500 mt-1">点击更换图片</p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Image className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">点击选择图片</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">支持 JPG、PNG、GIF，不超过 5MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />
                </div>

                {/* 关联商品 */}
                <div>
                  <label className="input-label">关联商品（可选）</label>
                  <select
                    value={imageItemId}
                    onChange={(e) => setImageItemId(e.target.value)}
                    className="input-ios"
                  >
                    <option value="">通用关键词（所有商品）</option>
                    {items.map((item) => (
                      <option key={item.item_id} value={item.item_id}>
                        {item.item_id} - {item.title || item.item_title || '未命名商品'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">填写商品ID后，此关键词仅在该商品对话中生效</p>
                </div>

                {/* 说明提示 */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      <p className="font-medium mb-1">说明：</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>图片关键词优先级高于文本关键词</li>
                        <li>用户发送匹配的关键词时，系统将回复上传的图片</li>
                        <li>图片将被转换为适合聊天的格式</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="btn-ios-secondary"
                  disabled={savingImage}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-ios-primary"
                  disabled={savingImage}
                >
                  {savingImage ? '添加中...' : '添加图片关键词'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 图片预览弹窗 */}
      {isImagePreviewOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setIsImagePreviewOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsImagePreviewOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-sm"
            >
              关闭 ✕
            </button>
            <img
              src={previewImageUrl}
              alt="关键词图片"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}
