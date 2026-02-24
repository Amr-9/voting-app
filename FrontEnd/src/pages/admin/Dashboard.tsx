import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, LogOut, Loader, Upload, X, ImageIcon, Users, ShieldCheck, ShieldOff, Clock, AlertTriangle, KeyRound, Eye, EyeOff } from 'lucide-react'
import { candidateAPI, adminAPI, votingAPI } from '../../services/api.ts'
import { useAdminAuth } from '../../context/AdminAuthContext.tsx'
import { useToast } from '../../context/ToastContext.tsx'
import { getImageUrl } from '../../utils/imageUrl.ts'
import Navbar from '../../components/Navbar.tsx'
import LoadingSpinner from '../../components/LoadingSpinner.tsx'
import type { Candidate } from '../../types/index.ts'
import axios from 'axios'
import Cropper, { Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
// ---- Helper to get cropped image ----
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (err) => reject(err))
    img.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'))
        return
      }
      resolve(new File([blob], 'cropped.jpg', { type: 'image/jpeg', lastModified: Date.now() }))
    }, 'image/jpeg', 0.95)
  })
}

// ---- Candidate form (shared for add + edit) ----
interface FormValues {
  name: string
  description: string
  imageFile: File | null
}

interface CandidateFormProps {
  initial?: Candidate
  onSubmit: (values: FormValues) => Promise<void>
  onCancel?: () => void
  loading: boolean
}

