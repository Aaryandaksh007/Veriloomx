// ─────────────────────────────────────────────────────────────
// VeriLoom AI — z-ai SDK wrapper (server-only)
// Structured JSON completions + vision analysis, with a
// transparent AI-usage ledger for every call.
// ─────────────────────────────────────────────────────────────
import 'server-only'
import ZAI from 'z-ai-web-dev-sdk'

export interface LedgerEntry {
  model: string
  purpose: string
  ts: string
}

let zaiPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null

async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create()
  return zaiPromise
}

/** Extract the first JSON value from an LLM response. */
export function extractJson<T>(raw: string): T | null {
  if (!raw) return null
  let text = raw.trim()
  // strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const firstObj = text.indexOf('{')
  const firstArr = text.indexOf('[')
  let start = -1
  if (firstObj === -1) start = firstArr
  else if (firstArr === -1) start = firstObj
  else start = Math.min(firstObj, firstArr)
  if (start === -1) return null
  const openCh = text[start]
  const closeCh = openCh === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (esc) {
      esc = false
      continue
    }
    if (c === '\\') {
      esc = true
      continue
    }
    if (c === '"') inStr = !inStr
    if (inStr) continue
    if (c === openCh) depth++
    else if (c === closeCh) {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export interface ChatResult<T> {
  data: T | null
  raw: string
  ledger: LedgerEntry
}

/**
 * Chat completion constrained to a JSON response.
 * `ledgerPurpose` is recorded in the transparent AI ledger.
 */
export async function chatJson<T>(
  systemPrompt: string,
  userPrompt: string,
  ledgerPurpose: string
): Promise<ChatResult<T>> {
  const zai = await getZai()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  const raw = completion.choices[0]?.message?.content ?? ''
  return {
    data: extractJson<T>(raw),
    raw,
    ledger: { model: 'GLM-4.5', purpose: ledgerPurpose, ts: new Date().toISOString() },
  }
}

export interface VisionResult<T> {
  data: T | null
  raw: string
  ledger: LedgerEntry
}

/** Vision analysis of a base64 data-URL image, constrained to JSON. */
export async function visionJson<T>(
  imageDataUrl: string,
  prompt: string,
  ledgerPurpose: string
): Promise<VisionResult<T>> {
  const zai = await getZai()
  const completion = await zai.chat.completions.createVision({
    model: 'glm-4.6v',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })
  const raw = completion.choices?.[0]?.message?.content ?? ''
  return {
    data: extractJson<T>(raw),
    raw,
    ledger: { model: 'GLM-4.6V', purpose: ledgerPurpose, ts: new Date().toISOString() },
  }
}

/** Plain-text completion (for rewrites / suggestions). */
export async function chatText(
  systemPrompt: string,
  userPrompt: string,
  ledgerPurpose: string
): Promise<{ text: string; ledger: LedgerEntry }> {
  const zai = await getZai()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  return {
    text: completion.choices[0]?.message?.content ?? '',
    ledger: { model: 'GLM-4.5', purpose: ledgerPurpose, ts: new Date().toISOString() },
  }
}
