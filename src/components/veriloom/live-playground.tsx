'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Live Playground
// The zero-friction entry point for a first-time visitor: paste
// (or one-click load) real marketing copy and watch the
// deterministic core flag violations AS YOU TYPE — then send it
// to the full 6-pillar engine with one click.
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeDollarSign,
  EyeOff,
  Flame,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { useApp, roleIdentity } from '@/lib/store'
import { liveScan, LIVE_KIND_META, type LiveHit } from '@/lib/live-check'
import { LiveTextarea, LiveStatusStrip } from './live-editor'
import { ClauseBadge } from './shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

const SAMPLES: {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
  title: string
  channel: string
  text: string
}[] = [
  {
    id: 'hell',
    label: 'Launch post from hell',
    icon: Flame,
    tone: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    title: 'Q3 Launch post — all four failures',
    channel: 'LinkedIn',
    text: `Big news, valued customers!

Our revolutionary release is finally here, and it's pure AI magic. Inkloom Studio now ships with LiveLint editing, real-time brand checks and an AI assistant in every workflow.

Join 15,000+ teams worldwide who already trust Inkloom. Plans start at just $39/user/month — a fraction of what the competition charges.

We're also giving early readers a sneak peek at Project Nightloom before the official unveiling. Want in? Email aaryan@inkloom-internal.dev today!

Act now — before your competitors leave you behind!!! Your brand won't save itself.`,
  },
  {
    id: 'pricing',
    label: 'Quiet pricing mistake',
    icon: BadgeDollarSign,
    tone: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
    title: 'Pricing update post — unverified figures',
    channel: 'Web',
    text: `Inkloom Workspace just got better.

LiveLint now checks your copy as you type, and every export is verified against your brand guidelines automatically — no more guesswork.

Plans start at $39/user/month. Scale customers get a 30-day free trial and our famous 99.99% uptime guarantee, trusted by 15,000+ teams across 90 countries.`,
  },
  {
    id: 'leak',
    label: 'Confidential leak',
    icon: EyeOff,
    tone: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    title: 'Partner teaser — confidential leak',
    channel: 'Social',
    text: `A quiet update from the Inkloom team.

We've been working with our design partners on Project Nectarine, and early results are exciting. A preview build is available to enterprise customers — reply to this post or contact dev@inkloom-internal.dev / +91 98765 43210 for access.

Spots are limited to 25 teams, so organise a call with your account manager this week.`,
  },
  {
    id: 'clean',
    label: 'Spotless post (passes)',
    icon: Sparkles,
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    title: 'Workspace 3.0 announcement — fully compliant',
    channel: 'LinkedIn',
    text: `Inkloom Workspace 3.0 is here.

You told us brand review was slow, so we rebuilt it. LiveLint checks every sentence as you type, the shared Brand Vault keeps your guidelines and approved facts in one place, and Inkloom Copilot suggests fixes that keep your voice.

Try it free for 14 days — no credit card needed. Inkloom works with Figma, Notion, Slack, and Google Workspace, so everything stays connected.`,
  },
]

