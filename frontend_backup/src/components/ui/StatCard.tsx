import { cn } from '@/utils/cn'
import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: {
    value: number
    label: string
  }
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  action?: {
    label: string
    onClick: () => void
  }
  delay?: number
}

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  color = 'primary',
  action,
  delay = 0,
}: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
    info: 'bg-info-50 text-info-600',
  }

  const trendColorClasses = {
    positive: 'text-success-600',
    negative: 'text-danger-600',
    neutral: 'text-gray-500',
  }

  const trendDirection = trend ? (trend.value > 0 ? 'positive' : trend.value < 0 ? 'negative' : 'neutral') : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white border border-gray-200 rounded-xl shadow-card hover:shadow-card-hover transition-all p-6"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center mb-4', colorClasses[color])}>
            <Icon className="w-6 h-6" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {trend && (
            <div className={cn('text-xs font-medium mt-2', trendDirection && trendColorClasses[trendDirection])}>
              {trend.value > 0 && '+'}
              {trend.value}% {trend.label}
            </div>
          )}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 w-full text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          {action.label} →
        </button>
      )}
    </motion.div>
  )
}
