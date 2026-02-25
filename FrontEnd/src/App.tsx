import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AdminAuthProvider } from './context/AdminAuthContext.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import Toaster from './components/Toaster.tsx'
import LoadingSpinner from './components/LoadingSpinner.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'

// Lazy-loaded pages — code splitting per route
const Home = lazy(() => import('./pages/Home.tsx'))
const AdminLogin = lazy(() => import('./pages/admin/Login.tsx'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.tsx'))

function PageFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      <LoadingSpinner size={36} className="text-brand-500" />
    </div>
  )
}

// AdminAuthProvider wraps only /admin/* routes — avoids firing /api/admin/me
// on every public page load.
function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="login" element={<AdminLogin />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AdminAuthProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Toaster />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin/*" element={<AdminRoutes />} />
            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  )
}
