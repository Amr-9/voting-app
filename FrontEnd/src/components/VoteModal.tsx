import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { X, Mail, CheckCircle, AlertCircle, Loader, RotateCcw } from 'lucide-react'
import { voteAPI } from '../services/api.ts'
import { useFingerprint } from '../hooks/useFingerprint.ts'
import { useToast } from '../context/ToastContext.tsx'
import { getImageUrl } from '../utils/imageUrl.ts'
import { getTheme } from '../utils/theme.ts'
import type { Candidate } from '../types/index.ts'
import axios from 'axios'

const STEP = { EMAIL: 1, OTP: 2, DONE: 3 } as const
type Step = (typeof STEP)[keyof typeof STEP]

interface Props {
  candidate: Candidate
  onClose: () => void
}

export default function VoteModal({ candidate, onClose }: Props) {
  const fingerprint = useFingerprint()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>(STEP.EMAIL)
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState('')
  const [isAlreadyVoted, setIsAlreadyVoted] = useState(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const turnstileRef = useRef<TurnstileInstance>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Auto-submit when all 6 digits filled
  const allFilled = otp.every(d => d !== '')
  const submittedRef = useRef(false)

  useEffect(() => {
    if (allFilled && step === STEP.OTP && !loading && !submittedRef.current) {
      submittedRef.current = true
      handleVerifyOtp()
    }
    if (!allFilled) submittedRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilled, step, loading])

  // ---- Step 1: Request OTP ----
  const handleRequestOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!captchaToken) { setError('Please complete the captcha.'); return }
    if (!fingerprint) { setError('Fingerprint not ready. Please wait a moment.'); return }

    setLoading(true)
    setError(null)

    try {
      await voteAPI.requestOTP(email, fingerprint, captchaToken, candidate.id)
      setStep(STEP.OTP)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to send OTP. Please try again.'
        : 'Failed to send OTP. Please try again.'
      setError(msg)
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setLoading(false)
    }
  }, [email, fingerprint, captchaToken, candidate.id])

  // ---- Step 2: Verify OTP ----
  const handleVerifyOtp = useCallback(async () => {
    const otpStr = otp.join('')
    if (otpStr.length !== 6) return

    setLoading(true)
    setError(null)

    try {
      await voteAPI.verify(email, otpStr)
      setDoneMessage('Your vote has been recorded! Thank you for participating.')
      setStep(STEP.DONE)
      toast.success('Vote recorded successfully!')
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Verification failed.'
        : 'Verification failed.'

      if (status === 409) {
        setIsAlreadyVoted(true)
        setDoneMessage('You have already cast your vote in this election.')
        setStep(STEP.DONE)
      } else if (status === 422) {
        setError('Invalid or expired OTP. Please request a new code.')
        setOtp(['', '', '', '', '', ''])
        setTimeout(() => otpRefs.current[0]?.focus(), 50)
      } else {
        setError(message)
        setOtp(['', '', '', '', '', ''])
      }
    } finally {
      setLoading(false)
    }
  }, [email, otp, toast])

  // ---- OTP input handlers ----
  const handleOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }, [otp])

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }, [otp])

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (paste.length === 6) {
      setOtp(paste.split(''))
    }
  }, [])

  const goBackToEmail = useCallback(() => {
    setStep(STEP.EMAIL)
    setOtp(['', '', '', '', '', ''])
    setError(null)
    setCaptchaToken(null)
    turnstileRef.current?.reset()
  }, [])

  const imageUrl = getImageUrl(candidate.image_path)
  const turnstileTheme = getTheme() === 'light' ? 'light' : 'dark'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={`Vote for ${candidate.name}`}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-[slideUp_280ms_cubic-bezier(0.34,1.4,0.64,1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <h2 className="font-bold text-base text-slate-900 dark:text-slate-50">
            {step === STEP.DONE
              ? isAlreadyVoted ? '⚠️ Already Voted' : '✅ Vote Recorded'
              : `Vote for ${candidate.name}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-50 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-6">

          {/* Candidate preview */}
          {step !== STEP.DONE && (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-xl shadow-inner">
                {imageUrl
                  ? <img src={imageUrl} alt={candidate.name} className="w-full h-full object-cover" />
                  : '👤'
                }
              </div>
              <div className="flex flex-col">
                <p className="font-bold text-base text-slate-900 dark:text-slate-50 leading-tight">
                  {candidate.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Selected candidate
                </p>
              </div>
            </div>
          )}

          {/* ---- Step 1: Email + Turnstile ---- */}
          {step === STEP.EMAIL && (
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Your email address
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="email"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-50 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all font-medium"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-1">
                  A 6-digit verification code will be sent here.
                </p>
              </div>

              {/* Cloudflare Turnstile */}
              <div className="flex justify-center my-1">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={import.meta.env.VITE_CF_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                  options={{ theme: turnstileTheme }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-sm font-medium">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-md flex items-center justify-center gap-2"
                disabled={loading || !captchaToken || !email || !fingerprint}
              >
                {loading
                  ? <><Loader size={18} className="animate-spin" /> Verifying...</>
                  : 'Send Verification Code'
                }
              </button>
            </form>
          )}

          {/* ---- Step 2: OTP input ---- */}
          {step === STEP.OTP && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter the 6-digit code sent to<br />
                  <strong className="text-slate-900 dark:text-slate-50 font-bold">{email}</strong>
                </p>
              </div>

              {/* 6 OTP cells */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    className={`w-12 h-14 text-center text-2xl font-black rounded-xl border bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 caret-brand-500 ${digit
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 shadow-inner'
                      : 'border-slate-300 dark:border-slate-700'
                      }`}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    disabled={loading}
                    aria-label={`OTP digit ${i + 1}`}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              {loading && (
                <div className="flex justify-center">
                  <Loader size={24} className="animate-spin text-brand-500" />
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-rose-500">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                className="flex items-center gap-1.5 text-sm mx-auto font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-50 transition-colors"
                onClick={goBackToEmail}
              >
                <RotateCcw size={14} />
                Didn't receive code? Resend
              </button>
            </div>
          )}

          {/* ---- Step 3: Done ---- */}
          {step === STEP.DONE && (
            <div className="flex flex-col items-center gap-5 py-8 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isAlreadyVoted ? 'bg-amber-100 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400'
                }`}>
                {isAlreadyVoted
                  ? <AlertCircle size={40} />
                  : <CheckCircle size={40} />
                }
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-50 max-w-sm px-4">
                {doneMessage}
              </p>
              <button
                className="mt-4 w-full py-3.5 rounded-xl font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                onClick={onClose}
              >
                Return to Election
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
