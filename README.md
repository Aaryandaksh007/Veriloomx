# VeriLoom AI

**Catch brand, claims, and accessibility problems before a campaign goes live.**

VeriLoom is a hackathon prototype for pre-publication brand governance. It gives a marketing team one auditable workflow: check a draft against a living brand vault, review grounded findings, make human decisions, and issue a tamper-evident approval certificate.

## What makes the demo different

- **Deterministic checks where exactness matters:** terminology, numeric claims, color distance (ΔE2000), contrast ratios (WCAG), and local confidentiality scrubbing.
- **AI where language understanding helps:** Gemini reviews tone and claims against the brand vault, and samples text regions in images. AI findings are citation-checked before they are shown.
- **Humans remain accountable:** findings can be accepted, edited, or overridden with a written reason; decisions are included in the audit trail.
- **One end-to-end story:** draft → audit → resolve → remediate → review → certificate.

The AI proposes and explains; deterministic code and human review remain in the loop. This is a prototype, not a legal compliance guarantee.

## Run locally

Requirements: [Bun](https://bun.sh/), Python 3, and a Google AI Studio API key.

1. Install dependencies and generate the database client:

   ```sh
   bun install
   bun run db:generate
   bun run db:push
   ```

2. Create `.env.local` in the project root. Keep the existing `DATABASE_URL` configuration available to Prisma, then add your Gemini settings:

   ```env
   DATABASE_URL=file:../db/custom.db
   GEMINI_API_KEY=your-google-ai-studio-key
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_VISION_MODEL=gemini-3.8-flash
   ```

   The key is server-only. Never add it to a `NEXT_PUBLIC_` variable, commit it, or paste it into issue reports. `.env.local` is ignored by Git.

3. Start the app:

   ```sh
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The first dashboard request seeds the demo brand vault and sample drafts.

## Judge-ready path

Start on the dashboard and use the guided demo. Show one intentionally problematic draft, inspect its cited findings and redaction preview, remediate it, then complete the review and open its certificate. The review-role switcher is **simulated for the demo**; there is no sign-in or production authorization.

To validate the API workflow (the audit makes real Gemini calls and may consume API quota), build once and run:

```sh
bun run build
bun run test:e2e
```

The test starts a temporary production server on a free local port, uses a disposable SQLite database, and cleans both up afterwards. It does not modify the seeded demo database.

## Quality checks and production build

```sh
bun run lint
bun run typecheck
bun test
bun run build
bun run start
```

The production build type-checks the app; standalone assets are copied with a Node script so the build works on Windows as well as Unix-like systems.

## Current prototype boundaries

- Role selection demonstrates workflow rules, **not authentication**. Do not deploy this prototype with real users or confidential data without adding identity, server-enforced authorization, rate limiting, and operational safeguards.
- Gemini calls send the redacted text (or the uploaded image for visual analysis) to Google's API. Review your provider's data terms before using real customer content.
- Certificates provide an integrity hash for the recorded demo audit; they are not a legal or regulatory certification.
