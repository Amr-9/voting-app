export interface Candidate {
  id: number
  name: string
  description: string
  image_path: string
  total_votes: number
  created_at: string
}

export interface WSMessage {
  candidates: Candidate[]
}

export type WSStatus = 'connecting' | 'connected' | 'disconnected'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}
