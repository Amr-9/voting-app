import { useState, useCallback, useMemo, useEffect } from 'react'
import { Loader, WifiOff, TrendingUp, Lock, Clock } from 'lucide-react'
import Navbar from '../components/Navbar.tsx'
import CandidateCard from '../components/CandidateCard.tsx'
import VoteModal from '../components/VoteModal.tsx'
import { useWebSocket } from '../hooks/useWebSocket.ts'
import type { Candidate } from '../types/index.ts'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8071'
const WS_URL = API_BASE.replace(/^http(s)?/, 'ws$1') + '/ws'

// ---- Countdown helper ----
function useCountdown(endsAt: string | null): string | null {
  const [remaining, setRemaining] = useState<string | null>(null)

  useEffect(() => {
    if (!endsAt) { setRemaining(null); return }

    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining(null); return }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24))
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const m = Math.floor((diff / (1000 * 60)) % 60)
      const s = Math.floor((diff / 1000) % 60)

      let res = ''
      if (d > 0) {
        res = `${d}d ${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
      } else if (h > 0) {
        res = `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
      } else {
        res = `${m}m ${s.toString().padStart(2, '0')}s`
      }
      setRemaining(res)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return remaining
}

export default function Home() {
  const { candidates, votingStatus, status } = useWebSocket(WS_URL)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [votedCandidateId, setVotedCandidateId] = useState<number | null>(() => {
    const stored = localStorage.getItem('voted_candidate_id')
    return stored ? Number(stored) : null
  })

  // endsAt from the server snapshot / live broadcast
  const endsAt: string | null = votingStatus?.ends_at ?? null
  const countdown = useCountdown(endsAt)

  // votingOpen is derived locally so it reacts the instant ends_at passes.
  // `countdown` is in the dependency array — it changes every second, so the moment
  // it flips to null (time elapsed) the memo re-runs and votingOpen becomes false
  // immediately, without waiting for a server broadcast or a page refresh.
  const votingOpen: boolean | null = useMemo(() => {
    if (!votingStatus) return null                          // not yet connected
    if (!votingStatus.effectively_open) return false       // admin closed manually
    if (endsAt && new Date(endsAt).getTime() <= Date.now()) return false  // local expiry
    return true
  }, [votingStatus, endsAt, countdown])                    // countdown drives the 1-s re-check


  const totalVotes = useMemo(
    () => candidates.reduce((sum, c) => sum + c.total_votes, 0),
    [candidates],
  )

  const handleVote = useCallback((candidate: Candidate) => {
    if (!votingOpen) return
    setSelectedCandidate(candidate)
  }, [votingOpen])

  const handleCloseModal = useCallback(() => {
    setSelectedCandidate(null)
    // Sync voted state from localStorage in case the user just voted inside the modal
    const stored = localStorage.getItem('voted_candidate_id')
    setVotedCandidateId(stored ? Number(stored) : null)
  }, [])

  return (
    <div className="page-enter">
      <Navbar />

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden pt-24 pb-20 px-4 text-center">
        {/* Glow orbs matching modern premium aesthetics */}
        <div className="absolute top-[-250px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-500/20 dark:bg-brand-500/15 rounded-full blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-normal" />
        <div className="absolute top-[10%] left-[-10%] w-[500px] h-[500px] bg-rose-400/15 dark:bg-rose-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[0%] right-[-5%] w-[600px] h-[600px] bg-indigo-400/15 dark:bg-indigo-500/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          {/* Live / Reconnecting badge */}
          <div className="flex justify-center mb-8">
            {status === 'connected' ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 backdrop-blur-md shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse ring-4 ring-emerald-500/30" />
                Live Results
              </div>
            ) : status === 'connecting' ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-4 ring-amber-500/30" />
                Connecting...
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                <WifiOff size={14} />
                Reconnecting...
              </div>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl xl:text-8xl font-black tracking-tighter leading-[1.15] mb-6 text-slate-900 dark:text-white drop-shadow-sm w-full text-center overflow-visible">
            Cast Your{' '}
            <span className="inline-block text-transparent bg-clip-text bg-gradient-to-br from-brand-500 via-brand-400 to-rose-400 pb-3 pr-2">
              Vote
            </span>
          </h1>



          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Make your voice heard. Our platform updates live instantly for all viewers, giving you the real-time pulse of the election.
          </p>

          {/* ---- Voting status banner ---- */}
          {votingOpen === false && (
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-2xl mb-6 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 backdrop-blur-sm shadow-sm font-semibold text-sm animate-[fadeIn_0.4s_ease]">
              <Lock size={16} className="shrink-0" />
              Voting is currently closed
            </div>
          )}

          {votingOpen === true && endsAt && countdown && (
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-2xl mb-6 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 backdrop-blur-sm shadow-sm font-semibold text-sm animate-[fadeIn_0.4s_ease]">
              <Clock size={16} className="shrink-0" />
              Voting closes in&nbsp;<span className="font-black tabular-nums">{countdown}</span>
            </div>
          )}

          {/* Stats row */}
          {totalVotes > 0 && (
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25">
                <TrendingUp size={16} />
                {totalVotes.toLocaleString()} total votes
              </div>
              <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-sm">
                {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---- Divider line ---- */}
      <div className="w-full h-px max-w-7xl mx-auto bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent" />

      {/* ---- Content ---- */}
      <main className="max-w-7xl mx-auto px-5 py-12 pb-24 relative z-10">
        {status === 'connecting' && candidates.length === 0 ? (
          /* Initial loading */
          <div className="flex flex-col items-center justify-center gap-5 py-32">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center bg-white dark:bg-slate-900 shadow-xl shadow-brand-500/10 border border-slate-200 dark:border-slate-800">
              <Loader size={32} className="animate-spin text-brand-500" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading candidates...</p>
          </div>

        ) : candidates.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 text-5xl">
              🗳️
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-50">
                No candidates yet
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                The administration hasn&apos;t added any candidates to the election. Check back soon!
              </p>
            </div>
          </div>

        ) : (
          /* Candidates grid — grayed out when voting is closed */
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 transition-opacity duration-500 ${votingOpen === false ? 'opacity-50 pointer-events-none select-none' : ''}`}>
            {candidates.map((candidate, index) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                rank={index + 1}
                onVote={handleVote}
                votedCandidateId={votedCandidateId}
              />
            ))}
          </div>
        )}

        {/* "Voting closed" overlay hint below the grid */}
        {votingOpen === false && candidates.length > 0 && (
          <p className="text-center mt-8 text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
            <Lock size={14} />
            Voting is closed — results are displayed above for reference
          </p>
        )}
      </main>

      {selectedCandidate && votingOpen && (
        <VoteModal candidate={selectedCandidate} onClose={handleCloseModal} />
      )}
    </div>
  )
}