export function LivePlayground() {
  const { data, refresh, role, selectDraft, setAutoAudit } = useApp()
  const [text, setText] = useState('')
  const [activeSample, setActiveSample] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showRedacted, setShowRedacted] = useState(false)

  const vault = data?.vault ?? []
  const scan = useMemo(() => liveScan(text, vault), [text, vault])

  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id)
    if (!s) return
    setText(s.text)
    setActiveSample(id)
    setShowRedacted(false)
  }

  const runFullAudit = async () => {
    if (!text.trim() || busy) return
    const sample = activeSample ? SAMPLES.find((s) => s.id === activeSample) : null
    setBusy(true)
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sample ? sample.title : 'Playground draft — live scan',
          channel: sample ? sample.channel : 'LinkedIn',
          kind: 'text',
          content: text,
          creator: roleIdentity(role).name,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not create the draft')
      await refresh()
      // land in the Audit Studio and auto-run the 6-pillar engine
      setAutoAudit(body.draft.id)
      selectDraft(body.draft.id, 'audit')
      toast({
        title: 'Draft created — running the 6-pillar engine',
        description: 'Tone, terminology, claims, visual, accessibility & confidentiality.',
      })
    } catch (err) {
      toast({
        title: 'Could not start the audit',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-5 shadow-sm sm:p-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Zap className="h-4 w-4" />
            </span>
            Try it live — the brand check runs as you type
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            This is the deterministic core doing lexical math in your browser — nothing is
            sent anywhere. The full audit adds citation-grounded AI, vision checks and the
            compliance score on top.
          </p>
        </div>
      </div>

      {/* sample chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Try a sample
        </span>
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            onClick={() => loadSample(s.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              activeSample === s.id
                ? 'ring-2 ring-emerald-400/60 ' + s.tone
                : s.tone
            )}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
        {text && (
          <button
            onClick={() => {
              setText('')
              setActiveSample(null)
              setShowRedacted(false)
            }}
            className="text-xs font-semibold text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
          >
            clear
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* editor */}
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <LiveTextarea
              value={text}
              onChange={setText}
              hits={scan.hits}
              placeholder="Paste any marketing copy here — or hit a sample above. Watch banned terms, leaks and unverified figures light up instantly…"
              ariaLabel="Live brand check editor"
            />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
              <LiveStatusStrip counts={scan.counts} total={scan.total} />
              <span className="text-[11px] text-zinc-400">{words} words</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runFullAudit}
              disabled={!text.trim() || busy}
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run the full 6-Pillar Audit
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <p className="text-[11px] leading-snug text-zinc-400">
              Creates a draft in your workspace and runs the complete engine —
              tone, terminology, claims, visual, accessibility, confidentiality.
            </p>
          </div>
        </div>

        {/* instant findings panel */}
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <WandSparkles className="h-3.5 w-3.5 text-emerald-500" />
              Caught instantly
            </p>
            <div className="mt-2.5 max-h-[300px] space-y-1.5 overflow-y-auto vl-scroll pr-1">
              {scan.total === 0 ? (
                text.trim() ? (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                    <p className="text-xs font-semibold text-emerald-800">
                      Zero instant violations
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-700/80">
                      Vocabulary, figures and leaks all check out. Run the full audit for
                      tone scoring and semantic claim verification.
                    </p>
                  </div>
                ) : (
                  <p className="px-1 py-6 text-center text-xs leading-relaxed text-zinc-400">
                    Start typing or load a sample — instant findings appear here with the
                    exact Vault clause behind each one.
                  </p>
                )
              ) : (
                scan.hits.map((h) => <HitRow key={h.key} hit={h} />)
              )}
            </div>
          </div>

          {/* confidentiality sandbox */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Confidentiality sandbox
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90">
                  {scan.masked > 0
                    ? `${scan.masked} sensitive ${scan.masked === 1 ? 'token' : 'tokens'} would be masked before any external AI call.`
                    : 'Nothing sensitive to mask in this text.'}
                </p>
              </div>
              {scan.masked > 0 && (
                <button
                  onClick={() => setShowRedacted((s) => !s)}
                  className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100"
                >
                  {showRedacted ? 'Hide' : 'Preview'}
                </button>
              )}
            </div>
            {showRedacted && (
              <motion.pre
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="vl-scroll mt-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-zinc-700"
              >
                {scan.redacted}
              </motion.pre>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function HitRow({ hit }: { hit: LiveHit }) {
  const meta = LIVE_KIND_META[hit.kind]
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('rounded-lg border bg-white p-2.5', meta.border)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
          <code className="truncate font-mono text-[11.5px] font-bold text-zinc-800">
            {hit.value}
          </code>
        </span>
        <span className={cn('shrink-0 text-[10px] font-bold uppercase tracking-wide', meta.text)}>
          {meta.label}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {hit.clauseId && <ClauseBadge clauseId={hit.clauseId} />}
        {hit.suggestion && (
          <span className="text-[10.5px] leading-snug text-zinc-500">
            → {hit.suggestion}
          </span>
        )}
      </div>
    </motion.div>
  )
}
