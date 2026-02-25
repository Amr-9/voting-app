import { useState, useCallback, useEffect } from 'react'
import { Loader, Globe, Plus, X } from 'lucide-react'
import axios from 'axios'
import { adminAPI } from '../../services/api.ts'
import { useToast } from '../../context/ToastContext.tsx'
import type { CustomDomain } from '../../types/index.ts'

export default function EmailDomainsCard() {
  const { toast } = useToast()
  const [domains, setDomains] = useState<CustomDomain[]>([])
  const [domainsLoading, setDomainsLoading] = useState(true)
  const [newDomain, setNewDomain] = useState('')
  const [domainAddLoading, setDomainAddLoading] = useState(false)
  const [domainDeleteLoadingId, setDomainDeleteLoadingId] = useState<number | null>(null)

  const fetchDomains = useCallback(async () => {
    try {
      const list = await adminAPI.listDomains()
      setDomains(list)
    } catch {
      toast.error('Failed to load custom domains.')
    } finally {
      setDomainsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchDomains()
  }, [fetchDomains])

  const handleAddDomain = useCallback(async () => {
    const domain = newDomain.trim()
    if (!domain) return
    setDomainAddLoading(true)
    try {
      await adminAPI.addDomain(domain)
      setNewDomain('')
      toast.success(`Domain "${domain}" added successfully.`)
      await fetchDomains()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to add domain.'
        : 'Failed to add domain.'
      toast.error(message)
    } finally {
      setDomainAddLoading(false)
    }
  }, [newDomain, fetchDomains, toast])

  const handleDeleteDomain = useCallback(async (domain: CustomDomain) => {
    setDomainDeleteLoadingId(domain.id)
    try {
      await adminAPI.deleteDomain(domain.id)
      toast.success(`Domain "${domain.domain}" removed.`)
      await fetchDomains()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to remove domain.'
        : 'Failed to remove domain.'
      toast.error(message)
    } finally {
      setDomainDeleteLoadingId(null)
    }
  }, [fetchDomains, toast])

  return (
    <div className="relative z-20 mb-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl shadow-brand-500/5">
      <h2 className="text-xl font-black tracking-tight mb-2 flex items-center gap-3 text-slate-900 dark:text-slate-50">
        <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
          <Globe size={22} strokeWidth={2.5} />
        </div>
        Allowed Email Domains
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6">
        Custom domains added here (e.g.{' '}
        <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 text-xs font-mono">myuniversity.edu.eg</code>
        ) will be allowed to receive OTPs, in addition to the 94 built-in providers.
      </p>

      {/* Add domain input */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={newDomain}
          onChange={e => setNewDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !domainAddLoading && handleAddDomain()}
          placeholder="example.edu.eg"
          className="flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 font-medium font-mono placeholder-slate-400"
        />
        <button
          type="button"
          onClick={handleAddDomain}
          disabled={domainAddLoading || !newDomain.trim()}
          className="px-6 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
        >
          {domainAddLoading
            ? <><Loader size={16} className="animate-spin" /> Adding...</>
            : <><Plus size={16} /> Add Domain</>}
        </button>
      </div>

      {/* Domain list */}
      {domainsLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader size={16} className="animate-spin" /> Loading domains...
        </div>
      ) : domains.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600">
          <Globe size={28} strokeWidth={1.5} className="opacity-50" />
          <div className="text-center">
            <p className="text-sm font-bold">No custom domains added yet</p>
            <p className="text-xs mt-1">Only the 94 built-in email providers are currently allowed.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {domains.map(d => (
            <div
              key={d.id}
              className="flex items-center gap-2 pl-3.5 pr-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-rose-500/30 hover:bg-rose-50/50 dark:hover:bg-rose-500/5 transition-all group"
            >
              <Globe size={13} className="text-brand-500 shrink-0" />
              <span className="font-mono text-xs">{d.domain}</span>
              <button
                type="button"
                onClick={() => handleDeleteDomain(d)}
                disabled={domainDeleteLoadingId === d.id}
                className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/10 transition-all disabled:opacity-50"
                aria-label={`Remove ${d.domain}`}
              >
                {domainDeleteLoadingId === d.id
                  ? <Loader size={11} className="animate-spin" />
                  : <X size={11} strokeWidth={2.5} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
