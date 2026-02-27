import { create } from 'zustand'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface UIState {
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean
  loading: boolean
  darkMode: boolean
  toasts: Toast[]
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarMobileOpen: (open: boolean) => void
  setLoading: (loading: boolean) => void
  toggleDarkMode: () => void
  setDarkMode: (darkMode: boolean) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set) => {
  // Initialize dark mode from localStorage or system preference
  const storedDarkMode = localStorage.getItem('darkMode')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const initialDarkMode = storedDarkMode ? storedDarkMode === 'true' : prefersDark

  // Apply dark mode class to document
  if (initialDarkMode) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  return {
    sidebarCollapsed: false,
    sidebarMobileOpen: false,
    loading: false,
    darkMode: initialDarkMode,
    toasts: [],

    toggleSidebar: () => {
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
    },

    setSidebarCollapsed: (collapsed) => {
      set({ sidebarCollapsed: collapsed })
    },

    setSidebarMobileOpen: (open) => {
      set({ sidebarMobileOpen: open })
    },

    setLoading: (loading) => {
      set({ loading })
    },

    toggleDarkMode: () => {
      set((state) => {
        const newDarkMode = !state.darkMode
        // Update localStorage
        localStorage.setItem('darkMode', String(newDarkMode))
        // Update document class
        if (newDarkMode) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        return { darkMode: newDarkMode }
      })
    },

    setDarkMode: (darkMode) => {
      localStorage.setItem('darkMode', String(darkMode))
      if (darkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      set({ darkMode })
    },

    addToast: (toast) => {
      const id = Math.random().toString(36).substr(2, 9)
      set((state) => ({
        toasts: [...state.toasts, { ...toast, id }],
      }))

      // 自动移除 toast
      const duration = toast.duration ?? 3000
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    },

    removeToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    },
  }
})
