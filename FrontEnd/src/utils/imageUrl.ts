const BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * Converts a relative image_path from the backend into a full URL.
 * e.g. '/uploads/uuid.png' → 'http://localhost:8071/uploads/uuid.png'
 */
export function getImageUrl(imagePath: string): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith('http')) return imagePath
  return `${BASE}${imagePath}`
}
