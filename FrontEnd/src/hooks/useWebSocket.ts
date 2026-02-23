import { useState, useEffect, useRef, useCallback } from 'react'
import type { Candidate, WSStatus } from '../types/index.ts'
import { candidateAPI } from '../services/api.ts'

/**
 * useWebSocket
 * Connects to the backend WebSocket, parses leaderboard updates,
 * and auto-reconnects with exponential backoff.
 * Also fetches initial state via standard REST API to ensure no lag.
 */
export function useWebSocket(url: string) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [status, setStatus] = useState<WSStatus>('disconnected')

  const wsRef = useRef<WebSocket | null>(null)
  const retryCount = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMounted = useRef(true)

  // Fetch initial candidates via HTTP on mount
  useEffect(() => {
    candidateAPI.getAll().then(all => {
      if (isMounted.current) {
        setCandidates(prev => prev.length === 0 ? all : prev)
      }
    }).catch(console.error)
  }, [])

  const connect = useCallback(() => {
    if (!isMounted.current) return

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!isMounted.current) return
      setStatus('connected')
      retryCount.current = 0
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      if (!isMounted.current) return
      try {
        const msg = JSON.parse(event.data) as { candidates?: Candidate[] }
        if (Array.isArray(msg.candidates)) {
          setCandidates(msg.candidates)
        }
      } catch {
        // Silently ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (!isMounted.current) return
      setStatus('disconnected')
      wsRef.current = null
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * 2 ** retryCount.current, 30_000)
      retryCount.current += 1
      retryTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url])

  useEffect(() => {
    isMounted.current = true
    connect()

    return () => {
      isMounted.current = false
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null  // Prevent reconnect loop on unmount
        wsRef.current.close()
      }
    }
  }, [connect])

  return { candidates, status }
}
