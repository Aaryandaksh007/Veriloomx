// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Visual & Accessibility pillars for image drafts
// Pillar 4: CIELAB ΔE2000 palette distance (pure math)
// Pillar 5: VLM-sampled text regions + exact WCAG 2.1 contrast
// ─────────────────────────────────────────────────────────────
import type { VaultItem } from '@prisma/client'
import type { Finding, ImageMeta } from '../types'
import {
  closestBrandColor,
  deltaEHex,
  hexToLab,
  wcagCheck,
  DELTA_E_THRESHOLD,
} from '../color'
import { visionJson, type LedgerEntry } from '../ai'
import { vaultExtra } from './deterministic'

export interface VisualOutcome {
  findings: Finding[]
  ledger: LedgerEntry[]
  parseError: boolean
}

// ── Pillar 4: Visual palette (deterministic ΔE2000) ──────────

export function runVisualPalette(
  palette: { hex: string; ratio: number }[],
  colorItems: VaultItem[]
): Finding[] {
  const findings: Finding[] = []
  if (palette.length === 0 || colorItems.length === 0) return findings

  const brand = colorItems.map((item) => ({
    item,
    hex: String(vaultExtra(item).hex ?? '').toUpperCase(),
  })).filter((b) => b.hex.startsWith('#'))

  let n = 0
  for (const swatch of palette) {
    if (swatch.ratio < 0.02) continue // ignore noise (<2% of pixels)
    const lab = hexToLab(swatch.hex)
    if (!lab) continue
    // Neutral greys / white / black are exempt from palette checks
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
    if (chroma < 12) continue

    const closest = closestBrandColor(swatch.hex, brand.map((b) => b.hex))
    if (!closest) continue
    if (closest.deltaE <= DELTA_E_THRESHOLD) continue

    const match = brand.find((b) => b.hex === closest.hex)!
    const veryOff = closest.deltaE > 25 || swatch.ratio > 0.35
    findings.push({
      key: `visual-det-${n++}`,
      pillar: 'visual',
      severity: veryOff ? 'critical' : 'warning',
      engine: 'deterministic',
      title: `Off-brand colour ${swatch.hex} (ΔE ${closest.deltaE.toFixed(1)})`,
      quote: '',
      explanation: `This colour covers ${(swatch.ratio * 100).toFixed(0)}% of the asset but sits ${closest.deltaE.toFixed(1)} ΔE2000 units from the closest approved brand colour ${closest.hex} (${match.item.title}). The brand tolerance is ΔE ≤ ${DELTA_E_THRESHOLD}.`,
      clauseId: match.item.clauseId,
      clauseQuote: match.item.content,
      clauseTitle: match.item.title,
      suggestion: match.hex,
      suggestionSource: 'deterministic',
      meta: {
        swatch: swatch.hex,
        coverage: swatch.ratio,
        closest: closest.hex,
        deltaE: Math.round(closest.deltaE * 10) / 10,
        threshold: DELTA_E_THRESHOLD,
      },
    })
  }
  return findings
}

// ── Pillar 5: Accessibility (VLM sampling + exact math) ──────

export interface VlmTextRegion {
  content?: string
  textColor?: string
  bgColor?: string
  size?: string
  box?: { x?: number; y?: number; w?: number; h?: number }
}

export interface VlmImageAnalysis {
  texts?: VlmTextRegion[]
  description?: string
  logo?: { present?: boolean; description?: string }
}

export interface AccessibilityOutcome {
  contrastFindings: Finding[]
  logoFindings: Finding[]
  altTextSuggestion: string | null
  extractedTexts: string[]
  ledger: LedgerEntry[]
  parseError: boolean
}

