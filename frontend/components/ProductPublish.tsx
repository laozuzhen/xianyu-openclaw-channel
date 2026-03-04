import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, X, Plus, Loader2, Check, AlertCircle, 
  Image as ImageIcon, DollarSign, Package, MapPin, Tag
} from 'lucide-react';
import { getAccountDetails } from '../services/api';
import { publishProduct, uploadImage } from '../services/productService';
import { AccountDetail } from '../types';

const ProductPublish: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultSuccess, setResultSuccess] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    cookie_id: '',
    description: '',
    price: '',
    original_price: '',
    stock: '1',
    category: '',
    location: '',
  });

  // 图片相关
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await getAccountDetails();
      setAccounts(data.filter(acc => acc.enabled));
      if (data.length > 0 && !formData.cookie_id) {
        setFormData(prev => ({ ...prev, cookie_id: data[0].id }));
      }
    } catch (error) {
      console.error('加载账号失败:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 创建预览
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewImages(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);

        // 上传图片
        const result = await uploadImage(file);
        if (result.success && result.url) {
          setImages(prev => [...prev, result.url]);
        }
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      alert('图片上传失败，请重试');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证
    if (!formData.cookie_id) {
      alert('请选择发布账号');
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      alert('请输入有效的价格');
      return;
    }
    if (images.length === 0) {
      alert('请至少上传一张商品图片');
      return;
    }

    setPublishing(true);
    try {
      const result = await publishProduct({
        cookie_id: formData.cookie_id,
        description: formData.description,
        price: parseFloat(formData.price),
        images: images,
        category: formData.category || undefined,
        location: formData.location || undefined,
        original_price: formData.original_price ? parseFloat(formData.original_price) : undefined,
        stock: parseInt(formData.stock) || 1,
      });

      setResultSuccess(result.success);
      setResultMessage(result.message || '发布成功！');
      setShowResult(true);

      if (result.success) {
        // 重置表单
        setFormData({
          cookie_id: formData.cookie_id,
          description: '',
          price: '',
          original_price: '',
          stock: '1',
          category: '',
          location: '',
        });
        setImages([]);
        setPreviewImages([]);
      }
    } catch (error: any) {
      setResultSuccess(false);
      setResultMessage(error.message || '发布失败，请重试');
      setShowResult(true);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">发布商品</h2>
        <p className="text-gray-500 mt-2 font-medium">填写商品信息并发布到闲鱼平台</p>
      </div>

      <form onSubmit={handleSubmit} className="ios-card p-8 rounded-[2rem] space-y-6">
        {/* 选择账号 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">发布账号 *</label>
          <select
            value={formData.cookie_id}
            onChange={(e) => setFormData({ ...formData, cookie_id: e.target.value })}
            className="w-full ios-input px-4 py-3 rounded-xl"
            required
          >
            <option value="">请选择账号</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.nickname || account.remark || account.id}
              </option>
            ))}
          </select>
        </div>

        {/* 商品描述 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">商品描述</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="详细描述商品的状态、配置、使用情况等..."
            className="w-full ios-input px-4 py-3 rounded-xl h-32 resize-none"
            maxLength={500}
          />
          <p className="text-xs text-gray-500 mt-1">{formData.description.length}/500 字符</p>
        </div>

        {/* 价格信息 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              售价 (元) *
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full ios-input px-4 py-3 rounded-xl"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">原价 (元)</label>
            <input
              type="number"
              value={formData.original_price}
              onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full ios-input px-4 py-3 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              库存
            </label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              placeholder="1"
              min="1"
              className="w-full ios-input px-4 py-3 rounded-xl"
            />
          </div>
        </div>

        {/* 分类和位置 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-500" />
              分类
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="例如：数码产品/手机/苹果"
              className="w-full ios-input px-4 py-3 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" />
              位置
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="例如：北京市/朝阳区"
              className="w-full ios-input px-4 py-3 rounded-xl"
            />
          </div>
        </div>

        {/* 图片上传 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-500" />
            商品图片 * (最多9张)
          </label>
          
          <div className="grid grid-cols-5 gap-4">
            {previewImages.map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview}
                  alt={`商品图片 ${index + 1}`}
                  className="w-full aspect-square object-cover rounded-xl border-2 border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {previewImages.length < 9 && (
              <label className="w-full aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#FFE815] hover:bg-yellow-50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
                {uploadingImage ? (
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-xs text-gray-500 font-medium">上传图片</span>
                  </>
                )}
              </label>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            支持 JPG、PNG 格式，单张图片不超过 5MB
          </p>
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={publishing || uploadingImage}
            className="flex-1 ios-btn-primary h-14 rounded-xl text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {publishing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                发布中...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                立即发布
              </>
            )}
          </button>
        </div>
      </form>

      {/* 结果提示弹窗 */}
      {showResult && createPortal(
        <div className="modal-overlay-centered">
          <div className="modal-container" style={{ maxWidth: '400px' }}>
            <div className="modal-body text-center py-8">
              <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
                resultSuccess ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {resultSuccess ? (
                  <Check className="w-10 h-10 text-green-600" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-red-600" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {resultSuccess ? '发布成功' : '发布失败'}
              </h3>
              <p className="text-gray-600">{resultMessage}</p>
              <button
                onClick={() => setShowResult(false)}
                className="mt-6 ios-btn-primary px-8 py-3 rounded-xl font-bold"
              >
                确定
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProductPublish;
