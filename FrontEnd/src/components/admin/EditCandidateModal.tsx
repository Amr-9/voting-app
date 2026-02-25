import { createPortal } from 'react-dom'
import { X, Pencil } from 'lucide-react'
import CandidateForm, { type FormValues } from './CandidateForm.tsx'
import type { Candidate } from '../../types/index.ts'

interface EditCandidateModalProps {
  candidate: Candidate | null
  onSubmit: (values: FormValues) => Promise<void>
  onCancel: () => void
  loading: boolean
}

export default function EditCandidateModal({ candidate, onSubmit, onCancel, loading }: EditCandidateModalProps) {
  if (!candidate) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md transition-all duration-300">
      <div className="fixed inset-0" onClick={onCancel} />
      <div className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-slate-800/50 flex flex-col overflow-hidden animate-[modalScale_0.3s_cubic-bezier(0.34,1.4,0.64,1)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800/50">
          <h2 className="font-black text-2xl tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
              <Pencil size={20} strokeWidth={2.5} />
            </div>
            Edit Candidate
          </h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto">
          <CandidateForm
            initial={candidate}
            onSubmit={onSubmit}
            onCancel={onCancel}
            loading={loading}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
