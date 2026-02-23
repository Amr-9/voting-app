import { useCallback } from 'react'
import { User, CheckCircle2 } from 'lucide-react'
import { getImageUrl } from '../utils/imageUrl.ts'
import type { Candidate } from '../types/index.ts'

interface Props {
  candidate: Candidate
  rank: number
  onVote: (candidate: Candidate) => void
}

const RANK_CONFIG: Record<number, { label: string; bg: string }> = {
  1: { label: '🥇', bg: 'bg-gradient-to-br from-amber-400 to-amber-600' },
  2: { label: '🥈', bg: 'bg-gradient-to-br from-slate-300 to-slate-500' },
  3: { label: '🥉', bg: 'bg-gradient-to-br from-orange-400 to-orange-700' },
}

export default function CandidateCard({ candidate, rank, onVote }: Props) {
  const imageUrl = getImageUrl(candidate.image_path)
  const isLeader = rank === 1 && candidate.total_votes > 0

  const handleVote = useCallback(() => {
    onVote(candidate)
  }, [candidate, onVote])

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[2rem] bg-white dark:bg-slate-900/80 backdrop-blur-sm border transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-brand-500/20 hover:border-brand-500/30 ${isLeader
        ? 'border-brand-500/50 shadow-lg shadow-brand-500/10'
        : 'border-slate-200/50 dark:border-slate-800/50 shadow-sm'
        }`}
    >
      {/* Image Container */}
      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={candidate.name}
              className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            <User size={64} className="text-slate-300 dark:text-slate-700" />
          </div>
        )}

        {/* Rank Badge */}
        {rank <= 3 && candidate.total_votes > 0 && (
          <div className={`absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-xl shadow-2xl backdrop-blur-md text-white border border-white/20 transform transition-transform group-hover:scale-110 group-hover:rotate-12 ${RANK_CONFIG[rank]?.bg}`}>
            {RANK_CONFIG[rank]?.label}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-7 pt-6 z-20">
        <div className="flex-1">
          <h3 className="font-black text-2xl tracking-tight leading-tight text-slate-900 dark:text-slate-50 mb-2">
            {candidate.name}
          </h3>
          {candidate.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-medium">
              {candidate.description}
            </p>
          )}
        </div>

        <div className="mt-8">
          {/* Vote Stats Header - Magnified */}
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-brand-600 to-brand-400 drop-shadow-sm">
              {candidate.total_votes.toLocaleString()}
            </span>
            <span className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
              Votes
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleVote}
          className="mt-8 w-full py-4 px-5 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-gradient-to-r hover:from-brand-500 hover:to-brand-600 dark:hover:from-brand-500 dark:hover:to-brand-600 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-brand-500/25 hover:-translate-y-1 ring-2 ring-transparent hover:ring-brand-500/20 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 active:scale-95"
        >
          <CheckCircle2 size={20} strokeWidth={2.5} />
          Vote for {candidate.name.split(' ')[0]}
        </button>
      </div>
    </article>
  )
}
