// ─────────────────────────────────────────────────────────────
// VeriLoom AI — Database seeding: the Inkloom Living Brand Vault
// + three pre-loaded demo drafts (with intentional violations)
// ─────────────────────────────────────────────────────────────
import 'server-only'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { db } from './db'
import { extractPaletteFromPixels } from './palette'

interface SeedVaultItem {
  clauseId: string
  type: 'VOICE' | 'FACT' | 'TERM' | 'COLOR' | 'LOGO' | 'CONFIDENTIAL' | 'RULE'
  title: string
  content: string
  extra?: Record<string, unknown>
}

export const SEED_VAULT: SeedVaultItem[] = [
  // ── Tone & Voice ──────────────────────────────────────────
  {
    clauseId: 'VL-VOICE-001',
    type: 'VOICE',
    title: 'Show outcomes, not hype',
    content:
      'Write with confident clarity. Avoid hype words such as "revolutionary", "game-changing" or "magic" — show concrete outcomes instead of exaggerated claims.',
  },
  {
    clauseId: 'VL-VOICE-002',
    type: 'VOICE',
    title: 'Address the reader directly',
    content:
      'Address the reader directly as "you". Never use corporate filler like "valued customer", "dear users" or "esteemed clients".',
  },
  {
    clauseId: 'VL-VOICE-003',
    type: 'VOICE',
    title: 'No fear-based marketing',
    content:
      'Keep urgency honest. Fear, uncertainty and doubt (FUD) tactics — for example "act now or lose out" or "before your competitors leave you behind" — are prohibited.',
  },
  {
    clauseId: 'VL-VOICE-004',
    type: 'VOICE',
    title: 'Exclamation restraint',
    content:
      'Use at most one exclamation mark per paragraph. Prefer confident full stops.',
  },
  {
    clauseId: 'VL-VOICE-005',
    type: 'VOICE',
    title: 'British English spelling',
    content:
      'Inkloom writes in British English: colour, organise, optimise, personalise, centre, licence (noun).',
  },

  // ── Verified Facts ────────────────────────────────────────
  {
    clauseId: 'VL-FACT-001',
    type: 'FACT',
    title: 'Approved pricing (2025)',
    content:
      'Inkloom Starter is $29/user/month. Inkloom Growth is $79/user/month. Inkloom Scale is $149/user/month. All prices are billed annually in USD.',
    extra: { figures: ['$29', '$79', '$149', '29', '79', '149'] },
  },
  {
    clauseId: 'VL-FACT-002',
    type: 'FACT',
    title: 'Customer base',
    content:
      'Inkloom serves 12,000+ teams across 68 countries, including 4 of the 10 largest PR agencies in Europe.',
    extra: { figures: ['12,000', '12000', '68'] },
  },
  {
    clauseId: 'VL-FACT-003',
    type: 'FACT',
    title: 'Uptime commitment',
    content:
      'Inkloom guarantees a 99.9% uptime SLA on Scale plans, measured monthly excluding scheduled maintenance.',
    extra: { figures: ['99.9'] },
  },
  {
    clauseId: 'VL-FACT-004',
    type: 'FACT',
    title: 'Workspace 3.0 launch facts',
    content:
      'Inkloom Workspace v3.0 launched in March 2025, introducing LiveLint real-time editing and the shared Brand Vault.',
    extra: { figures: ['3.0', 'March 2025'] },
  },
  {
    clauseId: 'VL-FACT-005',
    type: 'FACT',
    title: 'Free trial terms',
    content:
      'Inkloom offers a 14-day free trial on all plans. No credit card is required to start a trial.',
    extra: { figures: ['14-day', '14'] },
  },
  {
    clauseId: 'VL-FACT-006',
    type: 'FACT',
    title: 'Integrations',
    content:
      'Inkloom integrates natively with Figma, Notion, Slack, and Google Workspace.',
  },

  // ── Terminology ───────────────────────────────────────────
  {
    clauseId: 'VL-TERM-001',
    type: 'TERM',
    title: 'Banned: "revolutionary"',
    content:
      'The word "revolutionary" is banned in all Inkloom marketing copy. Prefer describing the specific improvement instead.',
    extra: { match: 'revolutionary', kind: 'banned', replaceWith: 'a major step forward' },
  },
  {
    clauseId: 'VL-TERM-002',
    type: 'TERM',
    title: 'Banned: "game-changer" / "game-changing"',
    content:
      '"Game-changer" and "game-changing" are banned terms. State the measurable benefit instead.',
    extra: { match: 'game-changer', aliases: ['game-changers', 'game-changing', 'game changers'], kind: 'banned', replaceWith: 'a meaningful upgrade' },
  },
  {
    clauseId: 'VL-TERM-003',
    type: 'TERM',
    title: 'Banned: "AI magic" / "magic"',
    content:
      'Do not describe product capabilities as "magic", "AI magic" or "magical". Name the actual mechanism.',
    extra: { match: 'magic', aliases: ['magical'], kind: 'banned', replaceWith: 'intelligent assistance' },
  },
  {
    clauseId: 'VL-TERM-004',
    type: 'TERM',
    title: 'Banned: "synergy"',
    content: '"Synergy" is banned jargon. Use "working together" or describe the outcome.',
    extra: { match: 'synergy', aliases: ['synergies', 'synergistic'], kind: 'banned', replaceWith: 'working together' },
  },
  {
    clauseId: 'VL-TERM-005',
    type: 'TERM',
    title: 'Deprecated product name: "Inkloom Studio"',
    content:
      'The product formerly known as "Inkloom Studio" was renamed to "Inkloom Workspace" in March 2025. All new copy must use "Inkloom Workspace".',
    extra: { match: 'Inkloom Studio', kind: 'deprecated', replaceWith: 'Inkloom Workspace' },
  },
  {
    clauseId: 'VL-TERM-006',
    type: 'TERM',
    title: 'Feature name: "Inkloom Copilot"',
    content:
      'The AI writing assistant must be referred to as "Inkloom Copilot" — never "AI assistant", "AI helper" or "chatbot".',
    extra: { match: 'AI assistant', aliases: ['AI helper', 'chatbot'], kind: 'deprecated', replaceWith: 'Inkloom Copilot' },
  },

  // ── Colour palette ────────────────────────────────────────
  {
    clauseId: 'VL-COLOR-001',
    type: 'COLOR',
    title: 'Loom Coral (primary)',
    content:
      'Loom Coral #F43F5E is the primary Inkloom brand colour for headlines, CTAs, and the logo mark.',
    extra: { hex: '#F43F5E', role: 'primary' },
  },
  {
    clauseId: 'VL-COLOR-002',
    type: 'COLOR',
    title: 'Loom Amber (secondary)',
    content:
      'Loom Amber #F59E0B is the secondary accent colour for highlights, badges, and illustrations.',
    extra: { hex: '#F59E0B', role: 'secondary' },
  },
  {
    clauseId: 'VL-COLOR-003',
    type: 'COLOR',
    title: 'Loom Teal (support)',
    content: 'Loom Teal #14B8A6 is the support colour for links, data visuals, and success states.',
    extra: { hex: '#14B8A6', role: 'support' },
  },
  {
    clauseId: 'VL-COLOR-004',
    type: 'COLOR',
    title: 'Loom Ink (text)',
    content: 'Loom Ink #292524 is the standard body-text colour on light backgrounds.',
    extra: { hex: '#292524', role: 'text' },
  },
  {
    clauseId: 'VL-COLOR-005',
    type: 'COLOR',
    title: 'Loom Cream (background)',
    content: 'Loom Cream #FEF3C7 is the approved warm background colour for banners and cards.',
    extra: { hex: '#FEF3C7', role: 'background' },
  },

  // ── Logo & assets ─────────────────────────────────────────
  {
    clauseId: 'VL-LOGO-001',
    type: 'LOGO',
    title: 'Logo usage rules',
    content:
      'The Inkloom logo is the loom-knot mark in Loom Coral on Loom Cream or white backgrounds only. Minimum clear space is 24px on all sides. Never stretch, rotate, recolour, or place the logo on saturated backgrounds.',
  },

  // ── Confidential codenames ────────────────────────────────
  {
    clauseId: 'VL-CONF-001',
    type: 'CONFIDENTIAL',
    title: 'Unreleased codename: Project Nightloom',
    content:
      '"Project Nightloom" is an unreleased product codename. It must never appear in public-facing copy and must be redacted before any external AI processing.',
    extra: { term: 'Project Nightloom' },
  },
  {
    clauseId: 'VL-CONF-002',
    type: 'CONFIDENTIAL',
    title: 'Unreleased codename: Project Nectarine',
    content:
      '"Project Nectarine" is an unreleased partnership codename. It must never appear in public-facing copy and must be redacted before any external AI processing.',
    extra: { term: 'Project Nectarine' },
  },
  {
    clauseId: 'VL-CONF-003',
    type: 'CONFIDENTIAL',
    title: 'Internal-only contacts',
    content:
      'Internal email addresses (e.g. @inkloom-internal.dev) and phone numbers must be scrubbed from all drafts before publication and before external AI processing.',
  },

  // ── General governance rules ──────────────────────────────
  {
    clauseId: 'VL-RULE-001',
    type: 'RULE',
    title: 'Every figure must be verifiable',
    content:
      'All pricing figures, percentages, statistics and comparative claims in Inkloom copy must trace to an approved fact in this Vault. Unverifiable figures must be removed or verified before publication.',
  },
  {
    clauseId: 'VL-A11Y-001',
    type: 'RULE',
    title: 'Accessibility baseline (WCAG 2.1 AA)',
    content:
      'Every published image must include descriptive alt text (WCAG 2.1 AA, Success Criterion 1.1.1 Non-text Content). Text rendered inside images must meet WCAG 2.1 AA contrast ratios: 4.5:1 for normal text, 3:1 for large text (24px+ or 18.66px+ bold).',
  },
]

