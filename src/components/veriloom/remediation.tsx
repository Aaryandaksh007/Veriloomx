'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Explainable Remediation Studio
// Highlighted spans, cited clauses, intent-preserving rewrites,
// and Human Override with Justification.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  WandSparkles,
  Check,
  Undo2,
  PencilLine,
  ShieldQuestion,
  Sparkles,
  Loader2,
  FileText,
  ImageIcon,
  Layers,
  BadgeCheck,
  ArrowRight,
} from 'lucide-react'
import { useApp, roleIdentity } from '@/lib/store'
import type {
  AuditResult,
  DraftDTO,
  Finding,
  FindingActionDTO,
} from '@/lib/types'
import { PILLAR_META } from '@/lib/types'
import { CitationCard, SeverityChip, StatusChip, ClauseBadge, ViewHeader } from './shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface DraftDetail {
  draft: DraftDTO
  audits: (AuditResult & { actions: FindingActionDTO[] })[]
}

export function RemediationView() {
  const { data, selectedDraftId, selectDraft, refresh, role } = useApp()
  const drafts = (data?.drafts ?? []).filter((d) => d.status !== 'APPROVED' || true)
  const selected = drafts.find((d) => d.id === selectedDraftId) ?? null
  const [detail, setDetail] = useState<DraftDetail | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    const load = async () => {
      const res = await fetch(`/api/drafts/${selected.id}`, { cache: 'no-store' })
      if (!res.ok || cancelled) return
      const body = (await res.json()) as DraftDetail
      if (!cancelled) setDetail(body)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selected?.id, selected?.version, selected?.status, data?.drafts.length])

  const audit = detail?.audits[0] ?? null
  const actionsBy = useMemo(
    () => new Map((audit?.actions ?? []).map((a) => [a.findingKey, a])),
    [audit]
  )
  const findings = audit?.findings ?? []
  const resolved = findings.filter((f) => actionsBy.has(f.key)).length
  const allResolved = findings.length > 0 && resolved === findings.length

  const reload = async () => {
    if (!selected) return
    const res = await fetch(`/api/drafts/${selected.id}`, { cache: 'no-store' })
    if (res.ok) setDetail((await res.json()) as DraftDetail)
    await refresh()
  }

  return (
    <div className="space-y-5">
      <ViewHeader
        crumb="Remediation"
        title="Explainable Remediation"
        subtitle="Every flag cites its clause. Accept the surgical fix — or override it with a written justification that feeds the Blindspot Engine."
      />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
      {/* draft list */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">Drafts</h2>
        <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto pr-1 vl-scroll">
          {drafts.map((d) => {
            const a = data?.audits[d.id]
            const total = a?.findings.length ?? 0
            return (
              <button
                key={d.id}
                onClick={() => selectDraft(d.id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-colors',
                  d.id === selected?.id
                    ? 'border-terra-300 bg-terra-50/60 ring-1 ring-terra-200'
                    : 'border-stone-200 bg-paper hover:border-stone-300'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500">
                    {d.kind === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    v{d.version}
                  </span>
                  <StatusChip status={d.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
                  {d.title}
                </p>
                {a && total > 0 && (
                  <p className="mt-0.5 text-[11px] text-stone-400">{total} findings · score {a.score}</p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* document view */}
      <div>
        {!selected || !audit ? (
          <div className="flex h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-paper/60 text-center">
            <WandSparkles className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-600">Nothing to remediate yet</p>
            <p className="mt-1 max-w-sm text-xs text-stone-400">
              Select a draft that has been audited. Run an audit first from the Audit Studio.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* progress header */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-serif text-lg font-semibold tracking-tight text-ink">
                    {selected.title}
                  </h1>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Audit v{audit.version} · score {audit.score}/100 · {audit.suppressed} ungrounded
                    AI flags never reached you
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                      Resolved
                    </p>
                    <p className="text-lg font-bold tabular-nums text-ink">
                      {resolved}
                      <span className="text-stone-400">/{findings.length}</span>
                    </p>
                  </div>
                  <RemediateButton
                    draftId={selected.id}
                    auditId={audit.id}
                    disabled={!allResolved}
                    onDone={reload}
                    actor={roleIdentity(role).name}
                  />
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <motion.div
                  className="h-full rounded-full bg-terra-500"
                  animate={{ width: `${findings.length ? (resolved / findings.length) * 100 : 0}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
            </div>

            {/* document */}
            {selected.kind === 'text' ? (
              <div className="rounded-xl border border-line bg-paper p-5">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  <Layers className="h-3.5 w-3.5" /> Document · flags highlighted
                </p>
                <HighlightedText
                  text={selected.content}
                  findings={findings}
                  actionsBy={actionsBy}
                  activeKey={activeKey}
                  onSelect={setActiveKey}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-paper p-5">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  <Layers className="h-3.5 w-3.5" /> Asset · flagged regions boxed
                </p>
                {selected.imageData && (
                  <div className="relative inline-block">
                    <img src={selected.imageData} alt={selected.title} className="max-w-full rounded-lg border border-stone-200" />
                    {findings
                      .filter((f) => f.box)
                      .map((f) => {
                        const done = actionsBy.has(f.key)
                        // clamp VLM-sampled regions to the image bounds
                        const x = Math.max(0, Math.min(f.box!.x, 100))
                        const y = Math.max(0, Math.min(f.box!.y, 100))
                        const w = Math.max(1, Math.min(f.box!.w, 100 - x))
                        const h = Math.max(1, Math.min(f.box!.h, 100 - y))
                        return (
                          <button
                            key={f.key}
                            onClick={() => setActiveKey(f.key)}
                            className={cn(
                              'absolute rounded-md border-2 transition-all',
                              activeKey === f.key
                                ? 'border-clay-500 ring-2 ring-clay-300'
                                : 'border-clay-400/80 hover:border-clay-500',
                              done && 'border-olive-400 opacity-60'
                            )}
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              width: `${w}%`,
                              height: `${h}%`,
                            }}
                            title={f.title}
                          >
                            <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-clay-500 text-[10px] font-bold text-cream">
                              {done ? '✓' : '!'}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-stone-400">
                  Bounding boxes come from VLM region sampling; the pass/fail verdict is
                  computed with exact WCAG 2.1 luminance math.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* findings queue */}
      {selected && audit && (
        <div className="max-h-[calc(100vh-190px)] space-y-2.5 overflow-y-auto pr-1 vl-scroll">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
            Findings queue
          </h2>
          {findings.map((f) => (
            <QueuedFinding
              key={f.key}
              finding={f}
              action={actionsBy.get(f.key) ?? null}
              active={activeKey === f.key}
              auditId={audit.id}
              onActivate={() => setActiveKey(f.key)}
              onChanged={reload}
            />
          ))}
          {findings.length === 0 && (
            <div className="rounded-xl border border-olive-200 bg-olive-50/60 p-5 text-center">
              <BadgeCheck className="mx-auto h-7 w-7 text-olive-500" />
              <p className="mt-2 text-xs font-semibold text-olive-800">
                Zero findings — this draft was clean.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  )
}

// ── highlighted document ─────────────────────────────────────

function HighlightedText({
  text,
  findings,
  actionsBy,
  activeKey,
  onSelect,
}: {
  text: string
  findings: Finding[]
  actionsBy: Map<string, FindingActionDTO>
  activeKey: string | null
  onSelect: (key: string) => void
}) {
  const segments = useMemo(() => {
    const marks: { start: number; end: number; finding: Finding }[] = []
    const lower = text.toLowerCase()
    for (const f of findings) {
      if (!f.quote) continue
      const idx = lower.indexOf(f.quote.toLowerCase())
      if (idx === -1) continue
      const end = idx + f.quote.length
      // skip overlaps
      if (marks.some((m) => idx < m.end && end > m.start)) continue
      marks.push({ start: idx, end, finding: f })
    }
    marks.sort((a, b) => a.start - b.start)

    const out: { text: string; finding?: Finding }[] = []
    let pos = 0
    for (const m of marks) {
      if (m.start > pos) out.push({ text: text.slice(pos, m.start) })
      out.push({ text: text.slice(m.start, m.end), finding: m.finding })
      pos = m.end
    }
    if (pos < text.length) out.push({ text: text.slice(pos) })
    return out
  }, [text, findings])

  return (
    <div className="whitespace-pre-wrap text-[13.5px] leading-[1.9] text-ink">
      {segments.map((seg, i) =>
        seg.finding ? (
          <mark
            key={i}
            onClick={() => onSelect(seg.finding!.key)}
            className={cn(
              'vl-hl',
              seg.finding.severity === 'critical' && 'vl-hl-critical',
              seg.finding.severity === 'warning' && 'vl-hl-warning',
              seg.finding.severity === 'info' && 'vl-hl-info',
              activeKey === seg.finding.key && 'outline outline-2 outline-offset-1 outline-ink',
              actionsBy.has(seg.finding.key) && 'vl-hl-info opacity-60'
            )}
          >
            {seg.text}
            <sup className="ml-0.5 font-mono text-[9px] font-bold text-stone-600">
              {actionsBy.has(seg.finding.key) ? '✓' : '!'}
            </sup>
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  )
}

// ── queued finding card ──────────────────────────────────────

function QueuedFinding({
  finding,
  action,
  active,
  auditId,
  onActivate,
  onChanged,
}: {
  finding: Finding
  action: FindingActionDTO | null
  active: boolean
  auditId: string
  onActivate: () => void
  onChanged: () => Promise<void>
}) {
  const { role } = useApp()
  const [busy, setBusy] = useState(false)
  const [rewrite, setRewrite] = useState<{ rewrite: string; intentNotes: string | null } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [overrideOpen, setOverrideOpen] = useState(false)

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch('/api/findings/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId,
          findingKey: finding.key,
          actor: roleIdentity(role).name,
          actorRole: role,
          ...payload,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      await onChanged()
      return true
    } catch (err) {
      toast({ title: 'Action failed', description: String(err), variant: 'destructive' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/findings/action', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId, findingKey: finding.key }),
      })
      if (!res.ok) throw new Error('undo failed')
      await onChanged()
    } catch {
      toast({ title: 'Undo failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      layout
      onClick={onActivate}
      className={cn(
        'cursor-pointer rounded-xl border bg-paper p-3 transition-colors',
        active ? 'border-stone-400 ring-1 ring-stone-300' : 'border-line',
        action && 'opacity-90'
      )}
    >
      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        onSubmit={async (note) => post({ action: 'overridden', note })}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <SeverityChip severity={finding.severity} />
            <span className="font-mono text-[10px] font-bold text-stone-400">{finding.key}</span>
          </div>
          <p className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">
            {finding.title}
          </p>
        </div>
        {action && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-olive-50 px-2 py-0.5 text-[10px] font-bold text-olive-700">
            <Check className="h-3 w-3" />
            {action.action.toUpperCase()}
          </span>
        )}
      </div>

      {finding.quote && (
        <p className="mt-1.5 rounded-md bg-stone-100 px-2 py-1 font-mono text-[11px] leading-snug text-stone-600">
          “{finding.quote}”
        </p>
      )}

      {!action ? (
        <div className="mt-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1.5">
            {finding.suggestion && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => post({ action: 'accepted', appliedText: finding.suggestion })}
                className="h-7 bg-terra-600 px-2.5 text-[11px] hover:bg-terra-500"
              >
                <Check className="mr-1 h-3 w-3" />
                Accept {finding.suggestionSource === 'ai' ? 'AI fix' : 'fix'}
              </Button>
            )}
            {finding.quote && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const res = await fetch('/api/rewrite', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ auditId, findingKey: finding.key }),
                    })
                    const body = await res.json()
                    if (!res.ok) throw new Error(body.error)
                    setRewrite(body)
                  } catch (err) {
                    toast({ title: 'Co-pilot unavailable', description: String(err), variant: 'destructive' })
                  } finally {
                    setBusy(false)
                  }
                }}
                className="h-7 px-2.5 text-[11px]"
              >
                {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                Intent-preserving rewrite
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setEditText(finding.suggestion ?? finding.quote)
                setEditing(true)
              }}
              className="h-7 px-2.5 text-[11px]"
            >
              <PencilLine className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setOverrideOpen(true)}
              className="h-7 border-ochre-300 px-2.5 text-[11px] text-ochre-700 hover:bg-ochre-50"
            >
              <ShieldQuestion className="mr-1 h-3 w-3" /> Override
            </Button>
          </div>

          {rewrite && (
            <div className="rounded-lg border border-terra-200 bg-terra-50/60 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-terra-700">
                Co-pilot rewrite · minimal diff, intent preserved
              </p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-terra-900">
                “{rewrite.rewrite}”
              </p>
              {rewrite.intentNotes && (
                <p className="mt-1 text-[10.5px] italic text-terra-700/80">
                  {rewrite.intentNotes}
                </p>
              )}
              <div className="mt-2 flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 bg-terra-600 px-2.5 text-[11px] hover:bg-terra-500"
                  disabled={busy}
                  onClick={() => post({ action: 'accepted', appliedText: rewrite.rewrite })}
                >
                  <Check className="mr-1 h-3 w-3" /> Use rewrite
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setRewrite(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {editing && (
            <div className="rounded-lg border border-stone-200 bg-parchment p-2.5">
              <Textarea
                className="min-h-[70px] text-xs"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Write the replacement span…"
              />
              <div className="mt-1.5 flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 bg-ink px-2.5 text-[11px] hover:bg-stone-800"
                  disabled={busy}
                  onClick={async () => {
                    if (await post({ action: 'edited', appliedText: editText })) setEditing(false)
                  }}
                >
                  Save edit
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="rounded-lg border border-stone-200 bg-parchment p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              {action.action === 'overridden' ? 'Human override — original kept' : 'Replacement'}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-stone-700">
              {action.action === 'overridden'
                ? `“${action.note ?? ''}”`
                : `“${finding.quote}” → “${action.appliedText}”`}
            </p>
          </div>
          <button
            onClick={undo}
            disabled={busy}
            className="flex items-center gap-1 text-[10.5px] font-semibold text-stone-400 hover:text-stone-700"
          >
            <Undo2 className="h-3 w-3" /> revise decision
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ── override dialog ──────────────────────────────────────────

export function OverrideDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (note: string) => Promise<boolean>
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Human Override — Keep Original</DialogTitle>
          <DialogDescription>
            Automation supports rather than overrides human judgment. Your justification is
            recorded in the audit trail, shown to the reviewer, and fed to the Guideline
            Blindspot Engine.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-[90px] text-xs"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why should this flag be waived? (min 15 characters)"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-ochre-600 hover:bg-ochre-500"
            disabled={busy || note.trim().length < 15}
            onClick={async () => {
              setBusy(true)
              const ok = await onSubmit(note.trim())
              setBusy(false)
              if (ok) {
                setNote('')
                onOpenChange(false)
              }
            }}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldQuestion className="mr-2 h-4 w-4" />}
            Log override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── remediate button ─────────────────────────────────────────

function RemediateButton({
  draftId,
  auditId,
  disabled,
  onDone,
  actor,
}: {
  draftId: string
  auditId: string
  disabled: boolean
  onDone: () => Promise<void>
  actor: string
}) {
  const [busy, setBusy] = useState(false)
  const { setView } = useApp()
  return (
    <Button
      disabled={disabled || busy}
      className="bg-terra-600 hover:bg-terra-500"
      onClick={async () => {
        setBusy(true)
        try {
          const res = await fetch('/api/remediate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draftId, auditId, actor }),
          })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error)
          await onDone()
          toast({
            title: `Remediated version v${body.version} created`,
            description: `${body.applied} fixes applied · ${body.overrides} override(s) preserved`,
          })
          setView('review')
        } catch (err) {
          toast({ title: 'Remediation failed', description: String(err), variant: 'destructive' })
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
      {disabled ? 'Resolve all findings first' : 'Create remediated version'}
    </Button>
  )
}

export { ClauseBadge, PILLAR_META }
