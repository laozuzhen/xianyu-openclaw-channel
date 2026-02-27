import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AccountDetail, ShippingRule, ReplyRule, DefaultReply } from '../types';
import { getAccountDetails, getReplyRules, updateReplyRule, deleteReplyRule, getShippingRules, updateShippingRule, deleteShippingRule, getCards, getDefaultReplies, getDefaultReply, updateDefaultReply, deleteDefaultReply, clearDefaultReplyRecords } from '../services/api';
import { Plus, Trash2, MessageSquare, X, Save, Loader2, Key, Truck, Power, PowerOff, Edit2, RefreshCw, Sparkles, Bot } from 'lucide-react';

type TabType = 'reply' | 'delivery' | 'default';

interface Keyword {
  id: string;
  keyword: string;
  reply_content: string;
  match_type: 'exact' | 'fuzzy';
  enabled: boolean;
}

interface DeliveryRuleForm {
  keyword: string;
  card_id: string;
  description: string;
  enabled: boolean;
}

interface DefaultReplyForm {
  cookie_id: string;
  enabled: boolean;
  reply_content: string;
  reply_once: boolean;
  reply_image_url: string;
}

const Keywords: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('reply');

  // 关键词回复相关状态
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [replyForm, setReplyForm] = useState({
    keyword: '',
    reply_content: ''
  });

  // 关键词发货相关状态
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [editingDeliveryRule, setEditingDeliveryRule] = useState<ShippingRule | null>(null);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryRuleForm>({
    keyword: '',
    card_id: '',
    description: '',
    enabled: true
  });

  // 账号默认回复相关状态
  const [defaultReplies, setDefaultReplies] = useState<Record<string, DefaultReply>>({});
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [editingDefaultReply, setEditingDefaultReply] = useState<DefaultReply | null>(null);
  const [defaultForm, setDefaultForm] = useState<DefaultReplyForm>({
    cookie_id: '',
    enabled: false,
    reply_content: '',
    reply_once: false,
    reply_image_url: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAccountDetails().then((data) => {
      setAccounts(data);
      // 默认选择第一个账号
      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadKeywords();
      loadShippingRules();
      loadCards();
      loadDefaultReplies();
    }
  }, [selectedAccount]);

  const loadDefaultReplies = async () => {
    try {
      const data = await getDefaultReplies();
      setDefaultReplies(data);
    } catch (e) {
      console.error('加载默认回复失败', e);
    }
  };

  const loadShippingRules = async () => {
    try {
      const data = await getShippingRules();
      setShippingRules(data);
    } catch (e) {
      console.error('加载发货规则失败', e);
    }
  };

  const loadCards = async () => {
    try {
      const data = await getCards();
      setCards(data);
    } catch (e) {
      console.error('加载卡券失败', e);
    }
  };

  const loadKeywords = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const data = await getReplyRules(selectedAccount);
      setKeywords(data as Keyword[]);
    } catch (e) {
      console.error('加载关键词失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (activeTab === 'reply') {
      setEditingKeyword(null);
      setReplyForm({ keyword: '', reply_content: '' });
      setShowReplyModal(true);
    } else if (activeTab === 'delivery') {
      setEditingDeliveryRule(null);
      setDeliveryForm({ keyword: '', card_id: '', description: '', enabled: true });
      setShowDeliveryModal(true);
    } else {
      // default tab - 编辑选中账号的默认回复
      if (!selectedAccount) return;
      loadDefaultReplyForEdit(selectedAccount);
    }
  };

  const loadDefaultReplyForEdit = async (cookieId: string) => {
    try {
      const data = await getDefaultReply(cookieId);
      setEditingDefaultReply(data);
      setDefaultForm({
        cookie_id: cookieId,
        enabled: data.enabled,
        reply_content: data.reply_content,
        reply_once: data.reply_once,
        reply_image_url: data.reply_image_url || ''
      });
      setShowDefaultModal(true);
    } catch (e) {
      console.error('加载默认回复失败', e);
      // 如果没有设置，创建新的
      setEditingDefaultReply(null);
      setDefaultForm({
        cookie_id: cookieId,
        enabled: false,
        reply_content: '',
        reply_once: false,
        reply_image_url: ''
      });
      setShowDefaultModal(true);
    }
  };

  const handleEdit = (keyword: Keyword) => {
    if (activeTab === 'reply') {
      setEditingKeyword(keyword);
      setReplyForm({
        keyword: keyword.keyword,
        reply_content: keyword.reply_content
      });
      setShowReplyModal(true);
    }
  };

  const handleEditDelivery = (rule: ShippingRule) => {
    setEditingDeliveryRule(rule);
    setDeliveryForm({
      keyword: rule.item_keyword,
      card_id: String(rule.card_group_id),
      description: rule.name,
      enabled: rule.enabled
    });
    setShowDeliveryModal(true);
  };

  const handleSave = async () => {
    if (!selectedAccount) {
      alert('请先选择账号');
      return;
    }
    if (!replyForm.keyword.trim() || !replyForm.reply_content.trim()) {
      alert('请填写关键词和回复内容');
      return;
    }

    try {
      await updateReplyRule(
        {
          id: editingKeyword?.id,
          keyword: replyForm.keyword,
          reply_content: replyForm.reply_content,
          match_type: 'exact',
          enabled: true
        },
        selectedAccount
      );
      setShowReplyModal(false);
      loadKeywords();
      alert('保存成功！');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  const handleSaveDelivery = async () => {
    if (!deliveryForm.keyword.trim()) {
      alert('请填写触发关键词');
      return;
    }
    if (!deliveryForm.card_id) {
      alert('请选择卡券');
      return;
    }

    try {
      await updateShippingRule({
        id: editingDeliveryRule?.id,
        item_keyword: deliveryForm.keyword,
        card_group_id: parseInt(deliveryForm.card_id),
        name: deliveryForm.description,
        priority: 1,
        enabled: deliveryForm.enabled
      });
      setShowDeliveryModal(false);
      loadShippingRules();
      alert('保存成功！');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedAccount || !confirm('确认删除该关键词吗？')) return;
    try {
      await deleteReplyRule(id, selectedAccount);
      loadKeywords();
      alert('删除成功！');
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  const handleDeleteDelivery = async (id: string) => {
    if (!confirm('确认删除该发货规则吗？')) return;
    try {
      await deleteShippingRule(id);
      loadShippingRules();
      alert('删除成功！');
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  const handleToggleDelivery = async (rule: ShippingRule) => {
    try {
      await updateShippingRule({
        id: rule.id,
        item_keyword: rule.item_keyword,
        card_group_id: rule.card_group_id,
        name: rule.name,
        priority: rule.priority,
        enabled: !rule.enabled
      });
      loadShippingRules();
    } catch (e) {
      alert('操作失败：' + (e as Error).message);
    }
  };

  const handleSaveDefault = async () => {
    if (!defaultForm.cookie_id) {
      alert('请先选择账号');
      return;
    }

    try {
      await updateDefaultReply(defaultForm.cookie_id, {
        enabled: defaultForm.enabled,
        reply_content: defaultForm.reply_content,
        reply_once: defaultForm.reply_once,
        reply_image_url: defaultForm.reply_image_url
      });
      setShowDefaultModal(false);
      loadDefaultReplies();
      alert('保存成功！');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  const handleDeleteDefault = async (cookieId: string) => {
    if (!confirm('确认删除该默认回复吗？')) return;
    try {
      await deleteDefaultReply(cookieId);
      loadDefaultReplies();
      alert('删除成功！');
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  const handleClearRecords = async (cookieId: string) => {
    if (!confirm('确认清空该账号的回复记录吗？清空后可以重新对所有对话使用默认回复。')) return;
    try {
      await clearDefaultReplyRecords(cookieId);
      alert('清空成功！');
    } catch (e) {
      alert('清空失败：' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">关键词管理</h2>
          <p className="text-gray-500 mt-2 font-medium">配置自动回复和关键词发货规则</p>
        </div>
      </div>

      {/* Tab 切换 - 精美设计 */}
      <div className="flex justify-center">
        <div className="inline-flex bg-gradient-to-br from-gray-100 to-gray-200 p-2 rounded-3xl shadow-xl">
          <button
            onClick={() => setActiveTab('reply')}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
              activeTab === 'reply'
                ? 'bg-gradient-to-r from-[#FFE815] to-[#FFD700] text-gray-900 shadow-2xl scale-105'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <MessageSquare className="w-6 h-6" />
            关键词回复
            {activeTab === 'reply' && (
              <span className="ml-2 px-3 py-1 bg-white/30 rounded-full text-sm">{keywords.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
              activeTab === 'delivery'
                ? 'bg-gradient-to-r from-[#FFE815] to-[#FFD700] text-gray-900 shadow-2xl scale-105'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <Truck className="w-6 h-6" />
            关键词发货
            {activeTab === 'delivery' && (
              <span className="ml-2 px-3 py-1 bg-white/30 rounded-full text-sm">{shippingRules.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('default')}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
              activeTab === 'default'
                ? 'bg-gradient-to-r from-[#FFE815] to-[#FFD700] text-gray-900 shadow-2xl scale-105'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <Bot className="w-6 h-6" />
            账号默认回复
            {activeTab === 'default' && (
              <span className="ml-2 px-3 py-1 bg-white/30 rounded-full text-sm">{Object.values(defaultReplies).filter(r => r.enabled).length}</span>
            )}
          </button>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-3xl shadow-xl p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <label className="text-sm font-bold text-gray-700 whitespace-nowrap">选择账号</label>
            <select
              className="flex-1 sm:w-64 ios-input px-5 py-3 rounded-2xl font-medium border-2 border-gray-200 focus:border-[#FFE815] focus:ring-4 focus:ring-[#FFE815]/20 transition-all"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="">请选择账号</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nickname}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                if (activeTab === 'reply') loadKeywords();
                else if (activeTab === 'delivery') loadShippingRules();
                else loadDefaultReplies();
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 transition-all shadow-lg"
            >
              <RefreshCw className="w-5 h-5" />
              刷新
            </button>
            <button
              onClick={handleAdd}
              disabled={!selectedAccount}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-bold bg-gradient-to-r from-[#FFE815] to-[#FFD700] hover:from-[#FFD700] hover:to-[#FFC800] text-gray-900 shadow-xl hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'reply' ? '添加关键词' : activeTab === 'delivery' ? '添加发货规则' : '编辑默认回复'}
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      {!selectedAccount ? (
        <div className="py-24 text-center bg-gradient-to-br from-white to-gray-50 rounded-[2.5rem] border-3 border-dashed border-gray-300 shadow-xl">
          <div className="w-24 h-24 bg-gradient-to-br from-[#FFE815]/20 to-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <MessageSquare className="w-12 h-12 text-[#FFE815]" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">请选择账号</h3>
          <p className="text-gray-500 text-lg">选择一个账号以管理其关键词规则</p>
        </div>
      ) : activeTab === 'reply' ? (
        // 关键词回复列表
        loading ? (
          <div className="py-24 flex justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-16 h-16 text-[#FFE815] animate-spin" />
              <p className="text-gray-500 font-medium">加载中...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {keywords.map((keyword, index) => (
              <div
                key={keyword.id}
                className="group relative bg-gradient-to-br from-white to-gray-50 rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#FFE815]/30 overflow-hidden"
              >
                {/* 背景装饰 */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FFE815]/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>

                <div className="relative flex items-center gap-6">
                  {/* 图标 */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FFF9C4] to-[#FFE815] rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                      <Key className="w-8 h-8 text-yellow-800" />
                    </div>
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-black text-gray-900">{keyword.keyword}</h3>
                      <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-green-400 to-green-500 text-white text-xs font-bold shadow-md">
                        精确匹配
                      </span>
                    </div>
                    <p className="text-gray-600 bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-3 line-clamp-2 shadow-inner border border-gray-100">
                      💬 {keyword.reply_content || '无回复内容'}
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(keyword)}
                      className="p-3.5 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-2xl hover:from-amber-100 hover:to-amber-200 transition-all shadow-md hover:shadow-lg hover:scale-110"
                      title="编辑"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(keyword.id)}
                      className="p-3.5 bg-gradient-to-br from-red-50 to-red-100 text-red-500 rounded-2xl hover:from-red-100 hover:to-red-200 transition-all shadow-md hover:shadow-lg hover:scale-110"
                      title="删除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {keywords.length === 0 && (
              <div className="py-24 text-center bg-gradient-to-br from-white to-gray-50 rounded-[2.5rem] border-3 border-dashed border-gray-300 shadow-xl">
                <div className="w-24 h-24 bg-gradient-to-br from-[#FFE815]/20 to-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <MessageSquare className="w-12 h-12 text-[#FFE815]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">暂无关键词</h3>
                <p className="text-gray-500 text-lg">点击右上角添加新的关键词规则</p>
              </div>
            )}
          </div>
        )
      ) : activeTab === 'delivery' ? (
        // 关键词发货列表
        <div className="space-y-4">
          {shippingRules.map((rule) => (
            <div
              key={rule.id}
              className={`group relative bg-gradient-to-br ${rule.enabled ? 'from-white to-blue-50/30' : 'from-gray-100 to-gray-150'} rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 ${rule.enabled ? 'border-transparent hover:border-blue-400/30' : 'border-gray-200'} overflow-hidden`}
            >
              {/* 背景装饰 */}
              {rule.enabled && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
              )}

              <div className="relative flex items-center gap-6">
                {/* 图标 */}
                <div className="flex-shrink-0">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-300 ${
                    rule.enabled
                      ? 'bg-gradient-to-br from-blue-400 to-blue-500 group-hover:rotate-12'
                      : 'bg-gradient-to-br from-gray-300 to-gray-400'
                  }`}>
                    <Truck className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-black text-gray-900">{rule.item_keyword}</h3>
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-md ${
                      rule.enabled
                        ? 'bg-gradient-to-r from-green-400 to-green-500 text-white'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                    }`}>
                      {rule.enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  <p className="text-gray-600 bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-inner border border-gray-100">
                    🎁 卡券：{rule.card_group_name || `ID: ${rule.card_group_id}`}
                    {rule.name && (
                      <>
                        <span className="mx-2 text-gray-300">|</span>
                        📝 {rule.name}
                      </>
                    )}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleDelivery(rule)}
                    className={`p-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg hover:scale-110 ${
                      rule.enabled
                        ? 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 hover:from-amber-100 hover:to-amber-200'
                        : 'bg-gradient-to-br from-green-50 to-green-100 text-green-600 hover:from-green-100 hover:to-green-200'
                    }`}
                    title={rule.enabled ? '禁用' : '启用'}
                  >
                    {rule.enabled ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleEditDelivery(rule)}
                    className="p-3.5 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-2xl hover:from-amber-100 hover:to-amber-200 transition-all shadow-md hover:shadow-lg hover:scale-110"
                    title="编辑"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteDelivery(rule.id)}
                    className="p-3.5 bg-gradient-to-br from-red-50 to-red-100 text-red-500 rounded-2xl hover:from-red-100 hover:to-red-200 transition-all shadow-md hover:shadow-lg hover:scale-110"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {shippingRules.length === 0 && (
            <div className="py-24 text-center bg-gradient-to-br from-white to-gray-50 rounded-[2.5rem] border-3 border-dashed border-gray-300 shadow-xl">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-400/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Truck className="w-12 h-12 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">暂无发货规则</h3>
              <p className="text-gray-500 text-lg">点击右上角添加新的发货规则</p>
            </div>
          )}
        </div>
      ) : activeTab === 'default' ? (
        // 账号默认回复列表
        <div className="space-y-4">
          {accounts.map((account) => {
            const defaultReply = defaultReplies[account.id];
            const hasDefaultReply = defaultReply && defaultReply.enabled;
            return (
              <div
                key={account.id}
                className={`group relative bg-gradient-to-br ${hasDefaultReply ? 'from-white to-purple-50/30' : 'from-gray-100 to-gray-150'} rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 ${hasDefaultReply ? 'border-transparent hover:border-purple-400/30' : 'border-gray-200'} overflow-hidden`}
              >
                {/* 背景装饰 */}
                {hasDefaultReply && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
                )}

                <div className="relative flex items-center gap-6">
                  {/* 图标 */}
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-300 ${
                      hasDefaultReply
                        ? 'bg-gradient-to-br from-purple-400 to-purple-500 group-hover:rotate-12'
                        : 'bg-gradient-to-br from-gray-300 to-gray-400'
                    }`}>
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-black text-gray-900">{account.nickname}</h3>
                      <span className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-md ${
                        hasDefaultReply
                          ? 'bg-gradient-to-r from-green-400 to-green-500 text-white'
                          : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                      }`}>
                        {hasDefaultReply ? '已启用' : '未设置'}
                      </span>
                      {defaultReply?.reply_once && (
                        <span className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 text-xs font-bold shadow-md">
                          只回复一次
                        </span>
                      )}
                    </div>
                    {hasDefaultReply && (
                      <p className="text-gray-600 bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-3 line-clamp-2 shadow-inner border border-gray-100">
                        💬 {defaultReply.reply_content || '无回复内容'}
                      </p>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => loadDefaultReplyForEdit(account.id)}
                      className="p-3.5 bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 rounded-2xl hover:from-purple-100 hover:to-purple-200 transition-all shadow-md hover:shadow-lg hover:scale-110"
                      title="编辑"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {hasDefaultReply && (
                      <>
                        <button
                          onClick={() => handleClearRecords(account.id)}
                          className="p-3.5 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-2xl hover:from-blue-100 hover:to-blue-200 transition-all shadow-md hover:shadow-lg hover:scale-110"
                          title="清空回复记录"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDefault(account.id)}
                          className="p-3.5 bg-gradient-to-br from-red-50 to-red-100 text-red-500 rounded-2xl hover:from-red-100 hover:to-red-200 transition-all shadow-md hover:shadow-lg hover:scale-110"
                          title="删除"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {accounts.length === 0 && (
            <div className="py-24 text-center bg-gradient-to-br from-white to-gray-50 rounded-[2.5rem] border-3 border-dashed border-gray-300 shadow-xl">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-400/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Bot className="w-12 h-12 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">暂无账号</h3>
              <p className="text-gray-500 text-lg">请先添加账号</p>
            </div>
          )}
        </div>
      ) : null}

      {/* 关键词回复弹窗 */}
      {showReplyModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FFE815] to-[#FFD700] p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/30 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <MessageSquare className="w-7 h-7 text-gray-900" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-900">
                    {editingKeyword ? '编辑关键词' : '添加关键词'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="p-3 bg-white/30 backdrop-blur-sm rounded-2xl hover:bg-white/40 transition-colors"
                >
                  <X className="w-6 h-6 text-gray-900" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <Key className="w-5 h-5 text-[#FFE815]" />
                  触发关键词
                </label>
                <input
                  type="text"
                  value={replyForm.keyword}
                  onChange={(e) => setReplyForm({ ...replyForm, keyword: e.target.value })}
                  placeholder="例如：价格、包邮、怎么样"
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-[#FFE815] focus:ring-4 focus:ring-[#FFE815]/20 transition-all bg-gray-50"
                />
                <p className="text-sm text-gray-500 mt-2 ml-1">💡 买家消息中包含此关键词时自动回复</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <MessageSquare className="w-5 h-5 text-[#FFE815]" />
                  回复内容
                </label>
                <textarea
                  value={replyForm.reply_content}
                  onChange={(e) => setReplyForm({ ...replyForm, reply_content: e.target.value })}
                  placeholder="输入自动回复的内容..."
                  rows={6}
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-[#FFE815] focus:ring-4 focus:ring-[#FFE815]/20 transition-all bg-gray-50 resize-none"
                />
                <p className="text-sm text-gray-500 mt-2 ml-1">💬 支持换行，系统将自动发送此内容给买家</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-gray-50 border-t border-gray-100">
              <div className="flex gap-4">
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 transition-all shadow-lg hover:shadow-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold bg-gradient-to-r from-[#FFE815] to-[#FFD700] hover:from-[#FFD700] hover:to-[#FFC800] text-gray-900 shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  保存关键词
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 关键词发货弹窗 */}
      {showDeliveryModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-400 to-blue-500 p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/30 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Truck className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-3xl font-black text-white">
                    {editingDeliveryRule ? '编辑发货规则' : '添加发货规则'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  className="p-3 bg-white/30 backdrop-blur-sm rounded-2xl hover:bg-white/40 transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <Key className="w-5 h-5 text-blue-500" />
                  触发关键词
                </label>
                <input
                  type="text"
                  value={deliveryForm.keyword}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, keyword: e.target.value })}
                  placeholder="例如：发货卡密、自动发货"
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all bg-gray-50"
                />
                <p className="text-sm text-gray-500 mt-2 ml-1">💡 买家消息中包含此关键词时自动发货</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  关联卡券
                </label>
                <select
                  value={deliveryForm.card_id}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, card_id: e.target.value })}
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all bg-gray-50"
                >
                  <option value="">请选择卡券</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name || card.text_content?.substring(0, 30) || `卡券 ${card.id}`}
                      {card.is_multi_spec && ` [${card.spec_name}: ${card.spec_value}]`}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2 ml-1">🎁 选择触发关键词时发送的卡券</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                  描述（可选）
                </label>
                <input
                  type="text"
                  value={deliveryForm.description}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, description: e.target.value })}
                  placeholder="规则描述，方便识别"
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all bg-gray-50"
                />
              </div>

              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-2xl border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <Power className="w-6 h-6 text-blue-500" />
                  <span className="text-base font-black text-gray-900">启用此规则</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeliveryForm({ ...deliveryForm, enabled: !deliveryForm.enabled })}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${
                    deliveryForm.enabled ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                      deliveryForm.enabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-gray-50 border-t border-gray-100">
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 transition-all shadow-lg hover:shadow-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveDelivery}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  保存发货规则
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 账号默认回复弹窗 */}
      {showDefaultModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-400 to-purple-500 p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/30 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-3xl font-black text-white">
                    账号默认回复
                  </h3>
                </div>
                <button
                  onClick={() => setShowDefaultModal(false)}
                  className="p-3 bg-white/30 backdrop-blur-sm rounded-2xl hover:bg-white/40 transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <Bot className="w-5 h-5 text-purple-500" />
                  账号
                </label>
                <select
                  value={defaultForm.cookie_id}
                  onChange={(e) => setDefaultForm({ ...defaultForm, cookie_id: e.target.value })}
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 transition-all bg-gray-50"
                >
                  <option value="">请选择账号</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2 ml-1">🤖 为此账号设置默认回复内容</p>
              </div>

              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-2xl border-2 border-purple-200">
                <div className="flex items-center gap-3">
                  <Power className="w-6 h-6 text-purple-500" />
                  <span className="text-base font-black text-gray-900">启用默认回复</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDefaultForm({ ...defaultForm, enabled: !defaultForm.enabled })}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${
                    defaultForm.enabled ? 'bg-purple-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                      defaultForm.enabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  回复内容
                </label>
                <textarea
                  value={defaultForm.reply_content}
                  onChange={(e) => setDefaultForm({ ...defaultForm, reply_content: e.target.value })}
                  placeholder="输入默认回复的内容..."
                  rows={6}
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 transition-all bg-gray-50 resize-none"
                />
                <p className="text-sm text-gray-500 mt-2 ml-1">💬 当没有匹配的关键词时，系统将自动发送此内容</p>
              </div>

              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-2xl border-2 border-amber-200">
                <div className="flex items-center gap-3">
                  <span className="text-base font-black text-gray-900">🔁 只回复一次</span>
                  <span className="text-xs text-gray-500">启用后，每个对话只使用一次默认回复</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDefaultForm({ ...defaultForm, reply_once: !defaultForm.reply_once })}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${
                    defaultForm.reply_once ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                      defaultForm.reply_once ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-black text-gray-900 mb-3">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  回复图片URL（可选）
                </label>
                <input
                  type="text"
                  value={defaultForm.reply_image_url}
                  onChange={(e) => setDefaultForm({ ...defaultForm, reply_image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-6 py-4 rounded-2xl font-medium border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 transition-all bg-gray-50"
                />
                <p className="text-sm text-gray-500 mt-2 ml-1">🖼️ 可选：添加图片URL一起发送</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-gray-50 border-t border-gray-100">
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDefaultModal(false)}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 transition-all shadow-lg hover:shadow-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveDefault}
                  className="flex-1 px-8 py-4 rounded-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  保存默认回复
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Keywords;
