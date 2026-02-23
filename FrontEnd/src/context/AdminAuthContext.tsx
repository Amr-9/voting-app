import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { adminAPI } from '../services/api.ts'

interface AdminAuthContextValue {
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

const TOKEN_KEY = 'admin_token'

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  // Synchronous init — no flash on ProtectedRoute
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const data = await adminAPI.login(email, password)
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      return { success: true }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Login failed'
      return { success: false, message }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }, [])

  const value = useMemo(() => ({
    token,
    isAuthenticated: !!token,
    loading,
    login,
    logout,
  }), [token, loading, login, logout])

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider')
  return ctx
}
