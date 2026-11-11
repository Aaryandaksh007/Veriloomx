export interface NumericClaim {
  key: string
  value: string
}

export interface CampaignDrift {
  sourceOnly: NumericClaim[]
  variantOnly: NumericClaim[]
  matched: number
}

const CLAIM_PATTERN =
  /(?:[$€£]\s*)?\d[\d,]*(?:\.\d+)?\+?(?:\s*(?:%|percent\b|\/\s*(?:user|seat|month|year|team|account)(?:\s*\/\s*(?:user|seat|month|year|team|account))?|[- ](?:day|days|week|weeks|month|months|year|years|user|users|team|teams|country|countries)\b))?/gi

function normalizeClaim(value: string): string {
  return value
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/-(day|days|week|weeks|month|months|year|years|user|users|team|teams|country|countries)$/i, '$1')
    .replace(/(days|weeks|months|years|users|teams|countries)$/i, (unit) => unit.slice(0, -1))
}

export function extractNumericClaims(text: string): NumericClaim[] {
  const claims = new Map<string, NumericClaim>()

  for (const match of text.matchAll(CLAIM_PATTERN)) {
    const value = match[0].trim()
    const key = normalizeClaim(value)
    if (!claims.has(key)) claims.set(key, { key, value })
  }

  return [...claims.values()]
}

export function compareCampaignClaims(source: string, variant: string): CampaignDrift {
  const sourceClaims = extractNumericClaims(source)
  const variantClaims = extractNumericClaims(variant)
  const sourceKeys = new Set(sourceClaims.map((claim) => claim.key))
  const variantKeys = new Set(variantClaims.map((claim) => claim.key))

  return {
    sourceOnly: sourceClaims.filter((claim) => !variantKeys.has(claim.key)),
    variantOnly: variantClaims.filter((claim) => !sourceKeys.has(claim.key)),
    matched: sourceClaims.filter((claim) => variantKeys.has(claim.key)).length,
  }
}