function CandidateForm({ initial, onSubmit, onCancel, loading }: CandidateFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDesc] = useState(initial?.description ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(
    initial ? getImageUrl(initial.image_path) : null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cropper state
  const [isCropping, setIsCropping] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setCropImageSrc(reader.result?.toString() || null)
      setIsCropping(true)
    })
    reader.readAsDataURL(file)
    // Clear input so selecting same file triggers change repeatedly if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const onCropComplete = useCallback((_croppedArea: Area, _croppedAreaPixels: Area) => {
    setCroppedAreaPixels(_croppedAreaPixels)
  }, [])

  const handleCropSave = useCallback(async () => {
    if (!cropImageSrc || !croppedAreaPixels) return
    try {
      const croppedFile = await getCroppedImg(cropImageSrc, croppedAreaPixels)
      setImageFile(croppedFile)
      setPreview(URL.createObjectURL(croppedFile))
      setIsCropping(false)
      setCropImageSrc(null)
    } catch (e) {
      console.error(e)
    }
  }, [cropImageSrc, croppedAreaPixels])

  const handleCropCancel = useCallback(() => {
    setIsCropping(false)
    setCropImageSrc(null)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), imageFile })
      // Clear form on success if this is the "Add" form
      if (!initial) {
        setName('')
        setDesc('')
        setImageFile(null)
        setPreview(null)
        setIsCropping(false)
        setCropImageSrc(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch {
      // Parent component handles errors
    }
  }, [name, description, imageFile, onSubmit, initial])

  const clearImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setImageFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-2.5">
        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
          Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 font-medium placeholder-slate-400"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Candidate full name"
          maxLength={255}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2.5">
        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
          Description
        </label>
        <textarea
          className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 text-base font-medium placeholder-slate-400 resize-y min-h-[160px]"
          rows={6}
          value={description}
          onChange={e => setDesc(e.target.value)}
          placeholder="Short biography or platform statement..."
        />
      </div>

      {/* Image upload */}
      <div className="flex flex-col gap-2.5">
        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
          Photo (4:3 Ratio)
        </label>

        {isCropping && cropImageSrc ? (
          <div className="flex flex-col gap-4">
            <div className="relative w-full h-64 bg-slate-900 rounded-2xl overflow-hidden shadow-inner">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            {/* Zoom slider */}
            <div className="flex items-center gap-3 px-2">
              <span className="text-xs font-bold text-slate-400">Zoom</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCropSave}
                className="flex-1 py-2 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-500 transition-colors shadow-md"
              >
                Apply Crop
              </button>
              <button
                type="button"
                onClick={handleCropCancel}
                className="flex-1 py-2 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 rounded-2xl p-6 cursor-pointer bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 transition-colors group">
              {preview ? (
                <>
                  <div className="w-full max-w-[200px] aspect-[4/3] rounded-xl overflow-hidden shadow-md ring-4 ring-white dark:ring-slate-900">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover object-top" />
                  </div>
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 group-hover:underline">
                    Click to choose another photo
                  </span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                    <Upload size={24} />
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
                    <span className="text-brand-600 dark:text-brand-400 font-semibold group-hover:underline">Click to upload</span> a photo
                    <br />
                    <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">Will be automatically cropped to 4:3</span>
                  </span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleImageChange}
              />
            </label>
            {preview && (
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center bg-rose-500 text-white shadow-md hover:bg-rose-600 hover:scale-110 transition-all"
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          disabled={loading || !name.trim() || isCropping}
        >
          {loading
            ? <><Loader size={18} className="animate-spin" /> Saving...</>
            : isCropping ? 'Apply Crop First \u2191' : (initial ? 'Save Changes' : 'Add Candidate')
          }
        </button>
        {onCancel && (
          <button type="button" className="px-5 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ---- Main Dashboard ----
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

  // Change password modal state
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [pwOld, setPwOld] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [showPwOld, setShowPwOld] = useState(false)
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  const handleChangePwClose = useCallback(() => {
    setChangePwOpen(false)
    setPwOld('')
    setPwNew('')
    setPwConfirm('')
    setShowPwOld(false)
    setShowPwNew(false)
    setShowPwConfirm(false)
  }, [])

  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwNew.length < 10) {
      toast.error('New password must be at least 10 characters.')
      return
    }
    if (pwNew !== pwConfirm) {
      toast.error('New passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      await adminAPI.changePassword(pwOld, pwNew)
      toast.success('Password changed successfully!')
      handleChangePwClose()
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? 'Failed to change password.'
        : 'Failed to change password.'
      toast.error(message)
    } finally {
      setPwLoading(false)
    }
  }, [pwOld, pwNew, pwConfirm, toast, handleChangePwClose])

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

  const handleLogout = useCallback(() => {
    logout()
    navigate('/admin/login', { replace: true })
  }, [logout, navigate])

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

  const totalVotes = candidates.reduce((sum, c) => sum + c.total_votes, 0)

  // ---- Voting Control state ----
  const [votingOpen, setVotingOpen] = useState(true)
  const [endsAtDate, setEndsAtDate] = useState<Date | null>(null)
  const [votingLoading, setVotingLoading] = useState(false)
  const [votingSettingsLoading, setVotingSettingsLoading] = useState(true)

  // Load current voting settings on mount
  useEffect(() => {
    votingAPI.getStatus()
      .then((s) => {
        setVotingOpen(s.is_open)
        if (s.ends_at) {
          setEndsAtDate(new Date(s.ends_at))
        }
      })
      .catch(() => {/* keep defaults */ })
      .finally(() => setVotingSettingsLoading(false))
  }, [])

  const handleSaveVotingSettings = useCallback(async () => {
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

          {/* ---- Voting Control card ---- */}
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
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${votingOpen ? 'translate-x-8' : 'translate-x-1'
                        }`}
                    />
                  </button>
                  <p className={`text-xs font-bold ${votingOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                    {votingOpen ? 'Open — accepting votes' : 'Closed — votes blocked'}
                  </p>
                </div>

                {/* Auto-stop datetime (user's local time) */}
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
                  onClick={handleSaveVotingSettings}
                  disabled={votingLoading}
                  className="self-end px-7 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {votingLoading ? <><Loader size={16} className="animate-spin" /> Saving...</> : 'Save Settings'}
                </button>
              </div>
            )}
          </div>

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
                          {/* Delete button */}
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
                          {/* Edit button */}
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

      {/* Edit modal */}
      {editTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md transition-all duration-300">
          <div className="fixed inset-0" onClick={() => setEditTarget(null)} />
          <div className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-slate-800/50 flex flex-col overflow-hidden animate-[modalScale_0.3s_cubic-bezier(0.34,1.4,0.64,1)]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800/50">
              <h2 className="font-black text-2xl tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
                  <Pencil size={20} strokeWidth={2.5} />
                </div>
                Edit Candidate
              </h2>
              <button
                onClick={() => setEditTarget(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-8">
              <CandidateForm
                initial={editTarget}
                onSubmit={handleUpdate}
                onCancel={() => setEditTarget(null)}
                loading={formLoading}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Change password modal */}
      {changePwOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="fixed inset-0" onClick={() => !pwLoading && handleChangePwClose()} />
          <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-slate-800/50 overflow-hidden animate-[modalScale_0.3s_cubic-bezier(0.34,1.4,0.64,1)]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800/50">
              <h2 className="font-black text-2xl tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500">
                  <KeyRound size={20} strokeWidth={2.5} />
                </div>
                Change Password
              </h2>
              <button
                type="button"
                onClick={handleChangePwClose}
                disabled={pwLoading}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-8 flex flex-col gap-5">
              {/* Current password */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwOld ? 'text' : 'password'}
                    value={pwOld}
                    onChange={e => setPwOld(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 font-medium placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwOld(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPwOld ? 'Hide password' : 'Show password'}
                  >
                    {showPwOld ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwNew ? 'text' : 'password'}
                    value={pwNew}
                    onChange={e => setPwNew(e.target.value)}
                    required
                    minLength={10}
                    placeholder="Min. 10 characters"
                    className="w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-slate-900 dark:text-slate-50 font-medium placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPwNew ? 'Hide password' : 'Show password'}
                  >
                    {showPwNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwConfirm ? 'text' : 'password'}
                    value={pwConfirm}
                    onChange={e => setPwConfirm(e.target.value)}
                    required
                    placeholder="Repeat new password"
                    className={`w-full px-4 py-3 pr-11 bg-slate-50 dark:bg-slate-950 border rounded-xl focus:outline-none focus:ring-4 transition-all text-slate-900 dark:text-slate-50 font-medium placeholder-slate-400 ${
                      pwConfirm && pwNew !== pwConfirm
                        ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20'
                        : 'border-slate-200 dark:border-slate-800 focus:border-brand-500 focus:ring-brand-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPwConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showPwConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {pwConfirm && pwNew !== pwConfirm && (
                  <p className="text-xs font-semibold text-rose-500 ml-1">Passwords do not match.</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleChangePwClose}
                  disabled={pwLoading}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoading || !pwOld || pwNew.length < 10 || pwNew !== pwConfirm}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {pwLoading ? <><Loader size={16} className="animate-spin" /> Saving...</> : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="fixed inset-0" onClick={() => !deleteLoading && setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-800/50 overflow-hidden animate-[modalScale_0.3s_cubic-bezier(0.34,1.4,0.64,1)]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />

            <div className="flex flex-col items-center gap-5 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-rose-100 dark:bg-rose-500/10 text-rose-500">
                <AlertTriangle size={32} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-2">Delete Candidate?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  You are about to permanently delete{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{deleteTarget.name}</strong>.
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? <><Loader size={16} className="animate-spin" /> Deleting...</> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
