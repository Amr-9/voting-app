import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { adminAPI, setUnauthorizedCallback } from '../services/api.ts'

interface AdminAuthContextValue {
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  // loading stays true until the initial /me check completes (prevents flash on ProtectedRoute)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Register callback: if any request gets a 401 mid-session, clear auth state
    setUnauthorizedCallback(() => setIsAuthenticated(false))

    // Verify whether a valid cookie already exists (e.g. after page refresh)
    adminAPI.me()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoading(false))

    return () => setUnauthorizedCallback(() => {})
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      await adminAPI.login(email, password)
      setIsAuthenticated(true)
      return { success: true }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Login failed'
      return { success: false, message }
    }
  }, [])

  const logout = useCallback(async () => {
    await adminAPI.logout().catch(() => {})
    setIsAuthenticated(false)
  }, [])

  const value = useMemo(() => ({
    isAuthenticated,
    loading,
    login,
    logout,
  }), [isAuthenticated, loading, login, logout])

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

const defaultAuthValue: AdminAuthContextValue = {
  isAuthenticated: false,
  loading: false,
  login: async () => ({ success: false, message: 'Not in provider' }),
  logout: async () => {},
}

export function useAdminAuth(): AdminAuthContextValue {
  return useContext(AdminAuthContext) ?? defaultAuthValue
}
