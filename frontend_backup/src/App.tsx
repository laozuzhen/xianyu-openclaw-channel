import React, { useEffect, useState, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { MainLayout } from '@/components/layout/MainLayout'
import { Login } from '@/pages/auth/Login'
import { Register } from '@/pages/auth/Register'
import { DashboardV3 as Dashboard } from '@/pages/dashboard/DashboardV3'
import { AccountsV3 as Accounts } from '@/pages/accounts/AccountsV3'
import { Items } from '@/pages/items/Items'
import { OrdersV3 as Orders } from '@/pages/orders/OrdersV3'
import { Keywords } from '@/pages/keywords/Keywords'
import { About } from '@/pages/about/About'
import { Disclaimer } from '@/pages/disclaimer/Disclaimer'
import { Cards } from '@/pages/cards/Cards'
import { Delivery } from '@/pages/delivery/Delivery'
import { NotificationChannels } from '@/pages/notifications/NotificationChannels'
import { MessageNotifications } from '@/pages/notifications/MessageNotifications'
import { Settings } from '@/pages/settings/Settings'
import { ItemReplies } from '@/pages/item-replies/ItemReplies'
import { ItemSearch } from '@/pages/search/ItemSearch'
import { ManualShip } from '@/pages/manual-ship/ManualShip'
import { Users } from '@/pages/admin/Users'
import { Logs } from '@/pages/admin/Logs'
import { RiskLogs } from '@/pages/admin/RiskLogs'
import { DataManagement } from '@/pages/admin/DataManagement'
import { DisclaimerModal } from '@/components/common/DisclaimerModal'
import { verifyToken } from '@/api/auth'
import { Toast } from '@/components/common/Toast'

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setAuth, clearAuth, token: storeToken, _hasHydrated } = useAuthStore()
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const checkingRef = useRef(false)

  useEffect(() => {
    // 等待 zustand persist 完成 hydration
    if (!_hasHydrated) {
      return
    }
    
    // 防止并发检查
    if (checkingRef.current) {
      return
    }
    
    const checkAuth = async () => {
      checkingRef.current = true
      
      // 优先使用 store 中的 token，其次是 localStorage
      const token = storeToken || localStorage.getItem('auth_token')
      
      if (!token) {
        setAuthState('unauthenticated')
        checkingRef.current = false
        return
      }

      // 验证 token 有效性（不再单纯相信本地 isAuthenticated 状态）
      try {
        const result = await verifyToken()
        if (result.authenticated && result.user_id) {
          setAuth(token, {
            user_id: result.user_id,
            username: result.username || '',
            is_admin: result.is_admin || false,
          })
          setAuthState('authenticated')
          
          // 检查是否已同意免责声明（针对每个用户）
          const disclaimerKey = `disclaimer_accepted_${result.user_id}`
          const disclaimerAccepted = localStorage.getItem(disclaimerKey)
          if (!disclaimerAccepted) {
            setShowDisclaimer(true)
          }
        } else {
          clearAuth()
          setAuthState('unauthenticated')
        }
      } catch {
        clearAuth()
        setAuthState('unauthenticated')
      } finally {
        checkingRef.current = false
      }
    }

    checkAuth()
  }, [_hasHydrated, isAuthenticated, storeToken, setAuth, clearAuth])

  const handleDisclaimerAgree = () => {
    // 使用用户ID存储免责声明同意状态
    const userId = useAuthStore.getState().user?.user_id
    if (userId) {
      localStorage.setItem(`disclaimer_accepted_${userId}`, 'true')
    }
    setShowDisclaimer(false)
  }

  const handleDisclaimerDisagree = () => {
    clearAuth()
    setShowDisclaimer(false)
    setAuthState('unauthenticated')
  }

  // 等待 hydration 或检查完成
  if (!_hasHydrated || authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      {children}
      <DisclaimerModal
        isOpen={showDisclaimer}
        onAgree={handleDisclaimerAgree}
        onDisagree={handleDisclaimerDisagree}
      />
    </>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* 全局 Toast 组件 */}
      <Toast />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="items" element={<Items />} />
          <Route path="orders" element={<Orders />} />
          <Route path="manual-ship" element={<ManualShip />} />
          <Route path="keywords" element={<Keywords />} />
          <Route path="item-replies" element={<ItemReplies />} />
          <Route path="cards" element={<Cards />} />
          <Route path="delivery" element={<Delivery />} />
          <Route path="notification-channels" element={<NotificationChannels />} />
          <Route path="message-notifications" element={<MessageNotifications />} />
          <Route path="item-search" element={<ItemSearch />} />
          <Route path="settings" element={<Settings />} />
          <Route path="disclaimer" element={<Disclaimer />} />
          <Route path="about" element={<About />} />

          {/* Admin routes */}
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/logs" element={<Logs />} />
          <Route path="admin/risk-logs" element={<RiskLogs />} />
          <Route path="admin/data" element={<DataManagement />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