export const SAMPLE_LINKEDIN_POST = `Big news, valued customers!

Our revolutionary new release is here, and it will change how your whole company creates content forever. Inkloom Studio now ships with LiveLint editing, real-time brand checks, and AI magic baked into every workflow.

Join 15,000+ teams worldwide who already trust Inkloom to keep their brand on-message. Plans start at just $39/user/month — a fraction of what the competition charges.

We're also giving early readers a sneak peek at Project Nightloom before the official unveiling. Want in? Email aaryan@inkloom-internal.dev today!

Act now — before your competitors leave you behind!!! Your brand won't save itself.`

export const SAMPLE_PRESS_RELEASE = `Inkloom Workspace 3.0 brings governed brand publishing to every team

Inkloom, the brand-governance platform used by 12,000+ teams across 68 countries, today announced Inkloom Workspace 3.0 — the most complete way to keep every publication on-brand.

Workspace 3.0 introduces LiveLint editing, a shared Brand Vault, and one-click approval workflows. Teams can organize their guidelines, terminology, and approved assets in one place, with WCAG 2.1 AA checks running automatically on every export.

New customers can start with a 30-day free trial on any plan, and existing subscribers gain Workspace 3.0 at no extra cost.

"Compliance should keep up with creativity, not slow it down," said Priya Nair, Head of Product at Inkloom. "Workspace 3.0 gives every creator a co-pilot that protects the brand while preserving their voice."`

