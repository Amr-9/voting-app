import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext.tsx'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAdminAuth()

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
