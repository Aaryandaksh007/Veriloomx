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
  draftId: string | null
  actor: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}

export interface BootstrapData {
  me?: { id: string; name: string; email: string; role: Role }
  vault: VaultItemDTO[]
  drafts: DraftDTO[]
  audits: Record<string, AuditResult>
  teamSummary?: { totalUsers: number; roleCounts: Record<Role, number> }
  events: EventDTO[]
}

interface AppState {
  view: View
  role: Role
  userName: string
  accountsDialogOpen: boolean
  selectedDraftId: string | null
  autoAuditId: string | null // freshly created draft → Audit Studio auto-runs the engine
  data: BootstrapData | null
  loading: boolean
  refreshError: string | null
  setView: (v: View) => void
  setRole: (r: Role) => void
  setIdentity: (r: Role, name?: string) => void
  setAccountsDialogOpen: (open: boolean) => void
  selectDraft: (id: string | null, view?: View) => void
  setAutoAudit: (id: string | null) => void
  setData: (d: BootstrapData) => void
  refresh: () => Promise<void>
}

export const useApp = create<AppState>()(
  persist(
    (set) => {
      let refreshInFlight: Promise<void> | null = null

      return {
        view: 'dashboard',
        role: 'creator',
        userName: 'Signed-in user',
        accountsDialogOpen: false,
        selectedDraftId: null,
        autoAuditId: null,
        data: null,
        loading: false,
        refreshError: null,
        setView: (v) => set({ view: v }),
        setRole: (r) => set({ role: r }),
        setIdentity: (r, name) =>
          set((s) => ({ role: r, userName: name?.trim() ? name.trim() : s.userName })),
        setAccountsDialogOpen: (open) => set({ accountsDialogOpen: open }),
        selectDraft: (id, view) =>
          set((s) => ({ selectedDraftId: id, view: view ?? s.view })),
        setAutoAudit: (id) => set({ autoAuditId: id }),
        setData: (d) => set({ data: d }),
        refresh: () => {
          if (refreshInFlight) return refreshInFlight

          const request = (async () => {
            set({ loading: true })
            try {
              const res = await fetch('/api/bootstrap', {
                cache: 'no-store',
                signal: AbortSignal.timeout(20_000),
              })
              if (res.status === 401) {
                if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                  const { signOut } = await import('next-auth/react')
                  await signOut({ callbackUrl: '/login?reason=expired' })
                }
                return
              }
              if (!res.ok) {
                throw new Error(`Workspace sync failed (HTTP ${res.status}).`)
              }

              const data = (await res.json()) as BootstrapData
              set((s) => ({
                data,
                role: data.me?.role ?? s.role,
                userName: data.me?.name ?? s.userName,
                refreshError: null,
              }))
            } catch (error) {
              set({
                refreshError:
                  error instanceof Error ? error.message : 'Workspace sync failed unexpectedly.',
              })
            } finally {
              set({ loading: false })
            }
          })()

          refreshInFlight = request
          return request.finally(() => {
            if (refreshInFlight === request) refreshInFlight = null
          })
        },
      }
    },
    {
      name: 'veriloom-session',
      partialize: (s) => ({ view: s.view, selectedDraftId: s.selectedDraftId }),
    }
  )
)

export const roleIdentity = (role: Role, name = 'Signed-in user') => ({
  name,
  label: ROLE_LABELS[role],
})

const ROLE_LABELS: Record<Role, string> = {
  creator: 'Author',
  manager: 'Reviewer',
  reviewer: 'Approver',
  admin: 'Administrator',
}