async function buildBannerDraft(): Promise<{
  imageData: string
  imageMeta: string
}> {
  const imgPath = path.join(process.cwd(), 'public', 'samples', 'banner-sale.png')
  const buffer = fs.readFileSync(imgPath)
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`

  const meta = await sharp(buffer).metadata()
  const small = await sharp(buffer)
    .resize(96, 96, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const palette = extractPaletteFromPixels(
    new Uint8Array(small.data),
    small.info.width,
    small.info.height
  )

  return {
    imageData: dataUrl,
    imageMeta: JSON.stringify({
      palette,
      altText: '',
      width: meta.width ?? 1200,
      height: meta.height ?? 630,
      fileName: 'banner-sale.png',
    }),
  }
}

let seedPromise: Promise<void> | null = null

/** Idempotent seed — safe to call on every bootstrap. */
export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise
  seedPromise = (async () => {
    const count = await db.vaultItem.count()
    if (count === 0) await seedNow()
    const items = await db.vaultItem.findMany({ include: { history: { select: { id: true }, take: 1 } } })
    const initialVersions = items
      .filter((item) => item.history.length === 0)
      .map((item) => ({
        vaultItemId: item.id,
        version: item.ruleVer,
        title: item.title,
        content: item.content,
        extra: item.extra,
        active: item.active,
        editedBy: 'System migration',
        editNote: 'Initial rule snapshot',
      }))
    if (initialVersions.length) {
      await db.vaultItemVersion.createMany({ data: initialVersions, skipDuplicates: true })
    }
  })()
  try {
    await seedPromise
  } catch (err) {
    seedPromise = null
    throw err
  }
}

async function seedNow(): Promise<void> {
  const count = await db.vaultItem.count()
  if (count > 0) return

  await db.vaultItem.createMany({
    data: SEED_VAULT.map((item) => ({
      clauseId: item.clauseId,
      type: item.type,
      title: item.title,
      content: item.content,
      extra: item.extra ? JSON.stringify(item.extra) : null,
    })),
  })

  // ── Draft 1: LinkedIn post riddled with violations ────────
  const d1 = await db.draft.create({
    data: {
      title: 'Q3 Feature Launch — LinkedIn post',
      channel: 'LinkedIn',
      kind: 'text',
      status: 'DRAFT',
      creator: 'Maya Chen',
      content: SAMPLE_LINKEDIN_POST,
      version: 1,
    },
  })
  await db.draftVersion.create({
    data: { draftId: d1.id, version: 1, content: SAMPLE_LINKEDIN_POST, note: 'Original submission' },
  })

  // ── Draft 2: off-brand banner image ───────────────────────
  const banner = await buildBannerDraft()
  const d2 = await db.draft.create({
    data: {
      title: 'Summer Sale Banner — paid social',
      channel: 'Social',
      kind: 'image',
      status: 'DRAFT',
      creator: 'Maya Chen',
      content: '',
      imageData: banner.imageData,
      imageMeta: banner.imageMeta,
      version: 1,
    },
  })
  await db.draftVersion.create({
    data: { draftId: d2.id, version: 1, content: '', imageData: banner.imageData, imageMeta: banner.imageMeta, note: 'Original submission' },
  })

  // ── Draft 3: press release with subtle issues ─────────────
  const d3 = await db.draft.create({
    data: {
      title: 'Inkloom Workspace 3.0 — Press release',
      channel: 'Press',
      kind: 'text',
      status: 'DRAFT',
      creator: 'Maya Chen',
      content: SAMPLE_PRESS_RELEASE,
      version: 1,
    },
  })
  await db.draftVersion.create({
    data: { draftId: d3.id, version: 1, content: SAMPLE_PRESS_RELEASE, note: 'Original submission' },
  })

  await db.eventLog.create({
    data: {
      actor: 'Dev Kapoor',
      action: 'VAULT_INIT',
      details: JSON.stringify({
        message: `Living Brand Vault initialised with ${SEED_VAULT.length} indexed clauses`,
      }),
    },
  })

  // ── One-time background demo run: full governance loop on ──
  // draft 1 (audit → override → remediate → approve) + image audit
  // on draft 2, so first-time visitors land on a living workspace.
  void runDemoGoldenPath(d1.id, d2.id).catch((err) =>
    console.error('[seed] demo golden path failed (non-fatal):', err)
  )
}

let demoPromise: Promise<void> | null = null

async function runDemoGoldenPath(textDraftId: string, imageDraftId: string): Promise<void> {
  if (demoPromise) return demoPromise
  demoPromise = (async () => {
    const { runAudit } = await import('./audit/engine')
    const { db: database } = await import('./db')

    // 1 ─ audit the LinkedIn post
    const audit = await runAudit(textDraftId, 'Maya Chen')
    const findings = audit.findings

    // 2 ─ resolve every finding (accept / edit / one justified override)
    for (const f of findings) {
      let payload: Record<string, unknown> | null = null
      const title = f.title.toLowerCase()
      if (f.pillar === 'confidentiality' && title.includes('codename')) {
        payload = {
          action: 'edited',
          appliedText: 'our next big update',
          actor: 'Maya Chen',
          actorRole: 'creator',
        }
      } else if (f.pillar === 'confidentiality') {
        payload = {
          action: 'edited',
          appliedText: 'hello@inkloom.ai',
          actor: 'Maya Chen',
          actorRole: 'creator',
        }
      } else if (f.pillar === 'tone' && (f.clauseTitle ?? '').toLowerCase().includes('fear')) {
        payload = {
          action: 'overridden',
          note: 'Urgency phrasing pre-approved by Legal for this flash-sale audience segment; CTA intent preserved.',
          actor: 'Maya Chen',
          actorRole: 'creator',
        }
      } else if (f.suggestion) {
        payload = { action: 'accepted', actor: 'Maya Chen', actorRole: 'creator' }
      } else {
        payload = {
          action: 'overridden',
          note: 'Reviewed manually — creator chose to keep this wording for launch context.',
          actor: 'Maya Chen',
          actorRole: 'creator',
        }
      }
      await database.findingAction.create({
        data: { auditId: audit.id, findingKey: f.key, ...payload } as never,
      })
    }

    // 3 ─ remediate (reuse route logic inline)
    let content = SAMPLE_LINKEDIN_POST
    const actions = await database.findingAction.findMany({ where: { auditId: audit.id } })
    const byKey = new Map(actions.map((a) => [a.findingKey, a]))
    for (const f of findings) {
      const act = byKey.get(f.key)
      if (!act || act.action === 'overridden' || !f.quote) continue
      const replacement = act.appliedText ?? f.suggestion ?? f.quote
      const idx = content.indexOf(f.quote)
      if (idx !== -1) {
        content = content.slice(0, idx) + replacement + content.slice(idx + f.quote.length)
      }
    }
    await database.draftVersion.create({
      data: {
        draftId: textDraftId,
        version: 2,
        content,
        note: `Remediated — fixes applied, 1 human override preserved`,
      },
    })
    await database.draft.update({
      where: { id: textDraftId },
      data: { content, version: 2, status: 'REMEDIATED' },
    })

    // 4 ─ review loop: submit → approve
    await database.draft.update({ where: { id: textDraftId }, data: { status: 'IN_REVIEW' } })
    await database.eventLog.create({
      data: {
        draftId: textDraftId,
        actor: 'Maya Chen',
        action: 'STATUS_CHANGE',
        details: JSON.stringify({ from: 'REMEDIATED', to: 'IN_REVIEW' }),
      },
    })
    await database.comment.create({
      data: {
        draftId: textDraftId,
        author: 'Dev Kapoor',
        role: 'manager',
        body: 'Reviewed the diff — pricing and claims now match the Vault. The FUD-line override is acceptable given Legal sign-off. Escalating for final approval.',
      },
    })
    await database.draft.update({ where: { id: textDraftId }, data: { status: 'APPROVED' } })
    await database.eventLog.create({
      data: {
        draftId: textDraftId,
        actor: 'Aaryan Sharma',
        action: 'STATUS_CHANGE',
        details: JSON.stringify({ from: 'IN_REVIEW', to: 'APPROVED' }),
      },
    })
    await database.eventLog.create({
      data: {
        draftId: textDraftId,
        actor: 'Aaryan Sharma',
        action: 'CERT_ISSUED',
        details: JSON.stringify({ auditId: audit.id, version: 2 }),
      },
    })

    // 5 ─ audit the banner image too (VLM pipeline) and leave it for remediation
    await runAudit(imageDraftId, 'Maya Chen')
  })()
  return demoPromise
}
