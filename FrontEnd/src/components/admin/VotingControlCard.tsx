import { useState, useCallback, useEffect } from 'react'
import { Loader, ShieldCheck, ShieldOff, Clock } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { votingAPI, adminAPI } from '../../services/api.ts'
import { useToast } from '../../context/ToastContext.tsx'

export default function VotingControlCard() {
  const { toast } = useToast()
  const [votingOpen, setVotingOpen] = useState(true)
  const [endsAtDate, setEndsAtDate] = useState<Date | null>(null)
  const [votingLoading, setVotingLoading] = useState(false)
  const [votingSettingsLoading, setVotingSettingsLoading] = useState(true)

  useEffect(() => {
    votingAPI.getStatus()
      .then((s) => {
        setVotingOpen(s.is_open)
        if (s.ends_at) setEndsAtDate(new Date(s.ends_at))
      })
      .catch(() => {/* keep defaults */})
      .finally(() => setVotingSettingsLoading(false))
  }, [])

  const handleSave = useCallback(async () => {
    setVotingLoading(true)
    try {
      const endsAtUtc = endsAtDate ? endsAtDate.toISOString() : null
      await adminAPI.updateVotingSettings(votingOpen, endsAtUtc)
      toast.success('Voting settings saved successfully!')
    } catch {
      toast.error('Failed to save voting settings.')
    } finally {
      setVotingLoading(false)
    }
  }, [votingOpen, endsAtDate, toast])

  return (
    <div className="relative z-20 mb-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl shadow-brand-500/5">
      <h2 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3 text-slate-900 dark:text-slate-50">
        <div className={`p-2 rounded-xl ${votingOpen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {votingOpen ? <ShieldCheck size={22} strokeWidth={2.5} /> : <ShieldOff size={22} strokeWidth={2.5} />}
        </div>
        Voting Control
      </h2>

      {votingSettingsLoading ? (
        <div className="flex items-center gap-2 text-slate-500"><Loader size={18} className="animate-spin" /> Loading settings...</div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-end gap-6">
          {/* Toggle */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Voting Status</p>
            <button
              type="button"
              onClick={() => setVotingOpen(v => !v)}
              className={`relative inline-flex h-8 w-[3.75rem] items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-4 ${votingOpen
                ? 'bg-emerald-500 focus:ring-emerald-500/30'
                : 'bg-rose-400 focus:ring-rose-400/30'
              }`}
              aria-label="Toggle voting"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${votingOpen ? 'translate-x-8' : 'translate-x-1'}`}
              />
            </button>
            <p className={`text-xs font-bold ${votingOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {votingOpen ? 'Open — accepting votes' : 'Closed — votes blocked'}
            </p>
          </div>

          {/* Auto-stop datetime */}
          <div className="flex flex-col gap-2 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Clock size={12} /> Auto-stop date &amp; time
              <span className="normal-case font-normal text-slate-400">(your local timezone)</span>
            </p>
            <div className="relative w-full max-w-xs">
              <DatePicker
                selected={endsAtDate}
                onChange={(date: Date | null) => setEndsAtDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="MMMM d, yyyy h:mm aa"
                placeholderText="Select date and time"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 font-medium text-sm"
              />
            </div>
            {endsAtDate && (
              <button
                type="button"
                onClick={() => setEndsAtDate(null)}
                className="self-start text-xs text-slate-400 hover:text-rose-500 transition-colors font-medium mt-1"
              >
                ✕ Clear auto-stop
              </button>
            )}
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={votingLoading}
            className="self-end px-7 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            {votingLoading ? <><Loader size={16} className="animate-spin" /> Saving...</> : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}
