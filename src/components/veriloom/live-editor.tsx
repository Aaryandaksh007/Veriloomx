'use client'

// ─────────────────────────────────────────────────────────────
// VeriLoom AI — LiveEditor
// A textarea with a pixel-matched highlight mirror behind it —
// banned terms, leaks and unverified figures light up as the
// creator types. "Grammarly for brand governance".
//
// Alignment strategy: BOTH layers are rendered from one shared
// METRICS class string (same border, padding, font, size, leading)
// and the textarea auto-grows to its content so it never scrolls
// internally — the mirror is height-locked to it via inset-0.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react'
import { buildSegments, LIVE_KIND_META, type LiveHit, type LiveHitKind } from '@/lib/live-check'
import { cn } from '@/lib/utils'

// single source of truth for the text metrics — applied identically
// to the transparent mirror and the real textarea
const METRICS =
  'w-full rounded-md border px-3 py-2 font-mono text-[13px] leading-relaxed'

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

  // auto-grow the textarea to fit its content: no internal scroll →
  // the mirror (absolute inset-0 over the same wrapper) can never
  // drift vertically, and both layers wrap at exactly the same width
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [value])

  return (
    <div className={cn('relative', disabled && 'opacity-60', className)}>
      {/* highlight mirror — same box, same metrics, invisible text */}
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border-transparent text-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          METRICS
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
      {/* the real editor — native textarea so no base-library
          responsive font classes (md:text-sm) can desync it from
          the mirror above */}
      <textarea
        ref={taRef}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          'relative resize-none border-input bg-transparent shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
          METRICS,
          minHeightClass
        )}
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
