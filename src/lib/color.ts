// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Deterministic colour science
// sRGB → CIEXYZ (D65) → CIELAB, ΔE2000 perceptual distance,
// and WCAG 2.1 relative-luminance contrast mathematics.
// These functions are pure, exact, and never delegated to an LLM.
// ─────────────────────────────────────────────────────────────

export interface RGB {
  r: number
  g: number
  b: number
} // 0–255
export interface LAB {
  L: number
  a: number
  b: number
}

export function parseHex(hex: string): RGB | null {
  const m = hex.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(m)) {
    return {
      r: parseInt(m[0] + m[0], 16),
      g: parseInt(m[1] + m[1], 16),
      b: parseInt(m[2] + m[2], 16),
    }
  }
  if (/^[0-9a-fA-F]{6}$/.test(m)) {
    return {
      r: parseInt(m.slice(0, 2), 16),
      g: parseInt(m.slice(2, 4), 16),
      b: parseInt(m.slice(4, 6), 16),
    }
  }
  return null
}

export function toHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

/** sRGB (0–255) → linear RGB (0–1), WCAG gamma expansion */
function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG 2.1 relative luminance L = 0.2126R + 0.7152G + 0.0722B */
export function relativeLuminance({ r, g, b }: RGB): number {
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  )
}

/** WCAG 2.1 contrast ratio CR = (L₁ + 0.05) / (L₂ + 0.05) */
export function contrastRatio(fg: string | RGB, bg: string | RGB): number | null {
  const a = typeof fg === 'string' ? parseHex(fg) : fg
  const b = typeof bg === 'string' ? parseHex(bg) : bg
  if (!a || !b) return null
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export const WCAG_AA_NORMAL = 4.5
export const WCAG_AA_LARGE = 3.0

/** WCAG AA check. Large text = ≥18pt (24px) or ≥14pt (18.66px) bold */
export function wcagCheck(
  fg: string,
  bg: string,
  isLargeText: boolean
): { ratio: number; required: number; passes: boolean } | null {
  const ratio = contrastRatio(fg, bg)
  if (ratio === null) return null
  const required = isLargeText ? WCAG_AA_LARGE : WCAG_AA_NORMAL
  return { ratio, required, passes: ratio >= required }
}

/** sRGB → CIELAB (D65 reference white) */
export function rgbToLab({ r, g, b }: RGB): LAB {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  // Linear sRGB → XYZ (D65)
  let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  let z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041

  // Normalise by D65 white point
  x /= 0.95047
  z /= 1.08883

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

export function hexToLab(hex: string): LAB | null {
  const rgb = parseHex(hex)
  return rgb ? rgbToLab(rgb) : null
}

/**
 * CIEDE2000 colour-difference (ΔE00) — the ISO/CIE perceptual metric.
 * Implements the full Sharma et al. (2005) formulation.
 */
export function deltaE2000(lab1: LAB, lab2: LAB): number {
  const { L: L1, a: a1, b: b1 } = lab1
  const { L: L2, a: a2, b: b2 } = lab2

  const kL = 1
  const kC = 1
  const kH = 1

  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const Cbar = (C1 + C2) / 2

  const Cbar7 = Math.pow(Cbar, 7)
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))) // 25^7

  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)
  const C1p = Math.sqrt(a1p * a1p + b1 * b1)
  const C2p = Math.sqrt(a2p * a2p + b2 * b2)

  const h1p =
    C1p === 0 ? 0 : ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360
  const h2p =
    C2p === 0 ? 0 : ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360)

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  let hbarp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) {
      if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2
      else hbarp = (h1p + h2p - 360) / 2
    } else {
      hbarp = (h1p + h2p) / 2
    }
  } else {
    hbarp = h1p + h2p
  }

  const T =
    1 -
    0.17 * Math.cos(((hbarp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hbarp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hbarp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hbarp - 63) * Math.PI) / 180)

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2))
  const Cbarp7 = Math.pow(Cbarp, 7)
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 6103515625))
  const SL =
    1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2))
  const SC = 1 + 0.045 * Cbarp
  const SH = 1 + 0.015 * Cbarp * T
  const RT = -Math.sin((2 * dTheta * Math.PI) / 180) * RC

  const dL = dLp / (kL * SL)
  const dC = dCp / (kC * SC)
  const dH = dHp / (kH * SH)

  return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH)
}

/** ΔE2000 between two hex colours */
export function deltaEHex(hex1: string, hex2: string): number | null {
  const l1 = hexToLab(hex1)
  const l2 = hexToLab(hex2)
  if (!l1 || !l2) return null
  return deltaE2000(l1, l2)
}

/** Brand palette tolerance from the VeriLoom spec */
export const DELTA_E_THRESHOLD = 5.0

/**
 * Find the closest brand colour for an extracted colour.
 * Returns null if the hex is invalid.
 */
export function closestBrandColor(
  hex: string,
  brandHexes: string[]
): { hex: string; deltaE: number } | null {
  let best: { hex: string; deltaE: number } | null = null
  for (const brand of brandHexes) {
    const de = deltaEHex(hex, brand)
    if (de !== null && (best === null || de < best.deltaE)) {
      best = { hex: brand, deltaE: de }
    }
  }
  return best
}
