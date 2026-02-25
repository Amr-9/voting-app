import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, KeyRound, Loader, Eye, EyeOff } from 'lucide-react'
import axios from 'axios'
import { adminAPI } from '../../services/api.ts'
import { useToast } from '../../context/ToastContext.tsx'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { toast } = useToast()
  const [pwOld, setPwOld] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [showPwOld, setShowPwOld] = useState(false)
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  const handleClose = useCallback(() => {
    if (pwLoading) return
    setPwOld('')
    setPwNew('')
    setPwConfirm('')
    setShowPwOld(false)
    setShowPwNew(false)
    setShowPwConfirm(false)
    onClose()
  }, [pwLoading, onClose])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwNew.length < 10) {
      toast.error('New password must be at least 10 characters.')
      return
    }
    if (pwNew !== pwConfirm) {
      toast.error('New passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      await adminAPI.changePassword(pwOld, pwNew)
      toast.success('Password changed successfully!')
      handleClose()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to change password.'
        : 'Failed to change password.'
      toast.error(message)
    } finally {
      setPwLoading(false)
    }
  }, [pwOld, pwNew, pwConfirm, toast, handleClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="fixed inset-0" onClick={handleClose} />
      <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-slate-800/50 overflow-hidden animate-[modalScale_0.3s_cubic-bezier(0.34,1.4,0.64,1)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800/50">
          <h2 className="font-black text-2xl tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
              <KeyRound size={20} strokeWidth={2.5} />
            </div>
            Change Password
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={pwLoading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
          {/* Current password */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwOld ? 'text' : 'password'}
                value={pwOld}
                onChange={e => setPwOld(e.target.value)}
                required
                placeholder="Enter current password"
                className="w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 font-medium placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPwOld(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label={showPwOld ? 'Hide password' : 'Show password'}
              >
                {showPwOld ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwNew ? 'text' : 'password'}
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                required
                minLength={10}
                placeholder="Min. 10 characters"
                className="w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 font-medium placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPwNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label={showPwNew ? 'Hide password' : 'Show password'}
              >
                {showPwNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPwConfirm ? 'text' : 'password'}
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                required
                placeholder="Repeat new password"
                className={`w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-slate-950 border rounded-xl focus:outline-none focus:ring-4 transition-all text-slate-900 dark:text-slate-50 font-medium placeholder-slate-400 ${
                  pwConfirm && pwNew !== pwConfirm
                    ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20'
                    : 'border-slate-200 dark:border-slate-800 focus:border-brand-500 focus:ring-brand-500/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPwConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label={showPwConfirm ? 'Hide password' : 'Show password'}
              >
                {showPwConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {pwConfirm && pwNew !== pwConfirm && (
              <p className="text-xs font-semibold text-rose-500 ml-1">Passwords do not match.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={pwLoading}
              className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pwLoading || !pwOld || pwNew.length < 10 || pwNew !== pwConfirm}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pwLoading ? <><Loader size={16} className="animate-spin" /> Saving...</> : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
