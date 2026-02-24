import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Sun, Moon, ShieldCheck, Vote } from 'lucide-react'
import { getTheme, toggleTheme } from '../utils/theme.ts'
import { useAdminAuth } from '../context/AdminAuthContext.tsx'
import type { Theme } from '../utils/theme.ts'

export default function Navbar() {
  const [theme, setTheme] = useState<Theme>(() => getTheme())
  const { isAuthenticated } = useAdminAuth()

  const handleToggle = useCallback(() => {
    const next = toggleTheme()
    setTheme(next)
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 transition-colors duration-300">
      <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-3 font-black text-xl tracking-tight select-none group"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/30 group-hover:scale-105 group-hover:shadow-brand-500/40 ring-2 ring-brand-500/20 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950 transition-all duration-300">
            <Vote size={20} strokeWidth={2.5} />
          </div>
          <span className="text-slate-900 dark:text-slate-50 transition-colors">VoteNow</span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark'
              ? <Sun size={18} className="text-slate-400" />
              : <Moon size={18} className="text-slate-500" />
            }
          </button>

          <Link
            to={isAuthenticated ? '/admin/dashboard' : '/admin/login'}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <ShieldCheck size={16} />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
      </nav>
    </header>
  )
}
