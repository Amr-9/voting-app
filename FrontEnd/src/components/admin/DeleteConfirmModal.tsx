import { createPortal } from 'react-dom'
import { AlertTriangle, Loader } from 'lucide-react'
import type { Candidate } from '../../types/index.ts'

interface DeleteConfirmModalProps {
  candidate: Candidate | null
  onConfirm: (candidate: Candidate) => void
  onCancel: () => void
  loading: boolean
}

export default function DeleteConfirmModal({ candidate, onConfirm, onCancel, loading }: DeleteConfirmModalProps) {
  if (!candidate) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="fixed inset-0" onClick={() => !loading && onCancel()} />
      <div className="relative w-full max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-800/50 overflow-hidden animate-[modalScale_0.3s_cubic-bezier(0.34,1.4,0.64,1)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />

        <div className="flex flex-col items-center gap-5 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-rose-100 dark:bg-rose-500/10 text-rose-500">
            <AlertTriangle size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-2">Delete Candidate?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              You are about to permanently delete{' '}
              <strong className="text-slate-800 dark:text-slate-200">{candidate.name}</strong>.
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              onClick={() => onConfirm(candidate)}
              disabled={loading}
            >
              {loading ? <><Loader size={16} className="animate-spin" /> Deleting...</> : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
