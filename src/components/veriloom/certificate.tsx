'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Exportable Compliance Certificate
// Tamper-evident (SHA-256), printable, with AI disclosure.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Award,
  Printer,
  ShieldCheck,
  Loader2,
  Fingerprint,
  BadgeCheck,
  FileText,
  ImageIcon,
  EyeOff,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import type { CertificateData } from '@/lib/types'
import { PILLAR_META, type Pillar } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function CertificateView() {
  const { data, selectedDraftId, selectDraft } = useApp()
  const approved = (data?.drafts ?? []).filter((d) => d.status === 'APPROVED')
  const [cert, setCert] = useState<CertificateData | null>(null)

  const selected = approved.find((d) => d.id === selectedDraftId) ?? approved[0] ?? null
  // cert is stale while a different draft loads — derive the effective state
  const currentCert = cert && selected && cert.draft.id === selected.id ? cert : null

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    const load = async () => {
      const res = await fetch(`/api/certificate/${selected.id}`, { cache: 'no-store' })
      if (cancelled) return
      if (!res.ok) {
        setCert(null)
        return
      }
      const body = (await res.json()) as CertificateData
      if (!cancelled) setCert(body)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selected?.id, data?.drafts.length])

  if (approved.length === 0) {
    return (
      <div className="flex h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/60 text-center">
        <Award className="h-12 w-12 text-zinc-300" />
        <h2 className="mt-4 text-lg font-bold text-zinc-700">No certificates issued yet</h2>
        <p className="mt-1.5 max-w-md text-sm text-zinc-500">
          Complete the full governance loop — audit → remediate → submit → approve — and a
          tamper-evident Brand Governance Approval Certificate is generated automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="vl-noprint flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900">
            <Award className="h-6 w-6 text-emerald-600" />
            Compliance Certificate
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Exportable, tamper-evident proof of governed publication.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selected?.id}
            onValueChange={(v) => selectDraft(v)}
          >
            <SelectTrigger className="h-9 w-72 border-zinc-200 text-xs">
              <SelectValue placeholder="Select approved draft" />
            </SelectTrigger>
            <SelectContent>
              {approved.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.title} · v{d.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentCert && (
            <>
              <Button
                variant="outline"
                className="h-9"
                onClick={async () => {
                  const res = await fetch(`/api/certificate/${currentCert.draft.id}`, { cache: 'no-store' })
                  if (!res.ok) return
                  const fresh = (await res.json()) as CertificateData
                  setToast(
                    fresh.hash === currentCert.hash
                      ? 'Integrity verified — hash matches the issued record.'
                      : 'Hash mismatch! This certificate does not match the current record.',
                    fresh.hash === currentCert.hash
                  )
                }}
              >
                <Fingerprint className="mr-1.5 h-4 w-4" /> Verify
              </Button>
              <Button className="h-9 bg-zinc-900 hover:bg-zinc-800" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {!currentCert && (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      )}

      {currentCert && <CertificateBody cert={currentCert} />}
    </div>
  )
}

function setToast(title: string, ok: boolean) {
  if (ok) toast({ title })
  else toast({ title, variant: 'destructive' })
}

function CertificateBody({ cert }: { cert: CertificateData }) {
  const d = cert.draft
  const a = cert.audit
  const fixedCount = a.findings.length - cert.overrides.length
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="vl-print-area mx-auto max-w-3xl overflow-hidden rounded-2xl border-[3px] border-double border-zinc-800 bg-white shadow-xl"
    >
      {/* header band */}
      <div className="relative bg-zinc-950 px-8 py-7 text-white">
        <div className="vl-grid-pattern absolute inset-0" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              VeriLoom AI · Living Brand Vault
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight">
              Brand Governance Approval Certificate
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Issued under the Inkloom governance framework · WCAG 2.1 AA · Zero-hallucination pipeline
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-500/10">
              <BadgeCheck className="h-10 w-10 text-emerald-400" />
            </span>
            <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Approved
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        {/* identity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Certified asset" value={d.title} mono={false} />
          <Field label="Certificate ID" value={cert.certificateId} />
          <Field label="Channel" value={d.channel} mono={false} />
          <Field label="Approved version" value={`v${d.version} (of ${d.version})`} mono={false} />
          <Field label="Creator" value={d.creator} mono={false} />
          <Field
            label="Issued"
            value={new Date(cert.issuedAt).toLocaleString(undefined, {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
            mono={false}
          />
        </div>

        {/* pillars */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Six-pillar audit outcome
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {a.pillars.map((p) => (
              <div
                key={p.pillar}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2',
                  p.status === 'pass' && 'border-emerald-200 bg-emerald-50/60',
                  p.status === 'warn' && 'border-amber-200 bg-amber-50/60',
                  p.status === 'fail' && 'border-rose-200 bg-rose-50/60',
                  p.status === 'skipped' && 'border-zinc-200 bg-zinc-50'
                )}
              >
                <span className="text-[11px] font-bold text-zinc-800">
                  {PILLAR_META[p.pillar].short}
                </span>
                <span className="text-[10px] font-semibold uppercase text-zinc-500">
                  {p.status === 'skipped' ? 'n/a' : `${p.critical}C ${p.warning}W ${p.info}I`}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Pre-remediation audit score: <span className="font-bold text-zinc-700">{a.score}/100</span> — all{' '}
            <span className="font-bold text-zinc-700">{a.findings.length}</span> findings resolved before
            sign-off ({fixedCount} fixed, {cert.overrides.length} justified override
            {cert.overrides.length === 1 ? '' : 's'}) · {a.suppressed} ungrounded AI flags suppressed
            before human review.
          </p>
        </div>

        {/* overrides */}
        {cert.overrides.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              <EyeOff className="h-3.5 w-3.5" /> Human overrides preserved (with justification)
            </p>
            <div className="mt-2 space-y-2">
              {cert.overrides.map((o) => (
                <div key={o.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10.5px] font-bold text-amber-800">{o.findingKey}</span>
                    {o.finding?.clauseId && (
                      <span className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                        {o.finding.clauseId}
                      </span>
                    )}
                    <span className="text-[10.5px] text-zinc-500">— {o.actor}</span>
                  </div>
                  <p className="mt-1 text-xs italic leading-relaxed text-zinc-700">“{o.note}”</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI disclosure */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            AI usage disclosure (transparent ledger)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...new Set(a.aiLedger.map((l) => l.model))].map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11px] font-bold text-teal-800"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {m}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800">
              <CpuBadge /> Deterministic math: ΔE2000 · WCAG 2.1 luminance
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
            {a.aiLedger.length} external AI call{a.aiLedger.length === 1 ? '' : 's'} during audit
            (after local PII/codename redaction). {a.redactedPreview ? 'Confidentiality sandbox was active.' : ''}
          </p>
        </div>

        {/* integrity */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            <Fingerprint className="h-3.5 w-3.5" /> Tamper-evident integrity hash (SHA-256)
          </p>
          <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-zinc-700">
            {cert.hash}
          </p>
          <p className="mt-1.5 text-[10.5px] text-zinc-400">
            Computed over the full audit record (findings, citations, overrides, models). Any
            post-approval alteration breaks the hash.
          </p>
        </div>

        {/* signatures */}
        <div className="grid gap-6 border-t border-zinc-200 pt-6 sm:grid-cols-3">
          <Signature name="Maya Chen" role="Creator" />
          <Signature name="Dev Kapoor" role="Brand Manager" />
          <Signature name="Aaryan Sharma" role="Authorised Reviewer" highlight />
        </div>

        <p className="text-center text-[10px] text-zinc-400">
          Generated by VeriLoom AI · Team opopopxxnot · We Code Coders Hackathon —{' '}
          {d.kind === 'image' ? 'Visual asset' : 'Text asset'} ·{' '}
          {d.kind === 'image' ? <ImageIcon className="inline h-3 w-3" /> : <FileText className="inline h-3 w-3" />}
        </p>
      </div>
    </motion.div>
  )
}

function CpuBadge() {
  return <BadgeCheck className="h-3.5 w-3.5" />
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <p className={cn('mt-0.5 text-sm font-semibold text-zinc-900', mono && 'font-mono text-[12.5px]')}>
        {value}
      </p>
    </div>
  )
}

function Signature({ name, role, highlight = false }: { name: string; role: string; highlight?: boolean }) {
  return (
    <div>
      <div
        className={cn(
          'h-10 border-b',
          highlight ? 'border-emerald-500' : 'border-zinc-300 border-dashed'
        )}
      />
      <p className={cn('mt-1.5 text-xs font-bold', highlight ? 'text-emerald-700' : 'text-zinc-700')}>
        {name}
      </p>
      <p className="text-[10px] text-zinc-400">{role}</p>
    </div>
  )
}
