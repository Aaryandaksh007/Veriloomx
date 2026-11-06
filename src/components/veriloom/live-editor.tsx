'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — LiveEditor
// A textarea with a pixel-matched highlight mirror behind it —
// banned terms, leaks and unverified figures light up as the
// creator types. "Grammarly for brand governance".
// ─────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { buildSegments, LIVE_KIND_META, type LiveHit, type LiveHitKind } from '@/lib/live-check'
import { cn } from '@/lib/utils'

export function LiveTextarea({
  value,
  onChange,
  hits,
  disabled = false,
  placeholder,
  minHeightClass = 'min-h-[230px]',
  className,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  hits: LiveHit[]
  disabled?: boolean
  placeholder?: string
  minHeightClass?: string
  className?: string
  ariaLabel?: string
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  const segments = useMemo(() => buildSegments(value, hits), [value, hits])

  const syncScroll = () => {
    if (mirrorRef.current && taRef.current) {
      mirrorRef.current.scrollTop = taRef.current.scrollTop
      mirrorRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }

  // metrics must match the Textarea exactly (border, padding, font)
  const metrics = 'rounded-md border px-3 py-2 font-mono text-[13px] leading-relaxed'

  return (
    <div className={cn('relative', disabled && 'opacity-60')}>
      {/* highlight mirror — same box, same metrics, invisible text */}
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-transparent text-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          metrics,
          className
        )}
      >
        {segments.map((seg, i) =>
          seg.hit ? (
            <span
              key={i}
              className={cn(
                'rounded-[3px] text-transparent [box-decoration-break:clone]',
                LIVE_KIND_META[seg.hit.kind].markBg
              )}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
        {'\n '}
      </div>
      <Textarea
        ref={taRef}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        disabled={disabled}
        placeholder={placeholder}
        className={cn('relative bg-transparent', minHeightClass, metrics, className)}
      />
    </div>
  )
}

/** Compact live-scan status bar: "3 banned · 1 leak · 2 unverified" */
export function LiveStatusStrip({
  counts,
  total,
}: {
  counts: Record<LiveHitKind, number>
  total: number
}) {
  const kinds: LiveHitKind[] = ['banned', 'deprecated', 'confidential', 'figure', 'tone']
  const active = kinds.filter((k) => counts[k] > 0)
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {total === 0 ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          No instant violations — tone &amp; semantic checks run in the full audit
        </span>
      ) : (
        active.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <span className={cn('h-2 w-2 rounded-full', LIVE_KIND_META[k].dot)} />
            <span className={LIVE_KIND_META[k].text}>
              {counts[k]} {counts[k] === 1 ? LIVE_KIND_META[k].label.toLowerCase() : LIVE_KIND_META[k].plural}
            </span>
          </span>
        ))
      )}
    </div>
  )
}
