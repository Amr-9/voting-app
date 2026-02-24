import { useState, useEffect, useRef, useCallback } from 'react'
import type { Candidate, WSVotingStatus } from '../types/index.ts'

/**
 * useWebSocket
 * Connects to the backend WebSocket, parses leaderboard updates + voting status,
 * and auto-reconnects with exponential backoff.
 *
 * On every connect/reconnect the server immediately sends an initial snapshot
 * containing the current candidates + voting_status, so the UI is never stale
 * even when the connection drops and recovers (e.g. mobile network switch).
 * No HTTP polling is needed.
 */
export function useWebSocket(url: string) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [votingStatus, setVotingStatus] = useState<WSVotingStatus | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')

  const wsRef = useRef<WebSocket | null>(null)
  const retryCount = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMounted = useRef(true)

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
        const msg = JSON.parse(event.data) as {
          candidates?: Candidate[]
          voting_status?: WSVotingStatus
        }
        if (Array.isArray(msg.candidates)) {
          setCandidates(msg.candidates)
        }
        if (msg.voting_status !== undefined) {
          setVotingStatus(msg.voting_status)
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
      // On successful reconnect the server sends a fresh snapshot → UI updates instantly
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

  return { candidates, votingStatus, status }
}