export async function runImageVlm(
  imageDataUrl: string,
  rules: { a11y: VaultItem | null; logo: VaultItem | null }
): Promise<AccessibilityOutcome> {
  const empty: AccessibilityOutcome = {
    contrastFindings: [],
    logoFindings: [],
    altTextSuggestion: null,
    extractedTexts: [],
    ledger: [],
    parseError: true,
  }
  if (!imageDataUrl) return empty

  const prompt = `Analyse this marketing image as an accessibility inspector.

1. For EACH distinct text element you can see, report:
   - "content": the text,
   - "textColor": your best estimate of its hex colour,
   - "bgColor": your best estimate of the hex colour of the surface directly behind that text,
   - "size": "large" if it is a big headline (roughly 24px+ at full size), else "normal",
   - "box": approximate bounding box as percentages of the image, {"x": left%, "y": top%, "w": width%, "h": height%}.
2. "logo": is a brand logo visible? {"present": true/false, "description": "..."}.
3. "description": one descriptive sentence suitable as alt text for this image.

Respond ONLY with JSON:
{"texts":[{"content":"...","textColor":"#RRGGBB","bgColor":"#RRGGBB","size":"large"|"normal","box":{"x":0,"y":0,"w":0,"h":0}}],"logo":{"present":false,"description":""},"description":"..."}`

  const res = await visionJson<VlmImageAnalysis>(
    imageDataUrl,
    prompt,
    'Visual region sampling for WCAG contrast'
  )

  if (!res.data || !Array.isArray(res.data.texts)) {
    return { ...empty, ledger: [res.ledger] }
  }

  const extractedTexts = res.data.texts
    .map((t) => String(t.content ?? ''))
    .filter(Boolean)

  // ── Deterministic WCAG 2.1 math on VLM-sampled regions ──
  const contrastFindings: Finding[] = []
  let n = 0
  for (const t of res.data.texts) {
    const content = String(t.content ?? '').trim()
    const fg = String(t.textColor ?? '').trim()
    const bg = String(t.bgColor ?? '').trim()
    if (!content || !fg || !bg) continue
    const isLarge = t.size === 'large'
    const check = wcagCheck(fg, bg, isLarge)
    if (!check) continue
    if (check.passes) continue

    const rule = rules.a11y
    contrastFindings.push({
      key: `a11y-${n++}`,
      pillar: 'accessibility',
      severity: check.ratio < 3 ? 'critical' : 'warning',
      engine: 'hybrid',
      title: `WCAG 2.1 AA contrast failure — “${content.slice(0, 40)}${content.length > 40 ? '…' : ''}”`,
      quote: content,
      explanation: `Text ${fg} on ${bg} has a contrast ratio of ${check.ratio.toFixed(2)}:1 — below the WCAG 2.1 AA requirement of ${check.required}:1 for ${isLarge ? 'large' : 'normal'} text. Computed with exact relative-luminance math (L = 0.2126R + 0.7152G + 0.0722B).`,
      clauseId: rule?.clauseId ?? null,
      clauseQuote: rule?.content ?? null,
      clauseTitle: rule?.title ?? null,
      suggestion: null,
      suggestionSource: null,
      box: normalizeBox(t.box),
      meta: {
        fg,
        bg,
        ratio: Math.round(check.ratio * 100) / 100,
        required: check.required,
        size: isLarge ? 'large' : 'normal',
      },
    })
  }

  // ── Logo presence (VLM-assisted, cited to logo rule) ──────
  const logoFindings: Finding[] = []
  const logoRule = rules.logo
  if (logoRule) {
    const present = res.data.logo?.present === true
    if (!present) {
      logoFindings.push({
        key: 'visual-logo-0',
        pillar: 'visual',
        severity: 'warning',
        engine: 'vlm',
        title: 'Official logo not detected',
        quote: '',
        explanation: `No Inkloom loom-knot mark was detected in this asset. ${res.data.logo?.description ? `Vision model noted: “${res.data.logo.description}”. ` : ''}Published social creative must carry the official logo per the asset rules.`,
        clauseId: logoRule.clauseId,
        clauseQuote: logoRule.content,
        clauseTitle: logoRule.title,
        suggestion: null,
        suggestionSource: null,
      })
    }
  }

  return {
    contrastFindings,
    logoFindings,
    altTextSuggestion: res.data.description?.trim() || null,
    extractedTexts,
    ledger: [res.ledger],
    parseError: false,
  }
}

function normalizeBox(
  box?: { x?: number; y?: number; w?: number; h?: number }
): { x: number; y: number; w: number; h: number } | undefined {
  if (!box) return undefined
  const x = clamp(Number(box.x ?? 0))
  const y = clamp(Number(box.y ?? 0))
  const w = clamp(Number(box.w ?? 20))
  const h = clamp(Number(box.h ?? 8))
  if ([x, y, w, h].some((v) => isNaN(v))) return undefined
  return { x, y, w, h }
}

function clamp(v: number): number {
  if (isNaN(v)) return 0
  return Math.max(0, Math.min(100, v))
}

export { deltaEHex }
