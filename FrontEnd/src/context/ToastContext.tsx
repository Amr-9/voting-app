import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Toast } from '../types/index.ts'

interface ToastContextValue {
  toasts: Toast[]
  removeToast: (id: string) => void
  toast: {
    success: (msg: string, duration?: number) => void
    error:   (msg: string, duration?: number) => void
    warning: (msg: string, duration?: number) => void
    info:    (msg: string, duration?: number) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 4000) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-4), { id, message, type }])
    setTimeout(() => removeToast(id), duration)
  }, [removeToast])

  const toast = useMemo(() => ({
    success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
    error:   (msg: string, dur?: number) => addToast(msg, 'error',   dur),
    warning: (msg: string, dur?: number) => addToast(msg, 'warning', dur),
    info:    (msg: string, dur?: number) => addToast(msg, 'info',    dur),
  }), [addToast])

  const value = useMemo(() => ({ toasts, toast, removeToast }), [toasts, toast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
