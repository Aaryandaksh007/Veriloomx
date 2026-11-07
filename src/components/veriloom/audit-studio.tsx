'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Audit Studio
// Draft submission + parallel 6-pillar audit with results.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanSearch,
  Plus,
  FileText,
  ImageIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  ChevronDown,
  WandSparkles,
  EyeOff,
  Cpu,
  Send,
  Upload,
  CircleDot,
} from 'lucide-react'
import { useApp, roleIdentity } from '@/lib/store'
import { liveScan } from '@/lib/live-check'
import { LiveTextarea, LiveStatusStrip } from './live-editor'
import {
  PILLAR_META,
  type AuditResult,
  type DraftDTO,
  type Finding,
  type ImageMeta,
  type Pillar,
  type PillarSummary,
} from '@/lib/types'
import { extractPaletteFromPixels } from '@/lib/palette'
import {
  ClauseBadge,
  CitationCard,
  EngineChip,
  HexSwatch,
  ScoreRing,
  SeverityChip,
  StatusChip,
  ViewHeader,
} from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function AuditStudioView() {
  const { data, selectedDraftId, selectDraft, refresh, role } = useApp()
  const drafts = data?.drafts ?? []
  const selected = drafts.find((d) => d.id === selectedDraftId) ?? null
  const audit = selectedDraftId ? data?.audits[selectedDraftId] : undefined

  return (
    <div className="space-y-5">
      <ViewHeader
        crumb="Audit Studio"
        title="Audit Studio"
        subtitle="Submit text or visuals and run the parallel 6-pillar audit — deterministic math and citation-gated AI, side by side."
      />
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* draft list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
            Drafts
          </h2>
          <NewDraftButton />
        </div>
        <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto pr-1 vl-scroll">
          {drafts.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDraft(d.id)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-colors',
                d.id === selectedDraftId
                  ? 'border-terra-300 bg-terra-50/60 ring-1 ring-terra-200'
                  : 'border-stone-200 bg-paper hover:border-stone-300'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
                  {d.kind === 'image' ? (
                    <ImageIcon className="h-3.5 w-3.5" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {d.channel} · v{d.version}
                </span>
                <StatusChip status={d.status} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-ink">
                {d.title}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-400">by {d.creator}</p>
            </button>
          ))}
        </div>
      </div>

      {/* main panel */}
      <div>
        {!selected ? (
          <div className="flex h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-paper/60 text-center">
            <ScanSearch className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-600">
              Select a draft to audit
            </p>
            <p className="mt-1 max-w-sm text-xs text-stone-400">
              Or create a new one — paste campaign copy or upload a promotional image,
              then run the parallel 6-pillar pre-flight audit.
            </p>
          </div>
        ) : (
          <DraftPanel
            draft={selected}
            audit={audit ?? null}
            onAuditDone={refresh}
            actor={roleIdentity(role).name}
          />
        )}
      </div>
      </div>
    </div>
  )
}

// ── Draft panel ──────────────────────────────────────────────

