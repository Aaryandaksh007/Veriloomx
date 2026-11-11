'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — application shell (warm editorial)
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  LibraryBig,
  ScanSearch,
  WandSparkles,
  ClipboardCheck,
  BarChart3,
  Award,
  ShieldCheck,
} from 'lucide-react'
import { useApp, type View, roleIdentity } from '@/lib/store'
import { type Role } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { UserManagement } from '@/components/veriloom/user-management'

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Overview & workflow' },
  { id: 'vault', label: 'Brand Vault', icon: LibraryBig, hint: 'Single source of truth' },
  { id: 'audit', label: 'Audit Studio', icon: ScanSearch, hint: '6-pillar pre-flight' },
  { id: 'remediation', label: 'Remediation', icon: WandSparkles, hint: 'Explainable fixes' },
  { id: 'review', label: 'Review & Approval', icon: ClipboardCheck, hint: 'Role-gated approval workflow' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hint: 'Blindspot engine' },
  { id: 'certificate', label: 'Certificate', icon: Award, hint: 'Tamper-evident proof' },
]

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-terra-500">
        <ShieldCheck className="h-5 w-5 text-cream" />
      </div>
      <div className="leading-tight">
        <p className="font-serif text-base font-semibold tracking-tight text-ink">
          VeriLoom <span className="text-terra-600">AI</span>
        </p>
        <p className="text-[10px] font-medium text-faint">Brand-Governance Platform</p>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const { view, setView, role, userName, setIdentity, setAccountsDialogOpen, data, refresh, loading, refreshError } = useApp()

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

  useEffect(() => {
    const sessionRole = session?.user.role
    const sessionName = session?.user.name || session?.user.email || undefined
    if (sessionRole && ['creator', 'manager', 'reviewer', 'admin'].includes(sessionRole) && !data?.me) {
      setIdentity(sessionRole as Role, sessionName)
    }
  }, [session?.user.role, session?.user.name, session?.user.email, data?.me, setIdentity])

  const effectiveName = data?.me?.name || (userName !== 'Signed-in user' ? userName : undefined) || session?.user.name || session?.user.email || 'Signed-in user'
  const identity = roleIdentity(role, effectiveName)
  const clauseCount = data?.vault.length ?? 0
  const draftCount = data?.drafts.length ?? 0

  return (
    <div className="flex h-screen w-full overflow-hidden bg-cream print:h-auto print:overflow-visible print:bg-white">
      {/* ── Sidebar (desktop) ─────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-parchment lg:flex print:hidden">
        <div className="px-5 pb-5 pt-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 vl-scroll" aria-label="Main navigation">
          {NAV.map((item) => {
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                aria-current={active ? 'page' : undefined}
                title={item.hint}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra-400/60',
                  active ? 'text-terra-700' : 'text-ink-soft hover:bg-parchment hover:text-ink'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="vl-nav-active"
                    className="absolute inset-0 rounded-md bg-terra-50"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="vl-nav-bar"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-terra-500"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <item.icon
                  className={cn(
                    'relative z-10 h-4 w-4 shrink-0 transition-colors duration-200',
                    active ? 'text-terra-500' : 'text-faint group-hover:text-ink-soft'
                  )}
                />
                <span className={cn('relative z-10 flex-1 truncate', active ? 'font-semibold' : 'font-medium')}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="space-y-3 border-t border-line p-4">
          <div className="rounded-lg border border-line bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Signed in
              </p>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  role === 'creator' && 'border-terra-200 bg-terra-50 text-terra-700',
                  role === 'manager' && 'border-ochre-200 bg-ochre-50 text-ochre-800',
                  role === 'reviewer' && 'border-olive-200 bg-olive-50 text-olive-800',
                  role === 'admin' && 'border-stone-300 bg-ink text-cream'
                )}
              >
                {identity.label}
              </span>
            </div>
            <p className="mt-1 truncate font-semibold text-ink">{identity.name}</p>
            <p className="text-[11px] text-faint">
              {role === 'creator'
                ? 'Drafts · Audits · Remediate · Submit'
                : role === 'manager'
                  ? 'Diffs · Threads · Request changes'
                  : role === 'reviewer'
                    ? 'Final sign-off · Certificates'
                    : 'Accounts · Versioned Brand Vault'}
            </p>
            {role === 'admin' && <div className="mt-3"><UserManagement /></div>}
            <Button variant="ghost" size="sm" className="mt-2 h-7 px-0 text-xs text-faint" onClick={() => void signOut({ callbackUrl: '/login' })}>
              Sign out
            </Button>
          </div>
          <p className="flex items-center gap-1.5 px-1 text-[10px] text-faint">
            Team opopopxxnot · We Code Coders
          </p>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <div className="border-b border-line bg-parchment px-4 py-3 lg:hidden print:hidden">
          <div className="flex items-center justify-between gap-2">
            <Logo />
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-xs font-semibold text-ink">{identity.name}</p>
                <p className="text-[10px] text-faint">{identity.label}</p>
              </div>
              {role === 'admin' && (
                <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setAccountsDialogOpen(true)}>
                  Accounts
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-faint" onClick={() => void signOut({ callbackUrl: '/login' })}>
                Sign out
              </Button>
            </div>
          </div>
          <nav
            className="mt-3 -mb-3 flex gap-4 overflow-x-auto border-b border-line px-1 vl-scroll"
            aria-label="Main navigation"
          >
            {NAV.map((item) => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  aria-current={active ? 'page' : undefined}
                  title={item.hint}
                  className={cn(
                    'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-0.5 pb-2.5 pt-1 text-xs font-medium transition-colors duration-200',
                    active ? 'text-terra-600' : 'text-ink-soft hover:text-ink'
                  )}
                >
                  <item.icon className={cn('h-3.5 w-3.5', active ? 'text-terra-500' : 'text-faint')} />
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="vl-nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-terra-500"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* scrollable content — per-view motion handled in page.tsx */}
        <main className="flex-1 overflow-y-auto vl-scroll">
          <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:py-0">
            {refreshError && (
              <div
                role="alert"
                className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-clay-200 bg-clay-50 px-4 py-3"
              >
                <p className="min-w-0 text-sm text-clay-800">
                  {refreshError} You are viewing the last available data.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refresh()}
                  disabled={loading}
                >
                  {loading ? 'Retrying…' : 'Retry sync'}
                </Button>
              </div>
            )}
            {children}
          </div>
        </main>

        {/* sticky footer status bar */}
        <footer className="mt-auto shrink-0 border-t border-line bg-parchment pb-[max(0.5rem,env(safe-area-inset-bottom))] print:hidden">
          <div className="mx-auto flex w-full max-w-[1380px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
            <p className="flex items-center gap-2 text-[11px] text-faint">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-olive-500" />
              </span>
              6-Pillar Engine <span className="font-semibold text-olive-700">ready</span>
              <span className="text-line">·</span>
              Vault: <span className="font-semibold text-ink-soft">{clauseCount} clauses</span>
              <span className="text-line">·</span>
              <span className="whitespace-nowrap">{draftCount} drafts</span>
              {loading && <span className="text-terra-600">· syncing…</span>}
            </p>
            <p className="text-[11px] text-faint">
              VeriLoom AI — {identity.name} ({identity.label}) · Team opopopxxnot
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
