// ─────────────────────────────────────────────────────────────
// VeriLoom AI — server-side Gemini API wrapper.
// Structured JSON completions + vision analysis, with a
// transparent AI-usage ledger for every call.
// ─────────────────────────────────────────────────────────────
import 'server-only'
import { setTimeout as delay } from 'node:timers/promises'

export interface LedgerEntry {
  model: string
  purpose: string
  ts: string
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

function getModel(vision = false): string {
  return vision
    ? process.env.GEMINI_VISION_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'
    : process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'
}

async function complete(
  parts: GeminiPart[],
  options: { systemPrompt?: string; vision?: boolean; json?: boolean } = {}
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY. Add it to .env.local and restart the app.')
  }

  const model = getModel(options.vision)
  let response: Response | undefined
  const maxAttempts = 2
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(40_000),
          body: JSON.stringify({
            ...(options.systemPrompt
              ? { systemInstruction: { parts: [{ text: options.systemPrompt }] } }
              : {}),
            contents: [{ role: 'user', parts }],
            ...(options.json
              ? { generationConfig: { responseMimeType: 'application/json' } }
              : {}),
          }),
        }
      )
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw new Error(
          `Gemini network request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          { cause: error }
        )
      }
      await delay(500 * 2 ** attempt)
      continue
    }

    if (
      response.ok ||
      attempt === maxAttempts - 1 ||
      ![429, 500, 502, 503, 504].includes(response.status)
    ) {
      break
    }
    await response.body?.cancel()
    await delay(500 * 2 ** attempt)
  }

  if (!response) throw new Error('Gemini request ended without a response.')

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini API request failed (${response.status}): ${detail.slice(0, 500)}`)
  }

  const result = (await response.json()) as GeminiResponse
  const text = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('') ?? ''
  return { text, model }
}

/** Extract the first JSON value from an LLM response. */
export function extractJson<T>(raw: string): T | null {
  if (!raw) return null
  let text = raw.trim()
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

/** Chat completion constrained to a JSON response. */
export async function chatJson<T>(
  systemPrompt: string,
  userPrompt: string,
  ledgerPurpose: string
): Promise<ChatResult<T>> {
  const result = await complete(
    [{ text: userPrompt }],
    { systemPrompt, json: true }
  )
  return {
    data: extractJson<T>(result.text),
    raw: result.text,
    ledger: { model: result.model, purpose: ledgerPurpose, ts: new Date().toISOString() },
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
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(imageDataUrl)
  if (!match) throw new Error('Gemini vision requires an image base64 data URL.')
  const result = await complete(
    [{ text: prompt }, { inlineData: { mimeType: match[1], data: match[2] } }],
    { vision: true, json: true }
  )
  return {
    data: extractJson<T>(result.text),
    raw: result.text,
    ledger: { model: result.model, purpose: ledgerPurpose, ts: new Date().toISOString() },
  }
}

/** Plain-text completion (for rewrites / suggestions). */
export async function chatText(
  systemPrompt: string,
  userPrompt: string,
  ledgerPurpose: string
): Promise<{ text: string; ledger: LedgerEntry }> {
  const result = await complete([{ text: userPrompt }], { systemPrompt })
  return {
    text: result.text,
    ledger: { model: result.model, purpose: ledgerPurpose, ts: new Date().toISOString() },
  }
}
