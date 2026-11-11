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
  History,
  RotateCcw,
  AlertTriangle,
  GitCompareArrows,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import { liveScan } from '@/lib/live-check'
import { LiveTextarea, LiveStatusStrip } from './live-editor'
import {
  auditHasEngineErrors,
  PILLAR_META,
  ROLE_META,
  type AuditResult,
  type DraftDTO,
  type Finding,
  type ImageMeta,
  type Pillar,
  type PillarSummary,
  type DraftVersionDTO,
  type VaultItemDTO,
} from '@/lib/types'
import { diffVaultSnapshot, compareAudits } from '@/lib/vault-lineage'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)
  const drafts = data?.drafts ?? []
  const vault = data?.vault ?? []
  const selected = drafts.find((d) => d.id === selectedDraftId) ?? null
  const audit = selectedDraftId ? data?.audits[selectedDraftId] : undefined

  const staleTargets = useMemo(() => {
    const list = data?.drafts ?? []
    const rules = data?.vault ?? []
    const auditMap = data?.audits ?? {}
    return list.filter((d) => {
      if (d.status === 'APPROVED' || d.status === 'IN_REVIEW') return false
      const a = auditMap[d.id]
      return Boolean(a && diffVaultSnapshot(a.vaultSnapshot, rules).isStale)
    })
  }, [data])

  const rerunAllStale = async () => {
    if (role !== 'creator' || staleTargets.length === 0 || batchProgress) return
    setBatchProgress({ done: 0, total: staleTargets.length })
    let okCount = 0
    try {
      for (let i = 0; i < staleTargets.length; i++) {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: staleTargets[i].id }),
        })
        if (res.ok) okCount++
        setBatchProgress({ done: i + 1, total: staleTargets.length })
      }
      await refresh()
      toast({
        title: `Re-audited ${okCount}/${staleTargets.length} drifted draft${staleTargets.length === 1 ? '' : 's'}`,
        description: 'Audits are now evaluated against live Brand Vault rule versions.',
      })
    } finally {
      setBatchProgress(null)
    }
  }

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
          {role === 'creator' && <NewDraftButton />}
        </div>
        {role === 'creator' && staleTargets.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={batchProgress !== null}
            onClick={() => void rerunAllStale()}
            className="w-full justify-between border-ochre-300 bg-ochre-50/70 text-xs text-ochre-900 hover:bg-ochre-100"
          >
            <span className="flex items-center gap-1.5 truncate">
              {batchProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {batchProgress
                ? `Re-auditing ${batchProgress.done}/${batchProgress.total}…`
                : `Re-audit ${staleTargets.length} stale draft${staleTargets.length === 1 ? '' : 's'}`}
            </span>
          </Button>
        )}
        <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto pr-1 vl-scroll">
          {drafts.map((d) => {
            const draftAudit = data?.audits[d.id]
            const draftIncomplete = draftAudit ? auditHasEngineErrors(draftAudit.pillars) : false
            const draftStale =
              d.status !== 'APPROVED' &&
              draftAudit &&
              diffVaultSnapshot(draftAudit.vaultSnapshot, vault).isStale
            return (
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
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5">
                <p className="text-[11px] text-stone-400">by {d.creator}</p>
                <div className="flex items-center gap-1">
                  {draftIncomplete && (
                    <span className="rounded bg-clay-100 px-1.5 py-0.5 text-[9.5px] font-bold text-clay-700">
                      Incomplete
                    </span>
                  )}
                  {!draftIncomplete && draftStale && (
                    <span className="rounded bg-ochre-100 px-1.5 py-0.5 text-[9.5px] font-bold text-ochre-800">
                      Stale rules
                    </span>
                  )}
                </div>
              </div>
            </button>
            )
          })}
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
}: {
  draft: DraftDTO
  audit: AuditResult | null
  onAuditDone: () => Promise<void>
}) {
  const { selectDraft, setView, data, role, userName, autoAuditId, setAutoAudit } = useApp()
  const canAuthor = role === 'creator'
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState(0) // 0 idle, 1..6 pillar animation
  const [result, setResult] = useState<AuditResult | null>(audit)
  const [content, setContent] = useState(draft.content)
  const [altText, setAltText] = useState(draft.imageMeta?.altText ?? '')
  const [showRedacted, setShowRedacted] = useState(false)
  const [versions, setVersions] = useState<DraftVersionDTO[]>([])
  const [auditHistory, setAuditHistory] = useState<AuditResult[]>([])
  const [inspectedAuditId, setInspectedAuditId] = useState<string | null>(null)
  const runToken = useRef(0)
  const autoRunDone = useRef<string | null>(null)

  useEffect(() => {
    setInspectedAuditId(null)
  }, [draft.id])

  useEffect(() => {
    setResult(audit)
    setContent(draft.content)
    setAltText(draft.imageMeta?.altText ?? '')
    let cancelled = false
    void Promise.all([
      fetch(`/api/drafts/${draft.id}?versions=1`, { cache: 'no-store' }).then((res) => res.ok ? res.json() : null),
      fetch(`/api/audit?draftId=${encodeURIComponent(draft.id)}&history=1`, { cache: 'no-store' }).then((res) => res.ok ? res.json() : null),
    ]).then(([detail, history]) => {
      if (cancelled) return
      if (detail) setVersions(detail.versions ?? [])
      if (history) setAuditHistory((history.audits ?? []) as AuditResult[])
    }).catch((error) => {
      console.error('[audit-studio] failed to load version history:', error)
    })
    return () => { cancelled = true }
  }, [draft.id, draft.version, draft.content, draft.imageMeta?.altText, audit])

  const displayedResult = useMemo(
    () => (inspectedAuditId ? auditHistory.find((a) => a.id === inspectedAuditId) ?? result : result),
    [inspectedAuditId, auditHistory, result]
  )

  const dirty =
    draft.kind === 'text' ? content !== draft.content : altText !== (draft.imageMeta?.altText ?? '')

  const saveEdits = async () => {
    if (!canAuthor) return false
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.kind === 'text' ? { content, actor: userName } : { altText, actor: userName }),
    })
    if (!res.ok) {
      toast({ title: 'Save failed', description: (await res.json()).error, variant: 'destructive' })
      return false
    }
    await onAuditDone()
    toast({ title: 'Draft saved', description: 'Content changed — run the audit before remediation.' })
    return true
  }

  const runAudit = async (
    options: {
      version?: number
      retryAuditId?: string
      simulateFailure?: 'tone' | 'claims' | 'vision'
    } = {}
  ) => {
    if (!canAuthor) return
    if (options.version === undefined && dirty) {
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
        body: JSON.stringify({
          draftId: draft.id,
          version: options.version,
          retryAuditId: options.retryAuditId,
          simulateFailure: options.simulateFailure,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Audit failed')
      if (token !== runToken.current) return
      clearInterval(timer)
      setStage(6)
      // small delay so the last pillar animation completes
      await new Promise((r) => setTimeout(r, 450))
      const createdAudit = body.audit as AuditResult
      setResult(createdAudit)
      setInspectedAuditId(createdAudit.id)
      setAuditHistory((history) => [createdAudit, ...history.filter((run) => run.id !== createdAudit.id)])
      await onAuditDone()
      const hasErr = auditHasEngineErrors(createdAudit.pillars)
      toast({
        title: hasErr
          ? `Audit incomplete — score ${createdAudit.score}/100 (provisional)`
          : `Audit complete — compliance score ${createdAudit.score}/100`,
        description: hasErr
          ? 'One or more checks failed. Use Retry failed checks only to recover safely.'
          : `${createdAudit.findings.length} findings · ${createdAudit.suppressed} ungrounded AI flags suppressed`,
        variant: hasErr ? 'destructive' : undefined,
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

  const editable = canAuthor && ['DRAFT', 'CHANGES_REQUESTED', 'AUDITED', 'REMEDIATED'].includes(draft.status)

  // instant client-side scan of whatever is currently in the editor
  const live = useMemo(
    () => liveScan(draft.kind === 'text' ? content : '', data?.vault ?? []),
    [content, data?.vault, draft.kind]
  )

  // a draft born in the Live Playground auto-runs the full engine on arrival
  useEffect(() => {
    if (
      canAuthor &&
      autoAuditId &&
      autoAuditId === draft.id &&
      autoRunDone.current !== draft.id &&
      draft.status === 'DRAFT'
    ) {
      autoRunDone.current = draft.id
      setAutoAudit(null)
      void runAudit()
    }
  }, [canAuthor, autoAuditId, draft.id, draft.status])

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
            {canAuthor && versions.length > 0 && auditHistory.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <History className="h-3.5 w-3.5" /> Rerun any saved draft version against current Vault rules
                </p>
                <div className="flex flex-wrap gap-2">
                  {versions.slice().sort((a, b) => b.version - a.version).map((version) => (
                    <Button
                      key={version.id}
                      variant="outline"
                      size="sm"
                      disabled={running || (draft.status === 'APPROVED' && version.version === draft.version)}
                      onClick={() => void runAudit({ version: version.version })}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Audit v{version.version}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAuthor ? (
              <>
                {dirty && editable && (
                  <Button variant="outline" size="sm" onClick={saveEdits}>
                    Save draft
                  </Button>
                )}
                <Button
                  onClick={() => void runAudit()}
                  disabled={running || draft.status === 'APPROVED' || draft.status === 'IN_REVIEW'}
                  title={
                    draft.status === 'IN_REVIEW'
                      ? 'Draft is In Review — audit an earlier version below or wait for review.'
                      : undefined
                  }
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
                {draft.status !== 'APPROVED' && draft.status !== 'IN_REVIEW' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={running}
                        title="Simulate an external AI engine timeout to verify fail-safe blocking and partial recovery"
                        className="h-9 gap-1.5 border-stone-300 bg-paper px-2.5 text-xs font-medium text-ink-soft hover:text-ink"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-ochre-600" />
                        Verify fail-safe…
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      {draft.kind === 'text' ? (
                        <>
                          <DropdownMenuItem
                            className="cursor-pointer text-xs"
                            onSelect={() => void runAudit({ simulateFailure: 'tone' })}
                          >
                            Simulate Tone AI fault (blocks approval)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-xs"
                            onSelect={() => void runAudit({ simulateFailure: 'claims' })}
                          >
                            Simulate Claims AI fault (blocks approval)
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem
                          className="cursor-pointer text-xs"
                          onSelect={() => void runAudit({ simulateFailure: 'vision' })}
                        >
                          Simulate Vision AI fault (blocks approval)
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            ) : (
              <span className="rounded-md border border-line bg-parchment px-2.5 py-1.5 text-xs font-medium text-ink-soft">
                Read-only ({ROLE_META[role].label}) — Author role runs edits &amp; audits
              </span>
            )}
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
      {displayedResult && (
        <AuditResultPanel
          result={displayedResult}
          draft={draft}
          liveVault={data?.vault ?? []}
          canAuthor={canAuthor}
          onSelectAudit={setInspectedAuditId}
          onGoRemediate={() => {
            selectDraft(draft.id, 'remediation')
            setView('remediation')
          }}
          onRetryFailed={(ver, retryId) => void runAudit({ version: ver, retryAuditId: retryId })}
          onRerunVersion={(ver) => void runAudit({ version: ver })}
          history={auditHistory}
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
  liveVault,
  canAuthor,
  onSelectAudit,
  onGoRemediate,
  showRedacted,
  onToggleRedacted,
  onRetryFailed,
  onRerunVersion,
  history,
}: {
  result: AuditResult
  draft: DraftDTO
  liveVault: VaultItemDTO[]
  canAuthor: boolean
  onSelectAudit: (id: string) => void
  onGoRemediate: () => void
  showRedacted: boolean
  onToggleRedacted: () => void
  onRetryFailed: (version: number, retryAuditId: string) => void
  onRerunVersion: (version: number) => void
  history: AuditResult[]
}) {
  const incomplete = auditHasEngineErrors(result.pillars)
  const historical = result.version !== draft.version
  const failedPillars = result.pillars.filter((pillar) => pillar.status === 'error')
  const succeededCount = result.pillars.filter((pillar) => pillar.status !== 'error').length
  const liveDrift = useMemo(
    () => diffVaultSnapshot(result.vaultSnapshot, liveVault),
    [result.vaultSnapshot, liveVault]
  )
  const olderRuns = useMemo(
    () => history.filter((r) => r.id !== result.id),
    [history, result.id]
  )
  const defaultCompareId = useMemo(() => {
    const sameVer = olderRuns.find((r) => r.version === result.version && r.createdAt < result.createdAt)
    const earlier = olderRuns.find((r) => r.createdAt < result.createdAt)
    return sameVer?.id ?? earlier?.id ?? olderRuns[0]?.id ?? ''
  }, [olderRuns, result.version, result.createdAt])
  const [customBaseline, setCustomBaseline] = useState<{ resultId: string; id: string } | null>(null)
  const effectiveBaselineId =
    customBaseline?.resultId === result.id && olderRuns.some((r) => r.id === customBaseline.id)
      ? customBaseline.id
      : defaultCompareId
  const baselineRun = olderRuns.find((r) => r.id === effectiveBaselineId) ?? null
  const impact = useMemo(
    () => (baselineRun ? compareAudits(baselineRun, result) : null),
    [baselineRun, result]
  )
  const driftedClauseIds = useMemo(
    () =>
      new Set([
        ...liveDrift.updated.map((u) => u.clauseId),
        ...liveDrift.removed.map((r) => r.clauseId),
      ]),
    [liveDrift]
  )
  const canRerunThisVersion =
    canAuthor &&
    !(draft.status === 'APPROVED' && result.version === draft.version) &&
    !(draft.status === 'IN_REVIEW' && result.version === draft.version)

  const verdict = incomplete
    ? { text: 'Audit incomplete — rerun checks', cls: 'text-clay-600' }
    : result.score >= 85
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
      {/* run history selector when multiple audits exist */}
      {history.length > 1 && (
        <div className="rounded-xl border border-line bg-paper p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
            <History className="h-3.5 w-3.5" /> Audit runs recorded for this draft ({history.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((run) => {
              const runIncomplete = auditHasEngineErrors(run.pillars)
              const active = run.id === result.id
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => onSelectAudit(run.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                    active
                      ? 'border-terra-400 bg-terra-50 font-semibold text-terra-800'
                      : 'border-line bg-parchment/60 text-ink-soft hover:border-stone-300 hover:text-ink'
                  )}
                >
                  <span>v{run.version}</span>
                  <span className="tabular-nums font-bold">{run.score}/100</span>
                  {runIncomplete && (
                    <span className="rounded bg-clay-100 px-1 py-0.5 text-[9.5px] font-bold text-clay-700">
                      Incomplete
                    </span>
                  )}
                  <span className="text-[10px] text-faint">
                    {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* score + pillars */}
      <div className="rounded-xl border border-line bg-paper p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col items-center">
            <ScoreRing score={result.score} />
            {incomplete && (
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-clay-700">
                Provisional
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Compliance verdict
            </p>
            <p className={cn('text-xl font-bold', verdict.cls)}>{verdict.text}</p>
            {incomplete && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-clay-300 bg-clay-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-clay-700">
                Incomplete · {succeededCount}/6 verified · {failedPillars.length} failed
              </span>
            )}
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
          <div className="ml-auto flex flex-col items-end gap-2">
            <span className="text-[11px] text-stone-400">
              Audit of v{result.version} · {new Date(result.createdAt).toLocaleString()}
            </span>
            <Button
              onClick={onGoRemediate}
              disabled={incomplete || historical}
              title={historical ? 'Historical audits are read-only; inspect or audit the current version to remediate.' : incomplete ? 'Recover the failed checks before remediation or review.' : undefined}
              className="bg-ink hover:bg-stone-800"
            >
              <WandSparkles className="mr-2 h-4 w-4" />
              {historical
                ? 'Historical audit — read only'
                : incomplete
                  ? 'Audit incomplete — blocked'
                  : canAuthor
                    ? 'Open Remediation Studio'
                    : 'Inspect Findings Queue'}
            </Button>
          </div>
        </div>

        {incomplete && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-clay-300 bg-clay-50 p-4 text-sm text-clay-800"
          >
            <p className="font-semibold">
              This audit is incomplete and cannot be treated as clean, remediated, or approved.
            </p>
            <p className="mt-0.5 text-xs text-clay-700">
              {succeededCount} check{succeededCount === 1 ? '' : 's'} finished cleanly; {failedPillars.length} check{failedPillars.length === 1 ? '' : 's'} failed and must be recovered:
            </p>
            <ul className="mt-2 list-inside list-disc text-xs">
              {failedPillars.map((pillar) => (
                <li key={pillar.pillar}>
                  <strong>{PILLAR_META[pillar.pillar].short}:</strong> {pillar.detail}
                </li>
              ))}
            </ul>
            {canAuthor ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-clay-700 text-cream hover:bg-clay-600"
                  onClick={() => onRetryFailed(result.version, result.id)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {liveDrift.isStale ? 'Rerun full audit (Vault changed)' : 'Retry failed checks only'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-clay-300 bg-paper text-clay-800 hover:bg-clay-100"
                  onClick={() => onRerunVersion(result.version)}
                >
                  Run full 6-pillar rerun
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs font-medium text-clay-700">
                An Author must recover the failed checks before this draft can move forward.
              </p>
            )}
          </div>
        )}

        {/* pillar grid */}
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {result.pillars.map((p) => (
            <PillarCard key={p.pillar} summary={p} />
          ))}
        </div>
      </div>

      <VaultLineage
        result={result}
        history={history}
        liveDrift={liveDrift}
        canRerun={canRerunThisVersion}
        onRerun={() => onRerunVersion(result.version)}
      />

      {olderRuns.length > 0 && impact && baselineRun && (
        <div className="rounded-xl border border-line bg-paper p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <GitCompareArrows className="h-4 w-4 text-terra-600" />
              Policy &amp; version impact diff
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-faint">Baseline:</span>
              <Select value={baselineRun.id} onValueChange={(id) => setCustomBaseline({ resultId: result.id, id })}>
                <SelectTrigger className="h-8 w-56 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {olderRuns.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">
                      v{r.version} · {r.score}/100 · {new Date(r.createdAt).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-line bg-parchment/60 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Score change</p>
              <p
                className={cn(
                  'mt-0.5 text-base font-bold tabular-nums',
                  impact.scoreDelta > 0 ? 'text-olive-700' : impact.scoreDelta < 0 ? 'text-clay-700' : 'text-ink'
                )}
              >
                {impact.scoreDelta > 0 ? `+${impact.scoreDelta}` : impact.scoreDelta} pts
              </p>
            </div>
            <div className="rounded-lg border border-line bg-parchment/60 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Rules changed</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-ink">{impact.ruleChanges.length}</p>
            </div>
            <div className="rounded-lg border border-line bg-parchment/60 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Newly flagged</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-clay-700">+{impact.addedFindings.length}</p>
            </div>
            <div className="rounded-lg border border-line bg-parchment/60 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Resolved</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-olive-700">-{impact.resolvedFindings.length}</p>
            </div>
          </div>
          {(impact.addedFindings.length > 0 || impact.resolvedFindings.length > 0 || impact.ruleChanges.length > 0) && (
            <div className="mt-3 space-y-3">
              {impact.ruleChanges.length > 0 && (
                <div className="rounded-lg border border-ochre-200 bg-ochre-50/60 p-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-ochre-800">
                    Rule version changes between audits ({impact.ruleChanges.length})
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {impact.ruleChanges.map((rc) => (
                      <span
                        key={rc.clauseId}
                        className="inline-flex items-center gap-1 rounded-md border border-ochre-300 bg-paper px-2 py-0.5 font-mono text-[10.5px] font-semibold text-ochre-900"
                      >
                        {rc.clauseId}:{' '}
                        {rc.removed
                          ? `v${rc.fromVer} → archived`
                          : rc.fromVer === null
                            ? `added at v${rc.toVer}`
                            : `v${rc.fromVer} → v${rc.toVer}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-clay-200 bg-clay-50/40 p-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-clay-700">
                  Added in this audit ({impact.addedFindings.length})
                </p>
                {impact.addedFindings.length === 0 ? (
                  <p className="mt-1 text-xs text-faint">None</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
                    {impact.addedFindings.map((f) => (
                      <li key={f.key} className="truncate">
                        <span className="font-mono text-[10px] text-clay-700">{f.clauseId ?? '—'}</span> · {f.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-olive-200 bg-olive-50/40 p-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-olive-700">
                  Cleared since baseline ({impact.resolvedFindings.length})
                </p>
                {impact.resolvedFindings.length === 0 ? (
                  <p className="mt-1 text-xs text-faint">None</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
                    {impact.resolvedFindings.map((f) => (
                      <li key={f.key} className="truncate">
                        <span className="font-mono text-[10px] text-olive-700">{f.clauseId ?? '—'}</span> · {f.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </div>
            </div>
          )}
        </div>
      )}

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
          {result.findings.length === 0 && !incomplete && (
            <div className="rounded-xl border border-olive-200 bg-olive-50/50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-olive-500" />
              <p className="mt-2 text-sm font-semibold text-olive-800">
                Clean across all applicable checks.
              </p>
            </div>
          )}
          {result.findings.length === 0 && incomplete && (
            <div className="rounded-xl border border-clay-200 bg-clay-50/50 p-6 text-center">
              <XCircle className="mx-auto h-8 w-8 text-clay-500" />
              <p className="mt-2 text-sm font-semibold text-clay-800">
                No findings were produced because one or more checks failed.
              </p>
            </div>
          )}
          {result.findings.map((f) => (
            <FindingCard
              key={f.key}
              finding={f}
              defaultOpen={f.severity === 'critical'}
              isRuleUpdated={Boolean(f.clauseId && driftedClauseIds.has(f.clauseId))}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function VaultLineage({
  result,
  history,
  liveDrift,
  canRerun,
  onRerun,
}: {
  result: AuditResult
  history: AuditResult[]
  liveDrift: ReturnType<typeof diffVaultSnapshot>
  canRerun: boolean
  onRerun: () => void
}) {
  const previous = history
    .filter((run) => run.id !== result.id && run.createdAt < result.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const previousRules = new Map((previous?.vaultSnapshot ?? []).map((rule) => [rule.clauseId, rule.ruleVer]))
  const changes = result.vaultSnapshot.filter((rule) => previousRules.get(rule.clauseId) !== rule.ruleVer)
  const removed = (previous?.vaultSnapshot ?? []).filter(
    (rule) => !result.vaultSnapshot.some((current) => current.clauseId === rule.clauseId)
  )

  return (
    <div className="rounded-xl border border-line bg-paper p-4 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink">Vault rule lineage</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            This audit evaluated {result.vaultSnapshot.length} active Vault rule version(s).
            {previous ? ` Compared with prior audit of v${previous.version}.` : ' This is the first recorded audit.'}
          </p>
        </div>
        {liveDrift.isStale && canRerun && (
          <Button size="sm" variant="outline" className="h-8 border-ochre-300 bg-ochre-50 text-xs text-ochre-900 hover:bg-ochre-100" onClick={onRerun}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Re-audit v{result.version} under live rules
          </Button>
        )}
      </div>

      {liveDrift.isStale && (
        <div className="rounded-lg border border-ochre-300 bg-ochre-50/70 p-3 text-xs text-ochre-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-ochre-600" />
            Vault rules changed since this audit ran ({liveDrift.staleCount} difference{liveDrift.staleCount === 1 ? '' : 's'} vs live Vault)
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[11px]">
            {liveDrift.updated.map((u) => (
              <li key={u.clauseId}>
                <code>{u.clauseId}</code> ({u.title}): audited v{u.auditedVer} → live v{u.liveVer}
              </li>
            ))}
            {liveDrift.added.map((a) => (
              <li key={a.clauseId}>
                <code>{a.clauseId}</code> ({a.title}): new rule added at v{a.liveVer}
              </li>
            ))}
            {liveDrift.removed.map((r) => (
              <li key={r.clauseId}>
                <code>{r.clauseId}</code>: audited v{r.auditedVer} → archived in live Vault
              </li>
            ))}
          </ul>
        </div>
      )}

      {previous && (changes.length > 0 || removed.length > 0) ? (
        <ul className="space-y-1 text-xs text-ink-soft">
          {changes.map((rule) => (
            <li key={rule.clauseId}>{rule.clauseId}: {previousRules.has(rule.clauseId) ? `v${previousRules.get(rule.clauseId)}` : 'new'} → v{rule.ruleVer}</li>
          ))}
          {removed.map((rule) => <li key={rule.clauseId}>{rule.clauseId}: v{rule.ruleVer} → inactive/removed</li>)}
        </ul>
      ) : previous ? (
        <p className="text-xs text-olive-700">No rule version differences vs the preceding audit run.</p>
      ) : null}
      <details>
        <summary className="cursor-pointer text-xs font-medium text-terra-700">
          Show all {result.vaultSnapshot.length} rule versions captured in this audit
        </summary>
        <ul className="mt-2 grid gap-1 text-[11px] text-ink-soft sm:grid-cols-2">
          {result.vaultSnapshot.map((rule) => (
            <li key={rule.clauseId}>{rule.clauseId} · v{rule.ruleVer}</li>
          ))}
        </ul>
      </details>
    </div>
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
        {summary.status === 'error'
          ? 'CHECK FAILED'
          : summary.status === 'skipped'
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
  isRuleUpdated = false,
  actions,
}: {
  finding: Finding
  defaultOpen?: boolean
  isRuleUpdated?: boolean
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
              {isRuleUpdated && (
                <span className="rounded-md border border-ochre-300 bg-ochre-50 px-1.5 py-0.5 text-[10px] font-semibold text-ochre-800">
                  Rule updated in live Vault
                </span>
              )}
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
  const { refresh, userName } = useApp()
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
          creator: userName,
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
