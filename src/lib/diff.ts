// ─────────────────────────────────────────────────────────────
// VeriLoom AI — minimal word-level LCS diff (for version compare)
// ─────────────────────────────────────────────────────────────

export type DiffOp = 'same' | 'add' | 'remove'

export interface DiffToken {
  op: DiffOp
  text: string
}

function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? []
}

/** Word-level diff between two texts. */
export function wordDiff(a: string, b: string): DiffToken[] {
  const A = tokenize(a)
  const B = tokenize(b)
  const n = A.length
  const m = B.length

  // LCS length table (guard against huge inputs)
  if (n * m > 1_500_000) {
    return [
      { op: 'remove', text: a },
      { op: 'add', text: b },
    ]
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffToken[] = []
  const push = (op: DiffOp, text: string) => {
    const last = out[out.length - 1]
    if (last && last.op === op) last.text += text
    else out.push({ op, text })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push('same', A[i])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('remove', A[i])
      i++
    } else {
      push('add', B[j])
      j++
    }
  }
  while (i < n) push('remove', A[i++])
  while (j < m) push('add', B[j++])

  return out
}

/** Replace first/all occurrences of `quote` in `text` with `replacement`. */
export function replaceQuote(
  text: string,
  quote: string,
  replacement: string
): { text: string; replaced: boolean } {
  if (!quote) return { text, replaced: false }
  const idx = text.indexOf(quote)
  if (idx === -1) {
    // fuzzy: collapse whitespace
    const norm = (s: string) => s.replace(/\s+/g, ' ')
    const nText = norm(text)
    const nQuote = norm(quote)
    const nIdx = nText.indexOf(nQuote)
    if (nIdx === -1) return { text, replaced: false }
    // cannot safely map back — bail out
    return { text, replaced: false }
  }
  return {
    text: text.slice(0, idx) + replacement + text.slice(idx + quote.length),
    replaced: true,
  }
}
