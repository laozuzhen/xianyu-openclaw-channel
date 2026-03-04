import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, X, Loader2, Check, AlertCircle, FileText,
  Edit2, Trash2, Download, CheckCircle, XCircle
} from 'lucide-react';
import { getAccountDetails } from '../services/api';
import { batchPublishProducts, ProductInfo } from '../services/productService';
import { AccountDetail } from '../types';

interface ProductRow extends ProductInfo {
  id: string;
  status?: 'pending' | 'success' | 'failed';
  error?: string;
}

const BatchProductPublish: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ current: 0, total: 0 });
  const [showResult, setShowResult] = useState(false);
  const [publishResults, setPublishResults] = useState<any>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await getAccountDetails();
      setAccounts(data.filter(acc => acc.enabled));
      if (data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].id);
      }
    } catch (error) {
      console.error('加载账号失败:', error);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      alert('CSV 文件格式错误');
      return;
    }

    // 解析表头
    const headers = lines[0].split(',').map(h => h.trim());
    
    // 解析数据行
    const parsedProducts: ProductRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      parsedProducts.push({
        id: `product-${i}`,
        title: row.title || '',
        description: row.description || '',
        price: parseFloat(row.price) || 0,
        images: row.images ? row.images.split('|').filter(Boolean) : [],
        category: row.category || '',
        location: row.location || '',
        original_price: row.original_price ? parseFloat(row.original_price) : undefined,
        stock: row.stock ? parseInt(row.stock) : 1,
        status: 'pending',
      });
    }

    setProducts(parsedProducts);
  };

  const downloadTemplate = () => {
    const template = `title,description,price,images,category,location,original_price,stock
全新 iPhone 15,全新未拆封,8999.00,img1.jpg|img2.jpg,数码产品/手机/苹果,北京市/朝阳区,9999.00,1
二手 MacBook Pro,9成新,12999.00,img3.jpg|img4.jpg,数码产品/笔记本/苹果,上海市/浦东新区,15999.00,1`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'products_template.csv';
    link.click();
  };

  const updateProduct = (id: string, updates: Partial<ProductRow>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleBatchPublish = async () => {
    if (!selectedAccount) {
      alert('请选择发布账号');
      return;
    }
    if (products.length === 0) {
      alert('请先上传商品数据');
      return;
    }

    setPublishing(true);
    setPublishProgress({ current: 0, total: products.length });

    try {
      const result = await batchPublishProducts({
        cookie_id: selectedAccount,
        products: products.map(({ id, status, error, ...product }) => product),
      });

      setPublishResults(result.results);
      setShowResult(true);

      // 更新商品状态
      if (result.results?.details) {
        result.results.details.forEach((detail: any, index: number) => {
          if (products[index]) {
            updateProduct(products[index].id, {
              status: detail.status === 'success' ? 'success' : 'failed',
              error: detail.error,
            });
          }
        });
      }
    } catch (error: any) {
      alert(error.message || '批量发布失败');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">批量发布商品</h2>
          <p className="text-gray-500 mt-2 font-medium">通过 CSV 文件批量导入并发布商品</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <Download className="w-5 h-5" />
          下载模板
        </button>
      </div>

      {/* 上传区域 */}
      <div className="ios-card p-8 rounded-[2rem] space-y-6">
        <div className="grid grid-cols-2 gap-6">
          {/* 选择账号 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">发布账号 *</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full ios-input px-4 py-3 rounded-xl"
            >
              <option value="">请选择账号</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.nickname || account.remark || account.id}
                </option>
              ))}
            </select>
          </div>

          {/* CSV 上传 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">上传 CSV 文件 *</label>
            <label className="w-full h-[52px] border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-[#FFE815] hover:bg-yellow-50 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <FileText className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600 font-medium">选择 CSV 文件</span>
            </label>
          </div>
        </div>

        {/* CSV 格式说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="font-bold text-blue-900 mb-2">CSV 文件格式说明</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• 第一行为表头：title,description,price,images,category,location,original_price,stock</li>
            <li>• images 字段使用 | 分隔多张图片路径</li>
            <li>• price 和 original_price 为数字，stock 为整数</li>
            <li>• 建议先下载模板查看示例格式</li>
          </ul>
        </div>
      </div>

      {/* 商品列表 */}
      {products.length > 0 && (
        <div className="ios-card p-8 rounded-[2rem]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              商品列表 ({products.length} 个)
            </h3>
            <button
              onClick={handleBatchPublish}
              disabled={publishing || !selectedAccount}
              className="ios-btn-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  发布中 {publishProgress.current}/{publishProgress.total}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  批量发布
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">标题</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">价格</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">图片</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">分类</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">库存</th>
                  <th className="text-right py-3 px-4 text-sm font-bold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {product.status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {product.status === 'failed' && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      {product.status === 'pending' && (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{product.title}</div>
                      {product.error && (
                        <div className="text-xs text-red-500 mt-1">{product.error}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700">¥{product.price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">
                      {product.images.length} 张
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm">{product.category || '-'}</td>
                    <td className="py-3 px-4 text-gray-700">{product.stock}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                        disabled={publishing}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 结果统计弹窗 */}
      {showResult && publishResults && createPortal(
        <div className="modal-overlay-centered">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="text-2xl font-extrabold text-gray-900">发布结果</h3>
              <button
                onClick={() => setShowResult(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="modal-body space-y-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{publishResults.total}</div>
                  <div className="text-sm text-blue-700 mt-1">总数</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{publishResults.success}</div>
                  <div className="text-sm text-green-700 mt-1">成功</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{publishResults.failed}</div>
                  <div className="text-sm text-red-700 mt-1">失败</div>
                </div>
              </div>

              {/* 失败详情 */}
              {publishResults.failed > 0 && publishResults.details && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-bold text-red-900 mb-2">失败商品</h4>
                  <div className="space-y-2">
                    {publishResults.details
                      .filter((d: any) => d.status === 'failed')
                      .map((detail: any, index: number) => (
                        <div key={index} className="text-sm text-red-800">
                          <span className="font-medium">{detail.title}</span>
                          {detail.error && <span className="text-red-600"> - {detail.error}</span>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowResult(false)}
                className="w-full ios-btn-primary px-6 py-3 rounded-xl font-bold"
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

export default BatchProductPublish;
