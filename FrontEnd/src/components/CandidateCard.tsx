import { useCallback } from 'react'
import { User, CheckCircle2, CheckCheck, Trophy, Medal, Award, type LucideIcon } from 'lucide-react'
import { getImageUrl } from '../utils/imageUrl.ts'
import type { Candidate } from '../types/index.ts'

interface Props {
  candidate: Candidate
  rank: number
  onVote: (candidate: Candidate) => void
  votedCandidateId?: number | null
}

const RANK_CONFIG: Record<number, { icon: LucideIcon; bg: string; border: string }> = {
  1: { icon: Trophy, bg: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600', border: 'border-yellow-200/40 text-yellow-50' },
  2: { icon: Medal, bg: 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500', border: 'border-slate-100/50 text-slate-50' },
  3: { icon: Award, bg: 'bg-gradient-to-br from-orange-400 via-rose-400 to-rose-600', border: 'border-orange-200/40 text-orange-50' },
}

export default function CandidateCard({ candidate, rank, onVote, votedCandidateId }: Props) {
  const imageUrl = getImageUrl(candidate.image_path)
  const isLeader = rank === 1 && candidate.total_votes > 0
  const hasVoted = votedCandidateId != null
  const votedForThis = votedCandidateId === candidate.id

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
      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/50 overflow-hidden rounded-t-[2rem]">
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
        {rank <= 3 && candidate.total_votes > 0 && (() => {
          const config = RANK_CONFIG[rank];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <div className="absolute top-4 right-4 z-20 w-12 h-12 group/badge">
              <div className={`absolute inset-0 rounded-full blur-md opacity-40 transition-opacity duration-300 group-hover/badge:opacity-70 ${config.bg}`} />
              <div className={`
                relative w-full h-full rounded-full flex items-center justify-center 
                shadow-xl border-2 transform transition-all duration-500 ease-out
                group-hover/badge:scale-110 group-hover/badge:-rotate-6
                ${config.bg} ${config.border}
              `}>
                <Icon size={22} strokeWidth={2.5} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-5 pb-5 pt-3 z-20">
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
        {votedForThis ? (
          <div className="mt-8 w-full py-4 px-5 rounded-2xl flex items-center justify-center gap-2.5 font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCheck size={20} strokeWidth={2.5} />
            You Voted
          </div>
        ) : hasVoted ? (
          <div className="mt-8 w-full py-4 px-5 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none">
            <CheckCircle2 size={20} strokeWidth={2.5} />
            Already Voted
          </div>
        ) : (
          <button
            onClick={handleVote}
            className="mt-8 w-full py-4 px-5 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-gradient-to-r hover:from-brand-500 hover:to-brand-600 dark:hover:from-brand-500 dark:hover:to-brand-600 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-brand-500/25 hover:-translate-y-1 ring-2 ring-transparent hover:ring-brand-500/20 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 active:scale-95"
          >
            <CheckCircle2 size={20} strokeWidth={2.5} />
            Vote for {candidate.name.split(' ')[0]}
          </button>
        )}
      </div>
    </article>
  )
}
