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
} from 'lucide-react'
import { useApp } from '@/lib/store'
import type { VaultItemDTO } from '@/lib/types'
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
  VOICE: { label: 'Tone & Voice', icon: Type, chip: 'bg-teal-50 text-teal-700 border-teal-200' },
  FACT: { label: 'Verified Facts', icon: CalendarClock, chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  TERM: { label: 'Terminology', icon: ArrowRight, chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  COLOR: { label: 'Colour Palette', icon: Palette, chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  LOGO: { label: 'Logo & Assets', icon: ImageIcon, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CONFIDENTIAL: { label: 'Confidential', icon: Lock, chip: 'bg-zinc-800 text-zinc-100 border-zinc-700' },
  RULE: { label: 'Governance Rules', icon: Scale, chip: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
}

type TabKey = 'ALL' | VaultItemDTO['type']

export function VaultView() {
  const { data, refresh } = useApp()
  const [tab, setTab] = useState<TabKey>('ALL')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<VaultItemDTO | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<VaultItemDTO | null>(null)

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
        actions={
          <Button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-500">
            <Plus className="mr-1.5 h-4 w-4" /> Add clause
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="h-9 flex-wrap">
            {(['ALL', 'VOICE', 'FACT', 'TERM', 'COLOR', 'LOGO', 'CONFIDENTIAL', 'RULE'] as TabKey[]).map(
              (k) => (
                <TabsTrigger key={k} value={k} className="text-xs">
                  {k === 'ALL' ? 'All' : TYPE_META[k].label}
                  <span className="ml-1 rounded-full bg-zinc-200 px-1.5 text-[10px] font-semibold text-zinc-600">
                    {counts[k] ?? 0}
                  </span>
                </TabsTrigger>
              )
            )}
          </TabsList>
        </Tabs>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clauses…"
            className="h-9 w-56 border-zinc-200 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <VaultCard
            key={item.id}
            item={item}
            onEdit={() => setEditing(item)}
            onDelete={() => setDeleting(item)}
          />
        ))}
        {items.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400">
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
            <AlertDialogTitle>Remove {deleting?.clauseId}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” will no longer be cited by audits. Existing findings keep
              their recorded citations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-500"
              onClick={async () => {
                if (deleting) {
                  await fetch(`/api/vault/${deleting.id}`, { method: 'DELETE' })
                  await refresh()
                  toast({ title: 'Clause removed' })
                }
                setDeleting(null)
              }}
            >
              Remove clause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function VaultCard({
  item,
  onEdit,
  onDelete,
}: {
  item: VaultItemDTO
  onEdit: () => void
  onDelete: () => void
}) {
  const { refresh } = useApp()
  const meta = TYPE_META[item.type]
  const extra = (item.extra ?? {}) as Record<string, unknown>
  const [busy, setBusy] = useState(false)

  return (
    <div
      className={cn(
        'group flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-opacity',
        item.active ? 'border-zinc-200' : 'border-dashed border-zinc-300 opacity-60'
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
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={onEdit} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <h3 className="mt-2.5 text-sm font-bold leading-snug text-zinc-900">{item.title}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-500">{item.content}</p>

      {Boolean(extra.hex || extra.replaceWith || extra.term || extra.match) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {typeof extra.hex === 'string' && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 font-mono font-semibold text-zinc-700">
              <HexSwatch hex={extra.hex} size={14} /> {extra.hex}
            </span>
          )}
          {typeof extra.replaceWith === 'string' && typeof extra.match === 'string' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-600">
              <span className="font-semibold text-rose-600 line-through">{String(extra.match)}</span>
              <ArrowRight className="h-3 w-3 text-zinc-400" />
              <span className="font-semibold text-emerald-700">{extra.replaceWith}</span>
            </span>
          )}
          {typeof extra.term === 'string' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-zinc-200">
              <Lock className="h-3 w-3" /> {extra.term}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">
        <span className="text-[10.5px] text-zinc-400">
          Updated {timeAgo(item.updatedAt)}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-medium text-zinc-400">active</span>
          <Switch
            checked={item.active}
            disabled={busy}
            onCheckedChange={async (v) => {
              setBusy(true)
              try {
                await fetch(`/api/vault/${item.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ active: v }),
                })
                await refresh()
              } finally {
                setBusy(false)
              }
            }}
          />
        </div>
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
    } else {
      setForm(EMPTY_FORM)
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

          {form.type === 'COLOR' && (
            <div className="flex items-end gap-3">
              <div>
                <Label className="text-xs">Brand hex</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={form.hex}
                    onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded-md border border-zinc-200 bg-white p-1"
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
              <p className="mt-1 text-[11px] text-zinc-400">
                The deterministic claim scanner cross-checks these figures in every draft.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add clause'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
