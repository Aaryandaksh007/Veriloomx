'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Living Brand Vault manager
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  Type,
  CalendarClock,
  Palette,
  Image as ImageIcon,
  Lock,
  Scale,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import type { VaultItemDTO } from '@/lib/types'
import { computeVaultBlastRadius, type ClauseBlastDraft } from '@/lib/vault-lineage'
import { wordDiff } from '@/lib/diff'
import { ClauseBadge, HexSwatch, timeAgo, ViewHeader } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const TYPE_META: Record<
  VaultItemDTO['type'],
  { label: string; icon: React.ComponentType<{ className?: string }>; chip: string }
> = {
  VOICE: { label: 'Tone & Voice', icon: Type, chip: 'bg-terra-50 text-terra-700 border-terra-200' },
  FACT: { label: 'Verified Facts', icon: CalendarClock, chip: 'bg-olive-50 text-olive-700 border-olive-200' },
  TERM: { label: 'Terminology', icon: ArrowRight, chip: 'bg-stone-100 text-stone-600 border-stone-300' },
  COLOR: { label: 'Colour Palette', icon: Palette, chip: 'bg-ochre-50 text-ochre-700 border-ochre-200' },
  LOGO: { label: 'Logo & Assets', icon: ImageIcon, chip: 'bg-terra-100 text-terra-800 border-terra-200' },
  CONFIDENTIAL: { label: 'Confidential', icon: Lock, chip: 'bg-clay-50 text-clay-700 border-clay-200' },
  RULE: { label: 'Governance Rules', icon: Scale, chip: 'bg-ink text-cream border-stone-700' },
}

type TabKey = 'ALL' | VaultItemDTO['type']

