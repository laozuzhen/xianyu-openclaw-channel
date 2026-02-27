/**
 * 免责声明弹窗组件
 * 
 * 用户登录后首次使用系统时显示，必须同意后才能使用系统功能
 */
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { DisclaimerContent } from './DisclaimerContent'

interface DisclaimerModalProps {
  isOpen: boolean
  onAgree: () => void
  onDisagree: () => void
}

export function DisclaimerModal({ isOpen, onAgree, onDisagree }: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* 弹窗内容 */}
      <div
        className={cn(
          'relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col',
          'bg-white dark:bg-slate-800 rounded-2xl shadow-2xl',
          'border border-slate-200 dark:border-slate-700'
        )}
      >
        {/* 标题栏 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            免责声明
          </h2>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DisclaimerContent />
        </div>

        {/* 底部操作区 */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          {/* 勾选确认 */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              我已阅读并同意以上免责声明
            </span>
          </label>

          {/* 按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onDisagree}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
                'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
                'hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              不同意
            </button>
            <button
              onClick={onAgree}
              disabled={!checked}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
                checked
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              )}
            >
              同意并继续
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
