// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Dominant-colour extraction (isomorphic)
// Bucket-quantisation + ΔE2000 merge. Runs on canvas ImageData
// in the browser and on sharp raw pixels on the server.
// ─────────────────────────────────────────────────────────────
import { rgbToLab, toHex, deltaE2000 } from './color'

export interface PaletteSwatch {
  hex: string
  ratio: number
}

/**
 * @param pixels RGBA buffer (4 bytes/px)
 * @param width buffer width
 * @param height buffer height
 * @param maxColors max swatches to return
 */
export function extractPaletteFromPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  maxColors = 6
): PaletteSwatch[] {
  const buckets = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >()
  let total = 0

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]
    if (a < 128) continue
    total++
    const key = `${r >> 5},${g >> 5},${b >> 5}` // 8 buckets/channel
    const cur = buckets.get(key)
    if (cur) {
      cur.count++
      cur.r += r
      cur.g += g
      cur.b += b
    } else {
      buckets.set(key, { count: 1, r, g, b })
    }
  }

  if (total === 0) return []

  const swatches = [...buckets.values()]
    .map((s) => ({
      rgb: { r: s.r / s.count, g: s.g / s.count, b: s.b / s.count },
      ratio: s.count / total,
    }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 24)

  // merge perceptually-identical buckets (ΔE2000 < 10)
  const merged: { rgb: { r: number; g: number; b: number }; ratio: number }[] = []
  for (const s of swatches) {
    const lab = rgbToLab(s.rgb)
    const dup = merged.find((m) => deltaE2000(lab, rgbToLab(m.rgb)) < 10)
    if (dup) {
      const w = dup.ratio + s.ratio
      dup.rgb = {
        r: (dup.rgb.r * dup.ratio + s.rgb.r * s.ratio) / w,
        g: (dup.rgb.g * dup.ratio + s.rgb.g * s.ratio) / w,
        b: (dup.rgb.b * dup.ratio + s.rgb.b * s.ratio) / w,
      }
      dup.ratio = w
    } else {
      merged.push({ ...s })
    }
  }

  return merged
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, maxColors)
    .map((m) => ({ hex: toHex(m.rgb), ratio: Math.round(m.ratio * 1000) / 1000 }))
}
