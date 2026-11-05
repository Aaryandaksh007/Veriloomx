'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — application shell
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import {
  LayoutDashboard,
  LibraryBig,
  ScanSearch,
  WandSparkles,
  ClipboardCheck,
  BarChart3,
  Award,
  UserRound,
  ShieldCheck,
  Github,
} from 'lucide-react'
import { useApp, type View, roleIdentity } from '@/lib/store'
import { ROLE_META, type Role } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Overview & workflow' },
  { id: 'vault', label: 'Brand Vault', icon: LibraryBig, hint: 'Single source of truth' },
  { id: 'audit', label: 'Audit Studio', icon: ScanSearch, hint: '6-pillar pre-flight' },
  { id: 'remediation', label: 'Remediation', icon: WandSparkles, hint: 'Explainable fixes' },
  { id: 'review', label: 'Review & Approval', icon: ClipboardCheck, hint: 'RBAC sign-off' },
  { id: 'analytics', label: 'Governance Analytics', icon: BarChart3, hint: 'Blindspot engine' },
  { id: 'certificate', label: 'Compliance Certificate', icon: Award, hint: 'Tamper-evident proof' },
]

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/20">
        <ShieldCheck className="h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className={cn('font-bold tracking-tight', dark ? 'text-white' : 'text-zinc-900')}>
          VeriLoom <span className="text-emerald-500">AI</span>
        </p>
        <p className={cn('text-[10px] font-medium', dark ? 'text-zinc-400' : 'text-zinc-500')}>
          Brand-Governance Platform
        </p>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { view, setView, role, setRole, data, refresh, loading } = useApp()

  useEffect(() => {
    if (!data) void refresh()
  }, [data, refresh])

  // live workspace sync — the seeded demo loop lands asynchronously,
  // and multi-tab collaboration should feel alive
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 12000)
    return () => clearInterval(id)
  }, [refresh])

  const identity = roleIdentity(role)
  const clauseCount = data?.vault.length ?? 0
  const draftCount = data?.drafts.length ?? 0

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50 print:h-auto print:overflow-visible print:bg-white">
      {/* ── Sidebar (desktop) ─────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 lg:flex print:hidden">
        <div className="px-5 pb-5 pt-6">
          <Logo dark />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 vl-scroll-dark">
          {NAV.map((item) => {
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  )}
                />
                <span className="flex-1 truncate font-medium">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </button>
            )
          })}
        </nav>

        <div className="space-y-3 border-t border-zinc-800/80 p-4">
          <div className="rounded-xl bg-zinc-900 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Acting as
            </p>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="mt-1.5 h-8 border-zinc-700 bg-zinc-950 text-xs text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_META) as Role[]).map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {ROLE_META[r].person} · {ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[10px] text-zinc-500">{ROLE_META[role].desc}</p>
          </div>
          <div className="flex items-center gap-1.5 px-1 text-[10px] text-zinc-600">
            <Github className="h-3 w-3" />
            Team opopopxxnot · We Code Coders
          </div>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <div className="border-b border-zinc-200 bg-white px-4 py-3 lg:hidden print:hidden">
          <div className="flex items-center justify-between">
            <Logo />
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-8 w-40 border-zinc-200 text-xs">
                <UserRound className="mr-1 h-3.5 w-3.5 text-zinc-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_META) as Role[]).map((r) => (
                  <SelectItem key={r} value={r} className="text-xs">
                    {ROLE_META[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1 vl-scroll">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                  view === item.id
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-200 bg-white text-zinc-600'
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* scrollable content */}
        <main className="vl-fadein flex-1 overflow-y-auto vl-scroll">
          <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
            {children}
          </div>
        </main>

        {/* sticky footer status bar */}
        <footer className="mt-auto shrink-0 border-t border-zinc-200 bg-white print:hidden">
          <div className="mx-auto flex w-full max-w-[1380px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
            <p className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              6-Pillar Engine <span className="font-semibold text-emerald-600">ready</span>
              <span className="text-zinc-300">·</span>
              Vault: <span className="font-semibold text-zinc-700">{clauseCount} clauses</span>
              <span className="text-zinc-300">·</span>
              {draftCount} drafts
              {loading && <span className="text-emerald-600">· syncing…</span>}
            </p>
            <p className="text-[11px] text-zinc-400">
              VeriLoom AI — {identity.name} ({identity.label}) · Team opopopxxnot
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