export function VaultView() {
  const { data, refresh, role, selectDraft } = useApp()
  const [tab, setTab] = useState<TabKey>('ALL')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<VaultItemDTO | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<VaultItemDTO | null>(null)
  const [blastClause, setBlastClause] = useState<VaultItemDTO | null>(null)

  const blast = useMemo(
    () =>
      computeVaultBlastRadius(
        data?.drafts ?? [],
        data?.audits ?? {},
        data?.vault ?? []
      ),
    [data]
  )

  const staleDraftObjects = useMemo(() => {
    const idSet = new Set(blast.staleDraftIds)
    return (data?.drafts ?? []).filter((d) => idSet.has(d.id))
  }, [data, blast.staleDraftIds])

  const items = useMemo(() => {
    let list = data?.vault ?? []
    if (tab !== 'ALL') list = list.filter((v) => v.type === tab)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.content.toLowerCase().includes(q) ||
          v.clauseId.toLowerCase().includes(q)
      )
    }
    return list
  }, [data, tab, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data?.vault.length ?? 0 }
    for (const v of data?.vault ?? []) c[v.type] = (c[v.type] ?? 0) + 1
    return c
  }, [data])

  return (
    <div className="space-y-4">
      <ViewHeader
        crumb="Brand Vault"
        title="Living Brand Vault"
        subtitle="The single source of truth. Every audit finding must cite one of these clauses — anything else is suppressed by the zero-hallucination guard."
        showDraftChip={false}
        actions={role === 'admin' ? (
          <Button onClick={() => setCreating(true)} className="bg-terra-600 hover:bg-terra-500">
            <Plus className="mr-1.5 h-4 w-4" /> Add clause
          </Button>
        ) : undefined}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="h-9 max-w-full flex-nowrap overflow-x-auto vl-scroll sm:flex-wrap sm:overflow-visible">
            {(['ALL', 'VOICE', 'FACT', 'TERM', 'COLOR', 'LOGO', 'CONFIDENTIAL', 'RULE'] as TabKey[]).map(
              (k) => (
                <TabsTrigger key={k} value={k} className="shrink-0 text-xs">
                  {k === 'ALL' ? 'All' : TYPE_META[k].label}
                  <span className="ml-1 rounded-full bg-stone-200 px-1.5 text-[10px] font-semibold text-stone-600">
                    {counts[k] ?? 0}
                  </span>
                </TabsTrigger>
              )
            )}
          </TabsList>
        </Tabs>
        <div className="relative sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clauses…"
            className="h-9 w-full border-line pl-8 text-xs sm:w-56"
          />
        </div>
      </div>

      {blast.staleDraftIds.length > 0 && (
        <div className="space-y-2.5 rounded-xl border border-ochre-300 bg-ochre-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs text-ochre-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-ochre-600" />
              <span>
                <strong>Policy drift detected:</strong> {blast.staleDraftIds.length} in-flight draft
                {blast.staleDraftIds.length === 1 ? ' was' : 's were'} audited against older rule versions.
              </span>
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-ochre-300 bg-paper text-xs text-ochre-800 hover:bg-ochre-100"
              onClick={() => selectDraft(staleDraftObjects[0]?.id ?? null, 'audit')}
            >
              Inspect &amp; rerun in Audit Studio
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {staleDraftObjects.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDraft(d.id, 'audit')}
                className="inline-flex items-center gap-1 rounded-full border border-ochre-300 bg-paper px-2.5 py-0.5 text-[11px] font-medium text-ochre-900 transition-colors hover:border-terra-400 hover:text-terra-700"
              >
                <span className="max-w-[200px] truncate">{d.title}</span>
                <span className="text-[10px] text-faint">v{d.version}</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <VaultCard
            key={item.id}
            item={item}
            affectedDrafts={blast.byClause[item.clauseId] ?? []}
            onInspectBlast={() => setBlastClause(item)}
            onEdit={() => setEditing(item)}
            onDelete={() => setDeleting(item)}
          />
        ))}
        {items.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-faint">
            No clauses match this filter.
          </div>
        )}
      </div>

      <ClauseDialog
        open={creating || editing !== null}
        item={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={async () => {
          await refresh()
          toast({ title: 'Vault updated', description: 'The clause is live for all future audits.' })
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {deleting?.clauseId}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” will be excluded from future audits. Existing audit citations
              and the full rule history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-clay-600 hover:bg-clay-500"
              onClick={async () => {
                if (deleting) {
                  await fetch(`/api/vault/${deleting.id}`, { method: 'DELETE' })
                  await refresh()
                  toast({ title: 'Clause archived', description: 'Rule history has been preserved.' })
                }
                setDeleting(null)
              }}
            >
              Archive clause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={blastClause !== null} onOpenChange={(o) => !o && setBlastClause(null)}>
        <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Policy blast radius — {blastClause?.clauseId}</DialogTitle>
            <DialogDescription>
              In-flight drafts audited before the latest change to “{blastClause?.title}”. Open any draft in Audit Studio to evaluate the updated rule and compare score &amp; findings diff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {(blastClause ? blast.byClause[blastClause.clauseId] ?? [] : []).map((entry) => (
              <div
                key={entry.draftId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{entry.draftTitle}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    Draft v{entry.draftVersion} ({entry.draftStatus}) · last score {entry.auditScore}/100 ·{' '}
                    {entry.changeKind === 'updated'
                      ? `audited rule v${entry.auditedVer} → live v${entry.liveVer}`
                      : entry.changeKind === 'added'
                        ? `new rule added at v${entry.liveVer}`
                        : `archived since audited v${entry.auditedVer}`}
                    {entry.citedFindingsCount > 0 ? ` · ${entry.citedFindingsCount} finding(s) cited this clause` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 shrink-0 bg-terra-600 px-2.5 text-[11px] hover:bg-terra-500"
                  onClick={() => {
                    setBlastClause(null)
                    selectDraft(entry.draftId, 'audit')
                  }}
                >
                  Open &amp; rerun <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VaultCard({
  item,
  affectedDrafts,
  onInspectBlast,
  onEdit,
  onDelete,
}: {
  item: VaultItemDTO
  affectedDrafts: ClauseBlastDraft[]
  onInspectBlast: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { refresh, role } = useApp()
  const meta = TYPE_META[item.type]
  const extra = (item.extra ?? {}) as Record<string, unknown>
  const [busy, setBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [restoringVer, setRestoringVer] = useState<number | null>(null)
  const [history, setHistory] = useState<{
    version: number
    title: string
    content: string
    extra: Record<string, unknown> | null
    active: boolean
    editedBy: string
    editNote: string | null
    createdAt: string
  }[]>([])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`/api/vault/${item.id}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Could not load rule history.')
      setHistory(body.history)
      setHistoryOpen(true)
    } catch (error) {
      toast({ title: 'History unavailable', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' })
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'group flex flex-col rounded-xl border bg-paper p-4 transition-opacity',
        item.active ? 'border-line' : 'border-dashed border-stone-300 opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ClauseBadge clauseId={item.clauseId} />
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
              meta.chip
            )}
          >
            <meta.icon className="h-3 w-3" />
            {meta.label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            disabled={historyLoading}
            onClick={() => void loadHistory()}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-parchment px-2 py-1 text-[10.5px] font-semibold text-ink-soft hover:border-stone-300 hover:text-ink"
            title="View version history & diffs"
          >
            <CalendarClock className="h-3 w-3" />
            v{item.ruleVer} · History
          </button>
          {role === 'admin' && (
            <>
              <button onClick={onEdit} className="rounded-md p-1.5 text-faint hover:bg-parchment hover:text-ink" title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {item.active && (
                <button onClick={onDelete} className="rounded-md p-1.5 text-faint hover:bg-clay-50 hover:text-clay-600" title="Archive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <h3 className="mt-2.5 text-sm font-bold leading-snug text-ink">{item.title}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-soft">{item.content}</p>

      {Boolean(extra.hex || extra.replaceWith || extra.term || extra.match) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {typeof extra.hex === 'string' && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-parchment px-2 py-1 font-mono font-semibold text-stone-700">
              <HexSwatch hex={extra.hex} size={14} /> {extra.hex}
            </span>
          )}
          {typeof extra.replaceWith === 'string' && typeof extra.match === 'string' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-parchment px-2 py-1 text-stone-600">
              <span className="font-semibold text-clay-600 line-through">{String(extra.match)}</span>
              <ArrowRight className="h-3 w-3 text-faint" />
              <span className="font-semibold text-olive-700">{extra.replaceWith}</span>
            </span>
          )}
          {typeof extra.term === 'string' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-stone-700 bg-ink px-2 py-1 font-mono text-stone-300">
              <Lock className="h-3 w-3" /> {extra.term}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-200 pt-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10.5px] text-faint">
            Updated {timeAgo(item.updatedAt)} · v{item.ruleVer}
          </span>
          {affectedDrafts.length > 0 && (
            <button
              type="button"
              onClick={onInspectBlast}
              className="rounded-full border border-ochre-300 bg-ochre-50 px-2 py-0.5 text-[10px] font-semibold text-ochre-800 transition-colors hover:border-terra-400 hover:bg-ochre-100"
              title="Click to inspect drifted drafts impacted by this rule"
            >
              Impacts {affectedDrafts.length} {affectedDrafts.length === 1 ? 'draft' : 'drafts'} · Inspect
            </button>
          )}
        </div>
        {role === 'admin' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-medium text-faint">active</span>
            <Switch
              checked={item.active}
              disabled={busy}
              onCheckedChange={async (v) => {
                setBusy(true)
                try {
                  const response = await fetch(`/api/vault/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: v }),
                  })
                  if (!response.ok) throw new Error((await response.json()).error ?? 'Could not update rule.')
                  await refresh()
                } catch (error) {
                  toast({ title: 'Rule update failed', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' })
                } finally {
                  setBusy(false)
                }
              }}
            />
          </div>
        ) : (
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              item.active
                ? 'border-olive-200 bg-olive-50 text-olive-700'
                : 'border-stone-300 bg-parchment text-faint'
            )}
          >
            {item.active ? 'Active' : 'Archived'}
          </span>
        )}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{item.clauseId} — rule version history</DialogTitle>
              <DialogDescription>
                Every rule update creates an immutable snapshot. Audits cite the exact rule version active when they ran.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {history.map((version, index) => {
                const prior = history[index + 1]
                const changed = Boolean(
                  prior &&
                    (version.content !== prior.content ||
                      version.title !== prior.title ||
                      version.active !== prior.active ||
                      JSON.stringify(version.extra) !== JSON.stringify(prior.extra))
                )
                const contentDiff = prior && version.content !== prior.content ? wordDiff(prior.content, version.content) : null
                const extraChanged = prior && JSON.stringify(version.extra) !== JSON.stringify(prior.extra)
                return (
                  <section key={version.version} className="rounded-lg border border-line bg-paper p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <strong>Version {version.version}</strong>
                        {version.version === item.ruleVer && (
                          <span className="rounded-full bg-terra-50 px-2 py-0.5 text-[10px] font-bold text-terra-700">
                            LIVE
                          </span>
                        )}
                        {!version.active && (
                          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-faint">{new Date(version.createdAt).toLocaleString()} · {version.editedBy}</span>
                        {role === 'admin' && version.version !== item.ruleVer && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            disabled={restoringVer === version.version}
                            onClick={async () => {
                              setRestoringVer(version.version)
                              try {
                                const res = await fetch(`/api/vault/${item.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ restoreVersion: version.version }),
                                })
                                const body = await res.json()
                                if (!res.ok) throw new Error(body.error ?? 'Could not restore rule version.')
                                await refresh()
                                await loadHistory()
                                toast({
                                  title: `${item.clauseId} restored to v${version.version}`,
                                  description: `Recorded as new live rule version v${body.item.ruleVer}.`,
                                })
                              } catch (err) {
                                toast({
                                  title: 'Restore failed',
                                  description: err instanceof Error ? err.message : 'Try again.',
                                  variant: 'destructive',
                                })
                              } finally {
                                setRestoringVer(null)
                              }
                            }}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            {restoringVer === version.version ? 'Restoring…' : `Restore v${version.version}`}
                          </Button>
                        )}
                      </div>
                    </div>
                    {version.editNote && <p className="mt-1 text-xs font-medium text-terra-700">{version.editNote}</p>}
                    {changed && (
                      <p className="mt-1 text-[11px] font-semibold text-ochre-700">
                        Diff vs v{prior.version}{extraChanged ? ' (includes structured rule parameters)' : ''}
                      </p>
                    )}
                    <h4 className="mt-2 text-sm font-semibold text-ink">{version.title}</h4>
                    {contentDiff ? (
                      <p className="mt-1 whitespace-pre-wrap rounded-md bg-parchment/70 p-2.5 text-xs leading-relaxed text-ink-soft">
                        {contentDiff.map((tok, i) =>
                          tok.op === 'remove' ? (
                            <del key={i} className="rounded bg-clay-100 px-0.5 text-clay-800 line-through">
                              {tok.text}
                            </del>
                          ) : tok.op === 'add' ? (
                            <ins key={i} className="rounded bg-olive-100 px-0.5 font-medium text-olive-900 no-underline">
                              {tok.text}
                            </ins>
                          ) : (
                            <span key={i}>{tok.text}</span>
                          )
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">{version.content}</p>
                    )}
                    {version.extra && (
                      <p className="mt-2 rounded bg-parchment px-2 py-1 font-mono text-[10.5px] text-stone-600">
                        Params: {JSON.stringify(version.extra)}
                      </p>
                    )}
                  </section>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// ── Create / edit dialog ─────────────────────────────────────

interface ClauseForm {
  type: VaultItemDTO['type']
  title: string
  content: string
  hex: string
  match: string
  replaceWith: string
  kind: 'banned' | 'deprecated'
  term: string
  figures: string
}

const EMPTY_FORM: ClauseForm = {
  type: 'VOICE',
  title: '',
  content: '',
  hex: '#F43F5E',
  match: '',
  replaceWith: '',
  kind: 'banned',
  term: '',
  figures: '',
}

function ClauseDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean
  item: VaultItemDTO | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState<ClauseForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editNote, setEditNote] = useState('')
  const [initialised, setInitialised] = useState<string | null>(null)

  // sync form when dialog target changes
  const targetKey = item?.id ?? 'new'
  if (open && initialised !== targetKey) {
    setInitialised(targetKey)
    if (item) {
      const e = (item.extra ?? {}) as Record<string, unknown>
      setForm({
        type: item.type,
        title: item.title,
        content: item.content,
        hex: typeof e.hex === 'string' ? e.hex : '#F43F5E',
        match: typeof e.match === 'string' ? e.match : '',
        replaceWith: typeof e.replaceWith === 'string' ? e.replaceWith : '',
        kind: e.kind === 'deprecated' ? 'deprecated' : 'banned',
        term: typeof e.term === 'string' ? e.term : '',
        figures: Array.isArray(e.figures) ? (e.figures as string[]).join(', ') : '',
      })
      setEditNote('')
    } else {
      setForm(EMPTY_FORM)
      setEditNote('')
    }
  }
  if (!open && initialised !== null) setInitialised(null)

  const buildExtra = (): Record<string, unknown> | null => {
    switch (form.type) {
      case 'COLOR':
        return { hex: form.hex.toUpperCase() }
      case 'TERM':
        return {
          match: form.match,
          replaceWith: form.replaceWith || null,
          kind: form.kind,
        }
      case 'CONFIDENTIAL':
        return { term: form.term }
      case 'FACT':
        return form.figures.trim()
          ? { figures: form.figures.split(',').map((f) => f.trim()).filter(Boolean) }
          : null
      default:
        return null
    }
  }

  const valid = () => {
    if (!form.title.trim() || !form.content.trim()) return false
    if (form.type === 'COLOR' && !/^#[0-9a-fA-F]{6}$/.test(form.hex)) return false
    if (form.type === 'TERM' && !form.match.trim()) return false
    if (form.type === 'CONFIDENTIAL' && !form.term.trim()) return false
    return true
  }

  const save = async () => {
    if (!valid()) {
      toast({ title: 'Missing fields', description: 'Fill in the required values.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim(),
        extra: buildExtra(),
        editNote,
      }
      const res = item
        ? await fetch(`/api/vault/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/vault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      await onSaved()
      onClose()
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto vl-scroll sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${item.clauseId}` : 'Add a Vault clause'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'Changes apply to all future audits immediately.'
              : 'A unique clause ID (e.g. VL-VOICE-006) is assigned automatically.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          {!item && (
            <div>
              <Label className="text-xs">Clause type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as VaultItemDTO['type'] }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as VaultItemDTO['type'][]).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Title</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. No fear-based marketing"
            />
          </div>

          <div>
            <Label className="text-xs">Clause text (this is what findings will quote)</Label>
            <Textarea
              className="mt-1 min-h-[90px] text-xs"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Write the rule or fact in full sentences…"
            />
          </div>
          {item && (
            <div>
              <Label className="text-xs">Change note (optional)</Label>
              <Input
                className="mt-1"
                maxLength={500}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Why is this rule changing?"
              />
            </div>
          )}

          {form.type === 'COLOR' && (
            <div className="flex items-end gap-3">
              <div>
                <Label className="text-xs">Brand hex</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.hex}
                    onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded-md border border-line bg-paper p-1"
                  />
                  <Input
                    className="w-32 font-mono"
                    value={form.hex.toUpperCase()}
                    onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {form.type === 'TERM' && (
            <>
              <div>
                <Label className="text-xs">Term to match</Label>
                <Input
                  className="mt-1"
                  value={form.match}
                  onChange={(e) => setForm((f) => ({ ...f, match: e.target.value }))}
                  placeholder='e.g. "game-changer"'
                />
              </div>
              <div>
                <Label className="text-xs">Approved replacement</Label>
                <Input
                  className="mt-1"
                  value={form.replaceWith}
                  onChange={(e) => setForm((f) => ({ ...f, replaceWith: e.target.value }))}
                  placeholder='e.g. "a meaningful upgrade"'
                />
              </div>
              <div>
                <Label className="text-xs">Rule kind</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm((f) => ({ ...f, kind: v as 'banned' | 'deprecated' }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banned" className="text-xs">Banned word</SelectItem>
                    <SelectItem value="deprecated" className="text-xs">Deprecated name (must be replaced)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {form.type === 'CONFIDENTIAL' && (
            <div>
              <Label className="text-xs">Confidential token (redacted pre-flight)</Label>
              <Input
                className="mt-1"
                value={form.term}
                onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                placeholder='e.g. "Project Phoenix"'
              />
            </div>
          )}

          {form.type === 'FACT' && (
            <div>
              <Label className="text-xs">Verifiable figures (comma-separated)</Label>
              <Input
                className="mt-1"
                value={form.figures}
                onChange={(e) => setForm((f) => ({ ...f, figures: e.target.value }))}
                placeholder="e.g. $29, $79, 14-day"
              />
              <p className="mt-1 text-[11px] text-faint">
                The deterministic claim scanner cross-checks these figures in every draft.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-terra-600 hover:bg-terra-500">
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add clause'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