function DraftPanel({
  draft,
  audit,
  onAuditDone,
  actor,
}: {
  draft: DraftDTO
  audit: AuditResult | null
  onAuditDone: () => Promise<void>
  actor: string
}) {
  const { selectDraft, setView, data, autoAuditId, setAutoAudit } = useApp()
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0) // 0 idle, 1..6 pillar animation
  const [result, setResult] = useState<AuditResult | null>(audit)
  const [content, setContent] = useState(draft.content)
  const [altText, setAltText] = useState(draft.imageMeta?.altText ?? '')
  const [showRedacted, setShowRedacted] = useState(false)
  const runToken = useRef(0)
  const autoRunDone = useRef<string | null>(null)

  useEffect(() => {
    setResult(audit)
    setContent(draft.content)
    setAltText(draft.imageMeta?.altText ?? '')
  }, [draft.id, draft.version, draft.content, audit])

  const dirty =
    draft.kind === 'text' ? content !== draft.content : altText !== (draft.imageMeta?.altText ?? '')

  const saveEdits = async () => {
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.kind === 'text' ? { content, actor } : { altText, actor }),
    })
    if (!res.ok) {
      toast({ title: 'Save failed', description: (await res.json()).error, variant: 'destructive' })
      return false
    }
    await onAuditDone()
    toast({ title: 'Draft saved', description: 'Content changed — re-run the audit before publishing.' })
    return true
  }

  const runAudit = async () => {
    if (dirty) {
      const ok = await saveEdits()
      if (!ok) return
    }
    setRunning(true)
    setResult(null)
    setStage(1)
    const token = ++runToken.current

    // staged pillar animation while the engine runs
    const timer = setInterval(() => {
      setStage((s) => (s < 6 ? s + 1 : s))
    }, 500)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id, actor }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Audit failed')
      if (token !== runToken.current) return
      clearInterval(timer)
      setStage(6)
      // small delay so the last pillar animation completes
      await new Promise((r) => setTimeout(r, 450))
      setResult(body.audit as AuditResult)
      await onAuditDone()
      toast({
        title: `Audit complete — compliance score ${body.audit.score}/100`,
        description: `${body.audit.findings.length} findings · ${body.audit.suppressed} ungrounded AI flags suppressed`,
      })
    } catch (err) {
      clearInterval(timer)
      toast({
        title: 'Audit failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      if (token === runToken.current) {
        setRunning(false)
        setStage(0)
      }
    }
  }

  const editable = ['DRAFT', 'CHANGES_REQUESTED', 'AUDITED'].includes(draft.status)

  // instant client-side scan of whatever is currently in the editor
  const live = useMemo(
    () => liveScan(draft.kind === 'text' ? content : '', data?.vault ?? []),
    [content, data?.vault, draft.kind]
  )

  // a draft born in the Live Playground auto-runs the full engine on arrival
  useEffect(() => {
    if (
      autoAuditId &&
      autoAuditId === draft.id &&
      autoRunDone.current !== draft.id &&
      draft.status === 'DRAFT'
    ) {
      autoRunDone.current = draft.id
      setAutoAudit(null)
      void runAudit()
    }
  }, [autoAuditId, draft.id, draft.status])

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={draft.status} />
              <span className="text-[11px] font-semibold text-stone-500">
                {draft.channel} · v{draft.version} · {draft.creator}
              </span>
            </div>
            <h1 className="mt-1.5 font-serif text-xl font-semibold tracking-tight text-ink">
              {draft.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {dirty && editable && (
              <Button variant="outline" size="sm" onClick={saveEdits}>
                Save draft
              </Button>
            )}
            <Button
              onClick={runAudit}
              disabled={running || draft.status === 'APPROVED'}
              className="bg-terra-600 hover:bg-terra-500"
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Auditing…
                </>
              ) : (
                <>
                  <ScanSearch className="mr-2 h-4 w-4" /> Run 6-Pillar Audit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* content editor */}
      {draft.kind === 'text' ? (
        <div className="rounded-xl border border-line bg-paper p-4">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Draft copy
            </Label>
            <span className="text-[11px] text-stone-400">
              {content.trim().split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <LiveTextarea
            value={content}
            onChange={setContent}
            hits={live.hits}
            disabled={!editable || running}
            minHeightClass="min-h-[220px]"
            placeholder="Paste the campaign copy…"
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-2.5">
            <LiveStatusStrip counts={live.counts} total={live.total} />
            <span className="shrink-0 text-[10.5px] text-stone-400">
              live scan · deterministic · in-browser
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-paper p-4">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Promotional asset
            </Label>
            <span className="text-[11px] text-stone-400">
              {draft.imageMeta?.width}×{draft.imageMeta?.height}px
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_1fr]">
            {draft.imageData && (
              <img
                src={draft.imageData}
                alt={draft.title}
                className="w-full rounded-lg border border-stone-200 object-contain"
              />
            )}
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Extracted palette (client-side, pre-upload)
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(draft.imageMeta?.palette ?? []).map((s) => (
                    <span
                      key={s.hex}
                      className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-parchment px-2 py-1 font-mono text-[11px] font-semibold text-stone-700"
                    >
                      <HexSwatch hex={s.hex} size={14} />
                      {s.hex} · {(s.ratio * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Alt text {altText ? '' : '(missing — will be flagged)'}</Label>
                <Input
                  className="mt-1 text-xs"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  disabled={!editable || running}
                  placeholder="Describe the image for screen readers…"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* live pillar animation */}
      <AnimatePresence>
        {running && <PillarProgress stage={stage} kind={draft.kind} />}
      </AnimatePresence>

      {/* results */}
      {result && (
        <AuditResultPanel
          result={result}
          draft={draft}
          onGoRemediate={() => {
            selectDraft(draft.id, 'remediation')
            setView('remediation')
          }}
          showRedacted={showRedacted}
          onToggleRedacted={() => setShowRedacted((s) => !s)}
        />
      )}
    </div>
  )
}

function PillarProgress({ stage, kind }: { stage: number; kind: string }) {
  const pillars: Pillar[] = ['tone', 'terminology', 'claims', 'visual', 'accessibility', 'confidentiality']
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-xl border border-terra-200 bg-terra-50/40 p-4"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-terra-800">
        <Loader2 className="h-4 w-4 animate-spin" />
        Parallel 6-pillar engine running — deterministic math & citation-gated RAG…
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {pillars.map((p, i) => {
          const state = i < stage ? 'running' : 'queued'
          return (
            <div
              key={p}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold',
                state === 'running'
                  ? 'border-terra-300 bg-paper text-terra-800'
                  : 'border-stone-200 bg-paper/60 text-stone-400'
              )}
            >
              {state === 'running' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-terra-500" />
              ) : (
                <CircleDot className="h-3.5 w-3.5 shrink-0 text-stone-300" />
              )}
              {PILLAR_META[p].short}
              {kind === 'text' && ['visual', 'accessibility'].includes(p) && (
                <span className="text-[9px] font-normal text-stone-400">(n/a)</span>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Audit result ─────────────────────────────────────────────

function AuditResultPanel({
  result,
  draft,
  onGoRemediate,
  showRedacted,
  onToggleRedacted,
}: {
  result: AuditResult
  draft: DraftDTO
  onGoRemediate: () => void
  showRedacted: boolean
  onToggleRedacted: () => void
}) {
  const verdict =
    result.score >= 85
      ? { text: 'Ready to publish', cls: 'text-olive-600' }
      : result.score >= 60
        ? { text: 'Minor fixes recommended', cls: 'text-ochre-600' }
        : { text: 'Must not ship as-is', cls: 'text-clay-600' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* score + pillars */}
      <div className="rounded-xl border border-line bg-paper p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-5">
            <ScoreRing score={result.score} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Compliance verdict
              </p>
              <p className={cn('text-xl font-bold', verdict.cls)}>{verdict.text}</p>
              <p className="mt-1 text-xs text-stone-500">
                {result.findings.length} findings ·{' '}
                {result.findings.filter((f) => f.severity === 'critical').length} critical
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-terra-200 bg-terra-50 px-2 py-1 text-[10.5px] font-semibold text-terra-700">
                  <ShieldCheck className="h-3 w-3" />
                  Zero-hallucination guard: {result.suppressed} ungrounded AI flag
                  {result.suppressed === 1 ? '' : 's'} suppressed
                </span>
                {result.aiLedger.map((l, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md border border-terra-200 bg-terra-50 px-2 py-1 text-[10.5px] font-semibold text-terra-700"
                    title={l.purpose}
                  >
                    <Cpu className="h-3 w-3" /> {l.model}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            <span className="text-[11px] text-stone-400">
              Audit of v{result.version} · {new Date(result.createdAt).toLocaleString()}
            </span>
            <Button onClick={onGoRemediate} className="bg-ink hover:bg-stone-800">
              <WandSparkles className="mr-2 h-4 w-4" />
              Open Remediation Studio
            </Button>
          </div>
        </div>

        {/* pillar grid */}
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {result.pillars.map((p) => (
            <PillarCard key={p.pillar} summary={p} />
          ))}
        </div>
      </div>

      {/* redaction preview */}
      {result.redactedPreview && draft.kind === 'text' && (
        <div className="rounded-xl border border-line bg-paper p-4">
          <button
            onClick={onToggleRedacted}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <EyeOff className="h-4 w-4 text-stone-500" />
              Confidentiality sandbox — what the AI actually received
            </span>
            <ChevronDown
              className={cn('h-4 w-4 text-stone-400 transition-transform', showRedacted && 'rotate-180')}
            />
          </button>
          {showRedacted && (
            <div className="mt-3 rounded-lg border border-stone-700 bg-ink p-3.5 font-mono text-[12px] leading-relaxed text-stone-300">
              {result.redactedPreview.split('\n').map((line, i) => (
                <p key={i} className="min-h-[1.2em] whitespace-pre-wrap">
                  {line.split(/(█+)/).map((part, j) =>
                    part.startsWith('█') ? (
                      <mark key={j} className="rounded bg-ochre-400/30 px-0.5 text-ochre-300">
                        {part}
                      </mark>
                    ) : (
                      <span key={j}>{part}</span>
                    )
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* findings */}
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-stone-500">
          Findings ({result.findings.length})
        </h3>
        <div className="space-y-2.5">
          {result.findings.length === 0 && (
            <div className="rounded-xl border border-olive-200 bg-olive-50/50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-olive-500" />
              <p className="mt-2 text-sm font-semibold text-olive-800">
                Clean across all six pillars.
              </p>
            </div>
          )}
          {result.findings.map((f) => (
            <FindingCard key={f.key} finding={f} defaultOpen={f.severity === 'critical'} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function PillarCard({ summary }: { summary: PillarSummary }) {
  const meta = PILLAR_META[summary.pillar]
  const statusIcon =
    summary.status === 'pass' ? (
      <CheckCircle2 className="h-4 w-4 text-olive-500" />
    ) : summary.status === 'skipped' ? (
      <MinusCircle className="h-4 w-4 text-stone-300" />
    ) : summary.status === 'warn' ? (
      <CircleDot className="h-4 w-4 text-ochre-500" />
    ) : (
      <XCircle className="h-4 w-4 text-clay-500" />
    )
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5',
        summary.status === 'skipped' ? 'border-stone-200 bg-parchment/60 opacity-70' : 'border-line bg-paper'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[11px] font-bold text-ink">{meta.short}</p>
        {statusIcon}
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <EngineChip engine={summary.engine} />
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-stone-400">
        {summary.status === 'skipped'
          ? meta.desc
          : `${summary.critical}C · ${summary.warning}W · ${summary.info}I · ${summary.durationMs}ms`}
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-stone-400/80">
        {summary.detail}
      </p>
    </div>
  )
}

export function FindingCard({
  finding,
  defaultOpen = false,
  actions,
}: {
  finding: Finding
  defaultOpen?: boolean
  actions?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const m = (finding.meta ?? {}) as Record<string, unknown>

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 p-3.5 text-left hover:bg-parchment/60"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex flex-col items-center gap-1">
            <SeverityChip severity={finding.severity} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-ink">
              {finding.title}
            </p>
            {finding.quote && (
              <p className="mt-1 truncate rounded-md bg-stone-100 px-2 py-1 font-mono text-[11.5px] text-stone-600">
                “{finding.quote}”
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <EngineChip engine={finding.engine} />
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-400">
                {PILLAR_META[finding.pillar].short}
              </span>
              <ClauseBadge clauseId={finding.clauseId ?? '—'} />
              {typeof m.deltaE === 'number' && (
                <span className="rounded-md bg-clay-50 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-clay-700">
                  ΔE {m.deltaE} vs {String(m.closest)} (≤5.0)
                </span>
              )}
              {typeof m.ratio === 'number' && finding.pillar === 'accessibility' && (
                <span className="rounded-md bg-clay-50 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-clay-700">
                  CR {m.ratio}:1 / req {String(m.required)}:1
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn('mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-stone-200 p-3.5">
          <p className="text-xs leading-relaxed text-stone-600">{finding.explanation}</p>

          {finding.box && (
            <p className="text-[11px] font-mono text-stone-400">
              region: x={finding.box.x}% y={finding.box.y}% w={finding.box.w}% h={finding.box.h}%
            </p>
          )}

          <CitationCard finding={finding} />

          {finding.suggestion && (
            <div className="rounded-lg border border-terra-200 bg-terra-50/50 p-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-terra-700">
                Suggested fix · {finding.suggestionSource === 'ai' ? 'AI co-pilot' : 'deterministic'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-terra-900">
                {finding.suggestion}
              </p>
            </div>
          )}

          {Array.isArray(m.alsoViolates) && m.alsoViolates.length > 0 && (
            <p className="text-[11px] text-stone-500">
              Also violates:{' '}
              {(m.alsoViolates as string[]).map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <ClauseBadge clauseId={c} />
                </span>
              ))}
            </p>
          )}

          {actions}
        </div>
      )}
    </div>
  )
}

// ── New draft dialog ─────────────────────────────────────────

function NewDraftButton() {
  const { refresh, role } = useApp()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState('LinkedIn')
  const [kind, setKind] = useState<'text' | 'image'>('text')
  const [content, setContent] = useState('')
  const [image, setImage] = useState<{ dataUrl: string; meta: ImageMeta } | null>(null)
  const [altText, setAltText] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = useCallback(async (file: File) => {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(bitmap, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86)

    // palette extraction on a 96px canvas
    const pc = document.createElement('canvas')
    const ps = Math.min(96 / w, 96 / h)
    pc.width = Math.max(1, Math.round(w * ps))
    pc.height = Math.max(1, Math.round(h * ps))
    const pctx = pc.getContext('2d')
    if (!pctx) return
    pctx.drawImage(bitmap, 0, 0, pc.width, pc.height)
    const imgData = pctx.getImageData(0, 0, pc.width, pc.height)
    const palette = extractPaletteFromPixels(
      new Uint8Array(imgData.data.buffer),
      pc.width,
      pc.height
    )

    setImage({
      dataUrl,
      meta: { palette, altText: '', width: bitmap.width, height: bitmap.height, fileName: file.name },
    })
  }, [])

  const create = async () => {
    if (!title.trim()) return
    if (kind === 'text' && !content.trim()) return
    if (kind === 'image' && !image) return
    setBusy(true)
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          channel,
          kind,
          content: kind === 'text' ? content : '',
          imageData: image?.dataUrl,
          imageMeta: image ? { ...image.meta, altText } : undefined,
          creator: roleIdentity(role).name,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      await refresh()
      toast({ title: 'Draft created', description: 'Run the 6-pillar audit when ready.' })
      setOpen(false)
      setTitle('')
      setContent('')
      setImage(null)
      setAltText('')
    } catch (err) {
      toast({ title: 'Create failed', description: String(err), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" className="bg-terra-600 hover:bg-terra-500" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> New
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto vl-scroll sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New pre-publication draft</DialogTitle>
            <DialogDescription>
              Submit the exact asset that is about to go live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <Label className="text-xs">Title</Label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Black Friday email blast" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Target channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['LinkedIn', 'Web', 'Press', 'Social', 'Email'].map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Format</Label>
                <Tabs value={kind} onValueChange={(v) => setKind(v as 'text' | 'image')}>
                  <TabsList className="mt-1 w-full">
                    <TabsTrigger value="text" className="flex-1 text-xs"><FileText className="mr-1 h-3.5 w-3.5" />Text</TabsTrigger>
                    <TabsTrigger value="image" className="flex-1 text-xs"><ImageIcon className="mr-1 h-3.5 w-3.5" />Image</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {kind === 'text' ? (
              <div>
                <Label className="text-xs">Copy</Label>
                <Textarea
                  className="mt-1 min-h-[140px] font-mono text-[13px]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the campaign copy…"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-parchment p-6 text-center transition-colors hover:border-terra-400 hover:bg-terra-50/40">
                  <Upload className="h-6 w-6 text-stone-400" />
                  <span className="mt-2 text-xs font-semibold text-stone-600">
                    {image ? image.meta.fileName : 'Upload PNG / JPG creative'}
                  </span>
                  <span className="mt-0.5 text-[10.5px] text-stone-400">
                    Palette is extracted locally in your browser
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void onFile(f)
                    }}
                  />
                </label>
                {!image && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch('/samples/banner-ai.png')
                        const blob = await res.blob()
                        await onFile(
                          new File([blob], 'banner-ai.png', { type: 'image/png' })
                        )
                      } catch {
                        toast({ title: 'Could not load the sample banner', variant: 'destructive' })
                      }
                    }}
                    className="w-full rounded-lg border border-stone-200 bg-paper px-3 py-2 text-[11px] font-semibold text-stone-600 transition-colors hover:border-terra-300 hover:text-terra-700"
                  >
                    <ImageIcon className="mr-1.5 inline h-3.5 w-3.5" />
                    Load an AI-generated sample banner instead
                  </button>
                )}
                {image && (
                  <div className="space-y-2">
                    <img src={image.dataUrl} alt="preview" className="max-h-40 rounded-lg border border-stone-200" />
                    <div className="flex flex-wrap gap-1.5">
                      {image.meta.palette.map((s) => (
                        <span key={s.hex} className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-parchment px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-stone-600">
                          <HexSwatch hex={s.hex} size={12} /> {s.hex}
                        </span>
                      ))}
                    </div>
                    <div>
                      <Label className="text-xs">Alt text (optional)</Label>
                      <Input className="mt-1 text-xs" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe the image…" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy} className="bg-terra-600 hover:bg-terra-500">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
