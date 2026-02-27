import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, Home } from 'lucide-react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { cn } from '@/utils/cn'

interface Tab {
  path: string
  title: string
  closable: boolean
}

interface TabsStore {
  tabs: Tab[]
  activeTab: string
  addTab: (tab: Tab) => void
  removeTab: (path: string) => void
  removeTabsToRight: (path: string) => void
  removeTabsToLeft: (path: string) => void
  removeAllTabs: () => void
  setActiveTab: (path: string) => void
}

// 路由标题映射
const routeTitles: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/accounts': '账号管理',
  '/items': '商品管理',
  '/keywords': '自动回复',
  '/item-replies': '指定商品回复',
  '/orders': '订单管理',
  '/cards': '卡券管理',
  '/delivery': '自动发货',
  '/notification-channels': '通知渠道',
  '/message-notifications': '消息通知',
  '/item-search': '商品搜索',
  '/settings': '系统设置',
  '/admin/users': '用户管理',
  '/admin/logs': '系统日志',
  '/admin/risk-logs': '风控日志',
  '/admin/data': '数据管理',
  '/disclaimer': '免责声明',
  '/about': '数据日志',
}

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      tabs: [{ path: '/dashboard', title: '仪表盘', closable: false }],
      activeTab: '/dashboard',
      
      addTab: (tab) => {
        const { tabs } = get()
        const exists = tabs.find(t => t.path === tab.path)
        if (!exists) {
          set({ tabs: [...tabs, tab], activeTab: tab.path })
        } else {
          set({ activeTab: tab.path })
        }
      },
      
      removeTab: (path) => {
        const { tabs, activeTab } = get()
        const newTabs = tabs.filter(t => t.path !== path)
        
        if (activeTab === path && newTabs.length > 0) {
          set({ tabs: newTabs, activeTab: newTabs[newTabs.length - 1].path })
        } else {
          set({ tabs: newTabs })
        }
      },
      
      removeTabsToRight: (path) => {
        const { tabs, activeTab } = get()
        const index = tabs.findIndex(t => t.path === path)
        if (index === -1) return
        
        const newTabs = tabs.slice(0, index + 1)
        const activeIndex = tabs.findIndex(t => t.path === activeTab)
        
        if (activeIndex > index) {
          set({ tabs: newTabs, activeTab: path })
        } else {
          set({ tabs: newTabs })
        }
      },
      
      removeTabsToLeft: (path) => {
        const { tabs, activeTab } = get()
        const index = tabs.findIndex(t => t.path === path)
        if (index === -1) return
        
        // 保留仪表盘和当前标签及右侧的标签
        const newTabs = [tabs[0], ...tabs.slice(index).filter(t => t.path !== '/dashboard')]
        const activeIndex = tabs.findIndex(t => t.path === activeTab)
        
        if (activeIndex < index && activeTab !== '/dashboard') {
          set({ tabs: newTabs, activeTab: path })
        } else {
          set({ tabs: newTabs })
        }
      },
      
      removeAllTabs: () => {
        set({ 
          tabs: [{ path: '/dashboard', title: '仪表盘', closable: false }],
          activeTab: '/dashboard'
        })
      },
      
      setActiveTab: (path) => set({ activeTab: path }),
    }),
    {
      name: 'tabs-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  targetPath: string
}

export function TabsBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { tabs, activeTab, addTab, removeTab, removeTabsToRight, removeTabsToLeft, removeAllTabs, setActiveTab } = useTabsStore()
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetPath: ''
  })
  const menuRef = useRef<HTMLDivElement>(null)

  // 监听路由变化，自动添加标签
  useEffect(() => {
    const path = location.pathname
    const title = routeTitles[path]
    
    if (title) {
      addTab({
        path,
        title,
        closable: path !== '/dashboard',
      })
    }
  }, [location.pathname])

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }))
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleTabClick = (path: string) => {
    setActiveTab(path)
    navigate(path)
  }

  const handleTabClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    removeTab(path)
    
    if (activeTab === path) {
      const remainingTabs = tabs.filter(t => t.path !== path)
      if (remainingTabs.length > 0) {
        navigate(remainingTabs[remainingTabs.length - 1].path)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetPath: path
    })
  }

  const handleCloseCurrentTab = () => {
    const { targetPath } = contextMenu
    if (targetPath !== '/dashboard') {
      removeTab(targetPath)
      if (activeTab === targetPath) {
        navigate('/dashboard')
      }
    }
    setContextMenu(prev => ({ ...prev, visible: false }))
  }

  const handleCloseRightTabs = () => {
    removeTabsToRight(contextMenu.targetPath)
    setContextMenu(prev => ({ ...prev, visible: false }))
  }

  const handleCloseLeftTabs = () => {
    removeTabsToLeft(contextMenu.targetPath)
    setContextMenu(prev => ({ ...prev, visible: false }))
  }

  const handleCloseAllTabs = () => {
    removeAllTabs()
    navigate('/dashboard')
    setContextMenu(prev => ({ ...prev, visible: false }))
  }

  const targetIndex = tabs.findIndex(t => t.path === contextMenu.targetPath)
  const hasRightTabs = targetIndex < tabs.length - 1
  const hasLeftTabs = targetIndex > 1 || (targetIndex === 1 && tabs[0].path === '/dashboard')

  return (
    <>
      <div className="tabs-bar overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max">
          {tabs.map((tab) => (
            <div
              key={tab.path}
              onClick={() => handleTabClick(tab.path)}
              onContextMenu={(e) => handleContextMenu(e, tab.path)}
              className={cn(
                activeTab === tab.path ? 'tab-item-active' : 'tab-item',
                'whitespace-nowrap flex-shrink-0'
              )}
            >
              {tab.path === '/dashboard' && <Home className="w-3.5 h-3.5" />}
              <span className="text-xs sm:text-sm">{tab.title}</span>
              {tab.closable && (
                <button
                  onClick={(e) => handleTabClose(e, tab.path)}
                  className="tab-close"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-md py-0.5 text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleCloseCurrentTab}
            disabled={contextMenu.targetPath === '/dashboard'}
            className="w-full px-3 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            关闭当前
          </button>
          <button
            onClick={handleCloseRightTabs}
            disabled={!hasRightTabs}
            className="w-full px-3 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            关闭右侧
          </button>
          <button
            onClick={handleCloseLeftTabs}
            disabled={!hasLeftTabs}
            className="w-full px-3 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            关闭左侧
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-0.5" />
          <button
            onClick={handleCloseAllTabs}
            className="w-full px-3 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
          >
            关闭所有
          </button>
        </div>
      )}
    </>
  )
}
