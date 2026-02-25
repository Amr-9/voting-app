import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, LogOut, ImageIcon, Users, KeyRound } from 'lucide-react'
import { candidateAPI, adminAPI } from '../../services/api.ts'
import { useAdminAuth } from '../../context/AdminAuthContext.tsx'
import { useToast } from '../../context/ToastContext.tsx'
import { getImageUrl } from '../../utils/imageUrl.ts'
import Navbar from '../../components/Navbar.tsx'
import LoadingSpinner from '../../components/LoadingSpinner.tsx'
import CandidateForm, { type FormValues } from '../../components/admin/CandidateForm.tsx'
import VotingControlCard from '../../components/admin/VotingControlCard.tsx'
import EmailDomainsCard from '../../components/admin/EmailDomainsCard.tsx'
import ChangePasswordModal from '../../components/admin/ChangePasswordModal.tsx'
import DeleteConfirmModal from '../../components/admin/DeleteConfirmModal.tsx'
import EditCandidateModal from '../../components/admin/EditCandidateModal.tsx'
import type { Candidate } from '../../types/index.ts'
import axios from 'axios'

export default function AdminDashboard() {
  const { logout } = useAdminAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [editTarget, setEditTarget] = useState<Candidate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)

  const fetchCandidates = useCallback(async () => {
    try {
      const list = await candidateAPI.getAll()
      setCandidates(list)
    } catch {
      toast.error('Failed to load candidates.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  const handleAdd = useCallback(async ({ name, description, imageFile }: FormValues) => {
    setFormLoading(true)
    try {
      await adminAPI.addCandidate(name, description, imageFile)
      toast.success('Candidate added successfully!')
      await fetchCandidates()
      return Promise.resolve()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to add candidate.'
        : 'Failed to add candidate.'
      toast.error(message)
      return Promise.reject(err)
    } finally {
      setFormLoading(false)
    }
  }, [fetchCandidates, toast])

  const handleUpdate = useCallback(async ({ name, description, imageFile }: FormValues) => {
    if (!editTarget) return Promise.reject(new Error('No target'))
    setFormLoading(true)
    try {
      await adminAPI.updateCandidate(editTarget.id, name, description, imageFile)
      toast.success('Candidate updated successfully!')
      setEditTarget(null)
      await fetchCandidates()
      return Promise.resolve()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to update candidate.'
        : 'Failed to update candidate.'
      toast.error(message)
      return Promise.reject(err)
    } finally {
      setFormLoading(false)
    }
  }, [editTarget, fetchCandidates, toast])

  const handleDelete = useCallback(async (candidate: Candidate) => {
    setDeleteLoading(true)
    try {
      await adminAPI.deleteCandidate(candidate.id)
      toast.success(`"${candidate.name}" deleted successfully.`)
      setDeleteTarget(null)
      await fetchCandidates()
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to delete candidate.'
        : 'Failed to delete candidate.'
      if (status === 409) {
        toast.error('Cannot delete: this candidate already has votes.')
      } else {
        toast.error(message)
      }
    } finally {
      setDeleteLoading(false)
    }
  }, [fetchCandidates, toast])

  const handleLogout = useCallback(() => {
    logout()
    navigate('/admin/login', { replace: true })
  }, [logout, navigate])

  const totalVotes = candidates.reduce((sum, c) => sum + c.total_votes, 0)

  return (
    <div className="page-enter min-h-dvh relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      {/* Background glow orbs */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-[100px] pointer-events-none mix-blend-multiply dark:mix-blend-normal z-0" />
      <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col min-h-dvh">
        <Navbar />

        <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-12 pb-24">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-50 mb-2">
                Control Panel
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-semibold text-lg max-w-xl">
                Add, edit, and orchestrate election candidates in real-time
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-200 dark:hover:border-brand-500/20 transition-all active:scale-95"
                onClick={() => setChangePwOpen(true)}
                title="Change Password"
              >
                <KeyRound size={18} />
                <span className="hidden sm:inline">Change Password</span>
              </button>
              <button
                className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/20 transition-all active:scale-95 group"
                onClick={handleLogout}
              >
                <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline">Secure Logout</span>
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl shadow-brand-500/5 flex items-center gap-6 transition-transform duration-500 hover:-translate-y-2 group">
              <div className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                <Users size={28} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-slate-50 leading-none mb-1">
                  {candidates.length}
                </p>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Candidates</p>
              </div>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl shadow-emerald-500/5 flex items-center gap-6 transition-transform duration-500 hover:-translate-y-2 group">
              <div className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 text-3xl">
                🗳️
              </div>
              <div>
                <p className="text-4xl font-black tracking-tighter text-slate-900 dark:text-slate-50 leading-none mb-1">
                  {totalVotes.toLocaleString()}
                </p>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Votes</p>
              </div>
            </div>
          </div>

          <VotingControlCard />

          <EmailDomainsCard />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Candidate list — 2/3 */}
            <section className="lg:col-span-2">
              <h2 className="text-2xl font-black mb-6 text-slate-900 dark:text-slate-50 tracking-tight">
                Current Roster
              </h2>

              {loading ? (
                <div className="flex justify-center py-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50">
                  <LoadingSpinner size={36} className="text-brand-500" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-24 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 shadow-sm flex flex-col items-center gap-5 text-slate-500 dark:text-slate-400">
                  <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-950 shadow-inner flex items-center justify-center border border-slate-200 dark:border-slate-800">
                    <Users size={36} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-50 text-xl tracking-tight">No candidates added yet</p>
                    <p className="text-sm mt-1 font-medium">Use the form to the right to add your first candidate.</p>
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-5">
                  {candidates.map(c => {
                    const imgUrl = getImageUrl(c.image_path)
                    return (
                      <li key={c.id} className="bg-white dark:bg-slate-900/80 backdrop-blur-sm rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-5 p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/10 hover:border-brand-500/30 hover:-translate-y-1 group">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 rounded-[1.25rem] overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 shadow-inner ring-1 ring-slate-200/50 dark:ring-slate-700/50">
                          {imgUrl
                            ? <img src={imgUrl} alt={c.name} className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500 ease-out" />
                            : <ImageIcon size={28} className="text-slate-400" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="font-black text-xl tracking-tight text-slate-900 dark:text-slate-50 truncate group-hover:text-brand-500 transition-colors">
                            {c.name}
                          </p>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mt-1">
                            {c.description || 'No description provided.'}
                          </p>
                          <div className="mt-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                              {c.total_votes.toLocaleString()} votes
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {c.total_votes === 0 ? (
                            <button
                              className="p-4 rounded-2xl bg-slate-50 hover:bg-rose-50 dark:bg-slate-950 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 hover:ring-rose-500/30"
                              onClick={() => setDeleteTarget(c)}
                              aria-label={`Delete ${c.name}`}
                            >
                              <Trash2 size={20} strokeWidth={2.5} />
                            </button>
                          ) : (
                            <button
                              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-300 dark:text-slate-700 cursor-not-allowed shadow-sm ring-1 ring-slate-200 dark:ring-slate-800"
                              title="Cannot delete: candidate has votes"
                              disabled
                            >
                              <Trash2 size={20} strokeWidth={2.5} />
                            </button>
                          )}
                          <button
                            className="p-4 rounded-2xl bg-slate-50 hover:bg-brand-50 dark:bg-slate-950 dark:hover:bg-brand-500/10 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 hover:ring-brand-500/30"
                            onClick={() => setEditTarget(c)}
                            aria-label={`Edit ${c.name}`}
                          >
                            <Pencil size={20} strokeWidth={2.5} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Add form — 1/3 */}
            <aside>
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl shadow-brand-500/5 sticky top-28">
                <h2 className="text-2xl font-black tracking-tight mb-8 flex items-center gap-3 text-slate-900 dark:text-slate-50">
                  <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
                    <Plus size={24} strokeWidth={2.5} />
                  </div>
                  Add Candidate
                </h2>
                <CandidateForm onSubmit={handleAdd} loading={formLoading} />
              </div>
            </aside>
          </div>
        </main>
      </div>

      <EditCandidateModal
        candidate={editTarget}
        onSubmit={handleUpdate}
        onCancel={() => setEditTarget(null)}
        loading={formLoading}
      />

      <ChangePasswordModal
        isOpen={changePwOpen}
        onClose={() => setChangePwOpen(false)}
      />

      <DeleteConfirmModal
        candidate={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  )
}
