import { useState, useEffect } from 'react'
import FingerprintJS from '@fingerprintjs/fingerprintjs'

const FP_KEY = 'voter_fp'

/**
 * useFingerprint
 * Returns a stable browser fingerprint using FingerprintJS.
 * The result is cached in localStorage to avoid re-computation.
 */
export function useFingerprint(): string | null {
  const [fingerprint, setFingerprint] = useState<string | null>(
    () => localStorage.getItem(FP_KEY)
  )

  useEffect(() => {
    if (fingerprint) return  // Already have a cached value

    FingerprintJS.load()
      .then(fp => fp.get())
      .then(result => {
        const visitorId = result.visitorId
        localStorage.setItem(FP_KEY, visitorId)
        setFingerprint(visitorId)
      })
      .catch(() => {
        // Fallback: generate a UUID if FingerprintJS fails
        const fallback = crypto.randomUUID()
        localStorage.setItem(FP_KEY, fallback)
        setFingerprint(fallback)
      })
  }, [fingerprint])

  return fingerprint
}
