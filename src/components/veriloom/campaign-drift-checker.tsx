'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Check, RotateCcw, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { compareCampaignClaims } from '@/lib/campaign-drift'
import { cn } from '@/lib/utils'

const EXAMPLE_SOURCE =
  'Inkloom Starter is $29/user/month. Inkloom offers a 14-day free trial. The Scale plan includes a 99.9% monthly uptime SLA. Inkloom serves 12,000+ teams across 68 countries.'

const EXAMPLE_VARIANT =
  'Our plans start at $39/user/month. Scale customers get a 30-day free trial and a 99.99% uptime guarantee, trusted by 15,000+ teams across 90 countries.'

export function CampaignDriftChecker() {
  const [source, setSource] = useState(EXAMPLE_SOURCE)
  const [variant, setVariant] = useState(EXAMPLE_VARIANT)
  const [hasExample, setHasExample] = useState(true)
  const drift = useMemo(() => compareCampaignClaims(source, variant), [source, variant])
  const hasInput = Boolean(source.trim() || variant.trim())
  const hasBothVersions = Boolean(source.trim() && variant.trim())
  const hasDrift = drift.sourceOnly.length > 0 || drift.variantOnly.length > 0

  const clear = () => {
    setSource('')
    setVariant('')
    setHasExample(false)
  }

  const loadExample = () => {
    setSource(EXAMPLE_SOURCE)
    setVariant(EXAMPLE_VARIANT)
    setHasExample(true)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-paper">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-terra-700">
            Cross-channel safeguard
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-serif text-lg font-semibold tracking-tight text-ink">
            <ArrowLeftRight className="h-4 w-4 text-terra-600" />
            Did the claim drift between channels?
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Compare an approved source with an email, ad, or social adaptation. Numeric
            claims are checked locally in this browser; neither text box is sent to the server.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={loadExample}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Example
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} disabled={!hasInput}>
            Clear
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-2">
        <label className="block space-y-2">
          <span className="flex items-center justify-between gap-2 text-xs font-bold text-ink">
            Approved source copy
            <span className="font-normal text-faint">The reference</span>
          </span>
          <Textarea
            aria-label="Approved source copy"
            value={source}
            onChange={(event) => {
              setSource(event.target.value)
              setHasExample(false)
            }}
            placeholder="Paste approved source copy…"
            className="min-h-36 resize-y border-line bg-parchment/30 text-sm leading-relaxed"
          />
        </label>

        <label className="block space-y-2">
          <span className="flex items-center justify-between gap-2 text-xs font-bold text-ink">
            Channel adaptation
            <span className="font-normal text-faint">The version to compare</span>
          </span>
          <Textarea
            aria-label="Channel adaptation"
            value={variant}
            onChange={(event) => {
              setVariant(event.target.value)
              setHasExample(false)
            }}
            placeholder="Paste the email, ad, or social version…"
            className="min-h-36 resize-y border-line bg-parchment/30 text-sm leading-relaxed"
          />
        </label>
      </div>

      <div className="border-t border-line bg-parchment/40 px-5 py-4 sm:px-6">
        {!hasInput ? (
          <p className="text-sm text-ink-soft">
            Paste both versions or load the example to check for numeric claim drift.
          </p>
        ) : !hasBothVersions ? (
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="text-sm font-semibold text-ink">Add both versions to compare</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Paste the approved source and its channel adaptation.
            </p>
          </div>
        ) : !hasDrift ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-olive-200 bg-olive-50/70 p-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-olive-700" />
            <div>
              <p className="text-sm font-semibold text-olive-900">No numeric drift detected</p>
              <p className="mt-0.5 text-xs leading-relaxed text-olive-800">
                {`${drift.matched} numeric ${drift.matched === 1 ? 'claim matches' : 'claims match'} across both versions.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-lg border border-ochre-200 bg-ochre-50/70 p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ochre-700" />
              <div>
                <p className="text-sm font-semibold text-ochre-900">Possible claim drift</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ochre-800">
                  {drift.sourceOnly.length} source {drift.sourceOnly.length === 1 ? 'figure is' : 'figures are'} absent
                  {' · '}
                  {drift.variantOnly.length} new {drift.variantOnly.length === 1 ? 'figure appears' : 'figures appear'} in the adaptation.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ClaimList
                title="In source, not adaptation"
                values={drift.sourceOnly.map((claim) => claim.value)}
                tone="border-stone-200 bg-paper text-ink-soft"
              />
              <ClaimList
                title="New in adaptation"
                values={drift.variantOnly.map((claim) => claim.value)}
                tone="border-clay-200 bg-paper text-clay-800"
              />
            </div>
          </div>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-faint">
          <span className="font-semibold">Signal, not verdict:</span>
          <span>
            this compares numeric tokens only. An omitted figure may be intentional, and
            matching numbers do not prove that the surrounding claims mean the same thing.
            Run the full audit before approval.
            {hasExample ? ' The loaded example illustrates five deliberately changed figures.' : ''}
          </span>
        </p>
      </div>
    </section>
  )
}

function ClaimList({
  title,
  values,
  tone,
}: {
  title: string
  values: string[]
  tone: string
}) {
  return (
    <div className={cn('rounded-lg border p-3', tone)}>
      <p className="text-[10px] font-bold uppercase tracking-wider">{title}</p>
      {values.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="rounded-md border border-current/15 bg-white/70 px-2 py-1 font-mono text-xs font-semibold"
            >
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs">None</p>
      )}
    </div>
  )
}
