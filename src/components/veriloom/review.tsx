'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Role-Based Review & Approval
// RBAC gates, version diffs, threaded comments, state machine.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardCheck,
  Send,
  Undo2,
  BadgeCheck,
  Lock,
  MessageSquare,
  Loader2,
  FileText,
  ImageIcon,
  History,
} from 'lucide-react'
import { useApp, roleIdentity, type View } from '@/lib/store'
import { ROLE_META, type CommentDTO, type DraftDTO, type DraftVersionDTO } from '@/lib/types'
import { wordDiff } from '@/lib/diff'
import { StatusChip, timeAgo, ClauseBadge, ViewHeader } from './shared'
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

interface ReviewDetail {
  draft: DraftDTO
  versions: DraftVersionDTO[]
  comments: CommentDTO[]
}

const FLOW: { id: string; label: string }[] = [
  { id: 'DRAFT', label: 'Draft' },
  { id: 'AUDITED', label: 'Audited' },
  { id: 'REMEDIATED', label: 'Remediated' },
  { id: 'IN_REVIEW', label: 'In Review' },
  { id: 'APPROVED', label: 'Approved' },
]

export function ReviewView() {
  const { data, selectedDraftId, selectDraft, refresh, role } = useApp()
  const drafts = data?.drafts ?? []
  const selected = drafts.find((d) => d.id === selectedDraftId) ?? null
  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
  const [changesNote, setChangesNote] = useState('')

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    const load = async () => {
      const res = await fetch(`/api/drafts/${selected.id}`, { cache: 'no-store' })
      if (!res.ok || cancelled) return
      const body = (await res.json()) as ReviewDetail
      if (!cancelled) setDetail(body)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selected?.id, selected?.status, selected?.version, data?.drafts.length])

  const reload = async () => {
    if (!selected) return
    const res = await fetch(`/api/drafts/${selected.id}`, { cache: 'no-store' })
    if (res.ok) setDetail((await res.json()) as ReviewDetail)
    await refresh()
  }

  const act = async (action: 'submit' | 'request-changes' | 'approve', note?: string) => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: selected.id, action, role, note }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      await reload()
      toast({
        title:
          action === 'approve'
            ? 'Approved — compliance certificate issued'
            : action === 'submit'
              ? 'Submitted for review'
              : 'Changes requested — creator notified',
      })
      if (action === 'approve') useApp.getState().setView('certificate')
    } catch (err) {
      toast({ title: 'Action blocked', description: String(err), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const identity = roleIdentity(role)
  const draft = detail?.draft ?? selected

  return (
    <div className="space-y-5">
      <ViewHeader
        crumb="Review & Approval"
        title="Review & Approval"
        subtitle="Side-by-side diffs, threaded comments and the RBAC state machine — managers pre-screen, only the Authorised Reviewer signs off."
      />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
      {/* draft list */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Drafts</h2>
        <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto pr-1 vl-scroll">
          {drafts.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDraft(d.id)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-colors',
                d.id === selected?.id
                  ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                  {d.kind === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  v{d.version}
                </span>
                <StatusChip status={d.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-900">
                {d.title}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* main */}
      <div>
        {!draft ? (
          <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/60 text-center">
            <ClipboardCheck className="h-10 w-10 text-zinc-300" />
            <p className="mt-3 text-sm font-semibold text-zinc-600">Select a draft to review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* status flow */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-zinc-900">{draft.title}</h1>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {draft.channel} · v{draft.version} · created by {draft.creator}
                  </p>
                </div>
                <StatusChip status={draft.status} />
              </div>
              <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1 vl-scroll">
                {FLOW.map((s, i) => {
                  const idx = FLOW.findIndex((f) => f.id === draft.status)
                  const done =
                    draft.status === 'CHANGES_REQUESTED'
                      ? i <= 3
                      : i <= idx
                  const isLoop = draft.status === 'CHANGES_REQUESTED' && s.id === 'IN_REVIEW'
                  return (
                    <div key={s.id} className="flex shrink-0 items-center">
                      {i > 0 && <span className={cn('h-px w-5', done ? 'bg-emerald-400' : 'bg-zinc-200')} />}
                      <span
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                          done && !isLoop
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-400',
                          isLoop && 'border-amber-300 bg-amber-50 text-amber-700'
                        )}
                      >
                        {done && !isLoop && <BadgeCheck className="h-3 w-3" />}
                        {isLoop && <Undo2 className="h-3 w-3" />}
                        {isLoop ? 'Sent back' : s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
              {draft.status === 'CHANGES_REQUESTED' && (
                <p className="mt-2 text-[11px] font-medium text-amber-700">
                  The manager sent this back — edit the content (Audit Studio), re-audit, remediate
                  and resubmit.
                </p>
              )}
            </div>

            {/* version diff */}
            {detail && detail.versions.length > 1 && draft.kind === 'text' && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <History className="h-3.5 w-3.5" />
                  Version diff · v1 → v{draft.version}
                </p>
                <DiffView
                  a={detail.versions[0].content}
                  b={detail.versions[detail.versions.length - 1].content}
                />
              </div>
            )}

            {/* content */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Current content
              </p>
              {draft.kind === 'text' ? (
                <div className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-800">
                  {draft.content}
                </div>
              ) : (
                <div>
                  {draft.imageData && (
                    <img src={draft.imageData} alt={draft.title} className="max-w-sm rounded-lg border border-zinc-200" />
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    <span className="font-semibold">Alt text:</span>{' '}
                    {draft.imageMeta?.altText || (
                      <span className="text-rose-600">missing</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* RBAC actions */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-white shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Sign-off console — you are {identity.name} ({ROLE_META[role].label})
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <RbacButton
                  label="Submit for review"
                  desc="Creator sends the remediated draft to the review desk"
                  allowed={role === 'creator'}
                  enabled={draft.status === 'REMEDIATED'}
                  busy={busy}
                  onClick={() => act('submit')}
                  variant="emerald"
                />
                <RbacButton
                  label="Request changes"
                  desc="Brand Manager returns the draft with a note"
                  allowed={role === 'manager'}
                  enabled={draft.status === 'IN_REVIEW'}
                  busy={busy}
                  onClick={() => setChangesOpen(true)}
                  variant="amber"
                />
                <RbacButton
                  label="Approve & issue certificate"
                  desc="Authorised Reviewer signs off — certificate is generated"
                  allowed={role === 'reviewer'}
                  enabled={draft.status === 'IN_REVIEW'}
                  busy={busy}
                  onClick={() => act('approve')}
                  variant="emerald"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* comments */}
      {draft && (
        <div className="flex max-h-[calc(100vh-190px)] flex-col">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-500">
            <MessageSquare className="h-4 w-4" /> Thread
          </h2>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 vl-scroll">
            {(detail?.comments ?? []).map((c) => (
              <div key={c.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-bold text-zinc-800">{c.author}</p>
                  <span className="text-[10px] text-zinc-400">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {ROLE_META[c.role as keyof typeof ROLE_META]?.label ?? c.role}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{c.body}</p>
              </div>
            ))}
            {(detail?.comments.length ?? 0) === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
                No comments yet.
              </p>
            )}
          </div>
          <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm">
            <Textarea
              className="min-h-[60px] text-xs"
              placeholder={`Comment as ${identity.name}…`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              size="sm"
              className="mt-2 w-full bg-zinc-900 hover:bg-zinc-800"
              disabled={!comment.trim() || busy}
              onClick={async () => {
                if (!selected) return
                setBusy(true)
                try {
                  await fetch('/api/comments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      draftId: selected.id,
                      body: comment.trim(),
                      author: identity.name,
                      role,
                    }),
                  })
                  setComment('')
                  await reload()
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Post comment
            </Button>
          </div>
        </div>
      )}

      {/* request changes dialog */}
      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Your note is posted to the thread and the draft returns to the creator.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[90px] text-xs"
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            placeholder="What must change before this can ship? (min 10 characters)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500"
              disabled={changesNote.trim().length < 10 || busy}
              onClick={async () => {
                await act('request-changes', changesNote.trim())
                setChangesNote('')
                setChangesOpen(false)
              }}
            >
              Send back to creator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}

function RbacButton({
  label,
  desc,
  allowed,
  enabled,
  busy,
  onClick,
  variant,
}: {
  label: string
  desc: string
  allowed: boolean
  enabled: boolean
  busy: boolean
  onClick: () => void
  variant: 'emerald' | 'amber'
}) {
  const disabled = !allowed || !enabled || busy
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={allowed ? desc : `RBAC — switch role to use this action`}
      className={cn(
        'group flex min-w-[210px] flex-1 items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-all',
        disabled && 'cursor-not-allowed opacity-45',
        !disabled &&
          variant === 'emerald' &&
          'border-emerald-400/40 bg-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-500/20',
        !disabled && variant === 'amber' && 'border-amber-400/40 bg-amber-500/10 hover:border-amber-400 hover:bg-amber-500/20'
      )}
    >
      <span>
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-white">
          {!allowed && <Lock className="h-3.5 w-3.5 text-zinc-500" />}
          {label}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-400">{desc}</span>
      </span>
      {busy && disabled ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null}
    </button>
  )
}

function DiffView({ a, b }: { a: string; b: string }) {
  const tokens = useMemo(() => wordDiff(a, b), [a, b])
  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-[13px] leading-[1.9] text-zinc-800">
      {tokens.map((t, i) =>
        t.op === 'same' ? (
          <span key={i}>{t.text}</span>
        ) : t.op === 'remove' ? (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded bg-rose-100 px-0.5 text-rose-700 line-through decoration-rose-400"
          >
            {t.text}
          </motion.span>
        ) : (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded bg-emerald-100 px-0.5 font-semibold text-emerald-800"
          >
            {t.text}
          </motion.span>
        )
      )}
    </div>
  )
}

export { ClauseBadge }
export type { View }
