'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — client store (zustand)
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'
import 'zustand/middleware'
import { persist } from 'zustand/middleware'
import type {
  AuditResult,
  DraftDTO,
  Role,
  VaultItemDTO,
} from '@/lib/types'

export type View =
  | 'dashboard'
  | 'vault'
  | 'audit'
  | 'remediation'
  | 'review'
  | 'analytics'
  | 'certificate'

export interface EventDTO {
  id: string
  actor: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}

export interface BootstrapData {
  vault: VaultItemDTO[]
  drafts: DraftDTO[]
  audits: Record<string, AuditResult>
  events: EventDTO[]
}

interface AppState {
  view: View
  role: Role
  selectedDraftId: string | null
  autoAuditId: string | null // freshly created draft → Audit Studio auto-runs the engine
  data: BootstrapData | null
  loading: boolean
  setView: (v: View) => void
  setRole: (r: Role) => void
  selectDraft: (id: string | null, view?: View) => void
  setAutoAudit: (id: string | null) => void
  setData: (d: BootstrapData) => void
  refresh: () => Promise<void>
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'dashboard',
      role: 'creator',
      selectedDraftId: null,
      autoAuditId: null,
      data: null,
      loading: false,
      setView: (v) => set({ view: v }),
      setRole: (r) => set({ role: r }),
      selectDraft: (id, view) =>
        set((s) => ({ selectedDraftId: id, view: view ?? s.view })),
      setAutoAudit: (id) => set({ autoAuditId: id }),
      setData: (d) => set({ data: d }),
      refresh: async () => {
        set({ loading: true })
        try {
          const res = await fetch('/api/bootstrap', { cache: 'no-store' })
          if (res.ok) {
            const data = (await res.json()) as BootstrapData
            set({ data })
          }
        } finally {
          set({ loading: false })
        }
      },
    }),
    {
      name: 'veriloom-session',
      partialize: (s) => ({ role: s.role, view: s.view, selectedDraftId: s.selectedDraftId }),
    }
  )
)

export const roleIdentity = (role: Role) =>
  role === 'creator'
    ? { name: 'Maya Chen', label: 'Creator' }
    : role === 'manager'
      ? { name: 'Dev Kapoor', label: 'Brand Manager' }
      : { name: 'Aaryan Sharma', label: 'Authorised Reviewer' }
