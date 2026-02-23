import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast } from '../context/ToastContext.tsx'
import type { Toast } from '../types/index.ts'

const ICONS: Record<Toast['type'], React.ReactNode> = {
  success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
  error: <AlertCircle size={18} className="text-rose-500 shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
  info: <Info size={18} className="text-blue-500 shrink-0" />,
}

export default function Toaster() {
  const { toasts, removeToast } = useToast()

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type} flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium shadow-xl shadow-slate-900/5 dark:shadow-none pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800`}
        >
          {ICONS[t.type]}
          <span className="flex-1 text-slate-900 dark:text-slate-50 leading-snug">
            {t.message}
          </span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-1 p-1 shrink-0 transition-colors pointer-events-auto text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-md"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
