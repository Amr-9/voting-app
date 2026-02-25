import axios from 'axios'
import type { Candidate } from '../types/index.ts'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // Required so the browser sends the HttpOnly admin_token cookie automatically
  withCredentials: true,
})

// On 401, notify the auth context so it can clear its in-memory state
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedCallback(fn: () => void) { onUnauthorized = fn }

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      onUnauthorized?.()
    }
    return Promise.reject(error)
  }
)

// -------------------------------------------------------
// Public — Candidates
// -------------------------------------------------------
export const candidateAPI = {
  getAll: (): Promise<Candidate[]> =>
    api.get<{ message: string; data: { candidates: Candidate[] } }>('/api/candidates')
      .then((res) => res.data.data.candidates ?? []),
}

// -------------------------------------------------------
// Public — Voting Status
// -------------------------------------------------------
export interface VotingStatus {
  is_open: boolean
  effectively_open: boolean
  ends_at: string | null // RFC 3339 UTC, or null
}

export const votingAPI = {
  getStatus: (): Promise<VotingStatus> =>
    api.get<{ message: string; data: VotingStatus }>('/api/voting-status')
      .then((res) => res.data.data),
}

// -------------------------------------------------------
// Public — Voting
// -------------------------------------------------------
export const voteAPI = {
  requestOTP: (
    email: string,
    fingerprint: string,
    captchaToken: string,
    candidateId: number,
  ) =>
    api.post('/api/vote/request-otp', {
      email,
      fingerprint,
      captcha_token: captchaToken,
      candidate_id: candidateId,
    }),

  verify: (email: string, otp: string) =>
    api.post('/api/vote/verify', {
      email,
      otp,
    }),
}

// -------------------------------------------------------
// Admin — cookie-authenticated (HttpOnly admin_token)
// -------------------------------------------------------
export const adminAPI = {
  login: (email: string, password: string): Promise<void> =>
    api.post('/api/admin/login', { email, password }).then(() => {}),

  logout: (): Promise<void> =>
    api.post('/api/admin/logout').then(() => {}),

  me: (): Promise<{ id: number; email: string }> =>
    api.get<{ message: string; data: { id: number; email: string } }>('/api/admin/me')
      .then((res) => res.data.data),

  addCandidate: (name: string, description: string, imageFile: File | null) => {
    const form = new FormData()
    form.append('name', name)
    if (description) form.append('description', description)
    if (imageFile) form.append('image', imageFile)
    return api.post('/api/admin/candidates', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  updateCandidate: (id: number, name: string, description: string, imageFile: File | null) => {
    const form = new FormData()
    form.append('name', name)
    if (description) form.append('description', description)
    if (imageFile) form.append('image', imageFile)
    return api.put(`/api/admin/candidates/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteCandidate: (id: number) =>
    api.delete(`/api/admin/candidates/${id}`),

  updateVotingSettings: (isOpen: boolean, endsAt: string | null) =>
    api.put('/api/admin/voting-settings', {
      is_open: isOpen,
      ends_at: endsAt, // RFC 3339 UTC string or null
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    api.put('/api/admin/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    }),
}

export default api
