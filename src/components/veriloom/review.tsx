'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Role-Based Review & Approval
// Authenticated role gates, version diffs, threaded comments, state machine.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
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
  const previousVersion =
    detail && detail.versions.length > 1
      ? detail.versions[detail.versions.length - 2]
      : null
  const currentVersion =
    detail && detail.versions.length > 1
      ? detail.versions[detail.versions.length - 1]
      : null

  return (
    <div className="space-y-5">
      <ViewHeader
        crumb="Review & Approval"
        title="Review & Approval"
        subtitle="Side-by-side diffs, threaded comments and role-enforced approvals — reviewers request changes, and authorised approvers sign off."
      />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
      {/* draft list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">Drafts</h2>
        <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto pr-1 vl-scroll">
          {drafts.map((d) => (
            <button
              key={d.id}
              onClick={() => selectDraft(d.id)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-colors',
                d.id === selected?.id
                  ? 'border-terra-300 bg-terra-50/60 ring-1 ring-terra-200'
                  : 'border-line bg-paper hover:border-stone-300'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
                  {d.kind === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  v{d.version}
                </span>
                <StatusChip status={d.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
                {d.title}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* main */}
      <div>
        {!draft ? (
          <div className="flex h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-paper/60 text-center">
            <ClipboardCheck className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-600">Select a draft to review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* status flow */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg font-serif font-semibold tracking-tight text-ink">{draft.title}</h1>
                  <p className="mt-0.5 text-xs text-ink-soft">
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
                      {i > 0 && <span className={cn('h-px w-5', done ? 'bg-olive-400' : 'bg-stone-200')} />}
                      <span
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                          done && !isLoop
                            ? 'border-olive-200 bg-olive-50 text-olive-700'
                            : 'border-stone-200 bg-parchment text-faint',
                          isLoop && 'border-ochre-300 bg-ochre-50 text-ochre-700'
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
                <p className="mt-2 text-[11px] font-medium text-ochre-700">
                  The manager sent this back — edit the content (Audit Studio), re-audit, remediate
                  and resubmit.
                </p>
              )}
            </div>

            {/* version diff */}
            {previousVersion && currentVersion && draft.kind === 'text' && (
              <div className="rounded-xl border border-line bg-paper p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  <History className="h-3.5 w-3.5" />
                  Version comparison · v{previousVersion.version} → v{currentVersion.version}
                </p>
                <VersionCompare previous={previousVersion} current={currentVersion} />
              </div>
            )}

            {/* content */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                Current content
              </p>
              {draft.kind === 'text' ? (
                <div className="whitespace-pre-wrap rounded-lg bg-parchment p-3 text-[13px] leading-relaxed text-stone-800">
                  {draft.content}
                </div>
              ) : (
                <div>
                  {draft.imageData && (
                    <img src={draft.imageData} alt={draft.title} className="max-w-sm rounded-lg border border-line" />
                  )}
                  <p className="mt-2 text-xs text-ink-soft">
                    <span className="font-semibold">Alt text:</span>{' '}
                    {draft.imageMeta?.altText || (
                      <span className="text-clay-600">missing</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Demo role actions */}
            <div className="rounded-xl border border-line bg-ink p-4 text-cream">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
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
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-ink-soft">
            <MessageSquare className="h-4 w-4" /> Thread
          </h2>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 vl-scroll">
            {(detail?.comments ?? []).map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-paper p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-bold text-stone-800">{c.author}</p>
                  <span className="text-[10px] text-faint">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                  {ROLE_META[c.role as keyof typeof ROLE_META]?.label ?? c.role}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">{c.body}</p>
              </div>
            ))}
            {(detail?.comments.length ?? 0) === 0 && (
              <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-faint">
                No comments yet.
              </p>
            )}
          </div>
          <div className="mt-2 rounded-xl border border-line bg-paper p-2.5">
            <Textarea
              className="min-h-[60px] text-xs"
              placeholder={`Comment as ${identity.name}…`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              size="sm"
              className="mt-2 w-full bg-ink hover:bg-stone-800"
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
              className="bg-ochre-600 hover:bg-ochre-500"
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
      title={allowed ? desc : 'Demo workflow — switch the acting role to use this action'}
      className={cn(
        'group flex min-w-[210px] flex-1 items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-all',
        disabled && 'cursor-not-allowed opacity-45',
        !disabled &&
          variant === 'emerald' &&
          'border-olive-400/40 bg-olive-500/10 hover:border-olive-400 hover:bg-olive-500/20',
        !disabled && variant === 'amber' && 'border-ochre-400/40 bg-ochre-500/10 hover:border-ochre-400 hover:bg-ochre-500/20'
      )}
    >
      <span>
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-cream">
          {!allowed && <Lock className="h-3.5 w-3.5 text-stone-500" />}
          {label}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-snug text-stone-400">{desc}</span>
      </span>
      {busy && disabled ? <Loader2 className="h-4 w-4 animate-spin text-stone-400" /> : null}
    </button>
  )
}

function VersionCompare({
  previous,
  current,
}: {
  previous: DraftVersionDTO
  current: DraftVersionDTO
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="min-w-0 rounded-lg border border-clay-200 bg-clay-50/50 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-clay-700">
          Previous · v{previous.version}
        </p>
        <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.9] text-stone-800">
          {previous.content || 'No text content'}
        </p>
      </div>
      <div className="min-w-0 rounded-lg border border-olive-200 bg-olive-50/50 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-olive-700">
          Current · v{current.version}
        </p>
        <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.9] text-stone-800">
          {current.content || 'No text content'}
        </p>
      </div>
    </div>
  )
}

export { ClauseBadge }
export type { View }
