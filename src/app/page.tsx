'use client'

// ═════════════════════════════════════════════════════════════
// VeriLoom AI — Intelligent Brand-Governance & Explainable
// Compliance Platform
// Team opopopxxnot (Aaryan Sharma) · We Code Coders Hackathon
// ═════════════════════════════════════════════════════════════

import { useApp } from '@/lib/store'
import { AppShell } from '@/components/veriloom/shell'
import { DashboardView } from '@/components/veriloom/dashboard'
import { VaultView } from '@/components/veriloom/vault'
import { AuditStudioView } from '@/components/veriloom/audit-studio'
import { RemediationView } from '@/components/veriloom/remediation'
import { ReviewView } from '@/components/veriloom/review'
import { AnalyticsView } from '@/components/veriloom/analytics'
import { CertificateView } from '@/components/veriloom/certificate'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { view, data } = useApp()

  return (
    <AppShell>
      {data === null ? (
        <div className="flex h-[70vh] flex-col items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-emerald-500" />
          <p className="mt-4 text-sm font-semibold text-zinc-500">
            Booting the Living Brand Vault…
          </p>
        </div>
      ) : (
        <RenderView view={view} />
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
