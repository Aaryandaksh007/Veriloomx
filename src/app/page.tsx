'use client'

// ═══════════════════════════════════════════════════════════
// VeriLoom AI — Intelligent Brand-Governance & Explainable
// Compliance Platform
// Team opopopxxnot (Aaryan Sharma) · We Code Coders Hackathon
// ═══════════════════════════════════════════════════════════

import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { useApp } from '@/lib/store'
import { AppShell } from '@/components/veriloom/shell'
import { Button } from '@/components/ui/button'
import { DashboardView } from '@/components/veriloom/dashboard'
import { VaultView } from '@/components/veriloom/vault'
import { AuditStudioView } from '@/components/veriloom/audit-studio'
import { RemediationView } from '@/components/veriloom/remediation'
import { ReviewView } from '@/components/veriloom/review'
import { AnalyticsView } from '@/components/veriloom/analytics'
import { CertificateView } from '@/components/veriloom/certificate'

export default function Home() {
  const { view, data, loading, refreshError, refresh } = useApp()

  return (
    <AppShell>
      {data === null ? (
        <BootScreen
          loading={loading}
          error={refreshError}
          onRetry={() => void refresh()}
        />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <RenderView view={view} />
          </motion.div>
        </AnimatePresence>
      )}
    </AppShell>
  )
}

function RenderView({ view }: { view: string }) {
  switch (view) {
    case 'vault':
      return <VaultView />
    case 'audit':
      return <AuditStudioView />
    case 'remediation':
      return <RemediationView />
    case 'review':
      return <ReviewView />
    case 'analytics':
      return <AnalyticsView />
    case 'certificate':
      return <CertificateView />
    default:
      return <DashboardView />
  }
}

function BootScreen({
  loading,
  error,
  onRetry,
}: {
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-terra-500"
      >
        <ShieldCheck className="h-6 w-6 text-cream" />
      </motion.div>
      <p className="mt-4 text-sm font-semibold text-ink">
        {error ? 'Could not connect to your workspace' : 'Connecting to the Living Brand Vault…'}
      </p>
      {error ? (
        <>
          <p role="alert" className="mt-2 max-w-lg text-sm text-clay-700">
            {error}
          </p>
          <Button className="mt-4" onClick={onRetry} disabled={loading}>
            {loading ? 'Retrying…' : 'Retry connection'}
          </Button>
        </>
      ) : (
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-terra-400"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
