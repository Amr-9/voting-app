import { useState, useCallback, useRef } from 'react'
import { Upload, X, Loader } from 'lucide-react'
import Cropper, { Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { getCroppedImg } from '../../utils/cropImage.ts'
import { getImageUrl } from '../../utils/imageUrl.ts'
import type { Candidate } from '../../types/index.ts'

export interface FormValues {
  name: string
  description: string
  imageFile: File | null
}

export interface CandidateFormProps {
  initial?: Candidate
  onSubmit: (values: FormValues) => Promise<void>
  onCancel?: () => void
  loading: boolean
}

export default function CandidateForm({ initial, onSubmit, onCancel, loading }: CandidateFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDesc] = useState(initial?.description ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(
    initial ? getImageUrl(initial.image_path) : null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

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
