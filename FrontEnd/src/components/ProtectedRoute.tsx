import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext.tsx'
import LoadingSpinner from './LoadingSpinner.tsx'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner size={36} className="text-brand-500" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
