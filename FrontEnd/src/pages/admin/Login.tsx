import { useState, useCallback } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { Lock, Mail, Loader, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAdminAuth } from '../../context/AdminAuthContext.tsx'

export default function AdminLogin() {
  const { login, isAuthenticated, loading } = useAdminAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated) return <Navigate to="/admin/dashboard" replace />

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = await login(email, password)
    if (result.success) {
      navigate('/admin/dashboard', { replace: true })
    } else {
      setError(result.message ?? 'Login failed')
    }
  }, [email, password, login, navigate])

  return (
    <div className="page-enter min-h-dvh flex items-center justify-center px-4 relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      {/* Background glow orbs */}
      <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-brand-500/10 dark:bg-brand-500/20 rounded-full blur-[80px] pointer-events-none mix-blend-multiply dark:mix-blend-normal" />
      <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-rose-400/10 dark:bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-6 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to voting
        </Link>

        {/* Card */}
        <div className="rounded-[2.5rem] p-8 sm:p-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-brand-500/10 border border-white/50 dark:border-slate-800/50 relative overflow-hidden">

          {/* Subtle top highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

          {/* Icon + title */}
          <div className="flex flex-col items-center gap-5 mb-10">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-600 shadow-xl shadow-brand-500/30 ring-4 ring-brand-500/10 ring-offset-2 ring-offset-white dark:ring-offset-slate-900">
              <Lock size={28} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 mb-1.5">
                Admin Panel
              </h1>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Sign in to orchestrate the election
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Email */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors pointer-events-none"
                />
                <input
                  type="email"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all font-medium text-slate-900 dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="admin@vote.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                Security Key
              </label>
              <div className="relative group">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors pointer-events-none"
                />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all font-medium text-slate-900 dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-brand-500 transition-colors rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  onClick={() => setShowPass(p => !p)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-500/20 text-sm font-bold animate-[slideUp_200ms_ease-out]">
                <AlertCircle size={18} className="shrink-0" strokeWidth={2.5} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-gradient-to-r hover:from-brand-500 hover:to-brand-600 dark:hover:from-brand-500 dark:hover:to-brand-600 dark:hover:text-white transition-all duration-300 shadow-xl hover:shadow-brand-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ring-2 ring-transparent hover:ring-brand-500/20 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 active:scale-95"
              disabled={loading}
            >
              {loading
                ? <><Loader size={18} className="animate-spin" /> Authenticating...</>
                : 'Enter Control Panel'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
