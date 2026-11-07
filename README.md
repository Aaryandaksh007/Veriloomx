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

Requirements: [Bun](https://bun.sh/), Python 3, a PostgreSQL database, and a Google AI Studio API key. [Neon](https://neon.tech/) is a hosted PostgreSQL option for Vercel. pgAdmin is a database client, not a hosted database.

1. Install dependencies and apply the database migration:

   ```sh
   bun install
   bun run db:deploy
   ```

2. Create `.env.local` in the project root:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require
   DIRECT_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DATABASE?sslmode=require
   GEMINI_API_KEY=your-google-ai-studio-key
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_VISION_MODEL=gemini-3.8-flash
   ```

   Use the provider's pooled connection string for `DATABASE_URL` and its direct connection string for `DIRECT_URL`. Keep both URLs and the Gemini key out of Git. `.env.local` is ignored by Git.

3. Start the app:

   ```sh
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The first dashboard request seeds the demo brand vault and sample drafts.

## Deploy to Vercel

Import the GitHub repository into Vercel and add these environment variables for the environments you intend to deploy:

- `DATABASE_URL`: the hosted PostgreSQL pooled connection string.
- `DIRECT_URL`: the hosted PostgreSQL direct connection string, used to apply migrations.
- `GEMINI_API_KEY`: your server-side Google AI Studio key.
- `GEMINI_MODEL` and `GEMINI_VISION_MODEL`: optional; default to `gemini-3.8-flash`.

Vercel runs the checked-in Prisma migrations during each build. Do not use a local-only PostgreSQL instance or expose its port to the internet for deployment. pgAdmin can connect to Neon for administration, but it does not host the database. Keep database and Gemini secrets in Vercel's project environment settings, not in source files.

## path

Start on the dashboard and use the guided demo. Show one intentionally problematic draft, inspect its cited findings and redaction preview, remediate it, then complete the review and open its certificate. The review-role switcher is **simulated for the demo**; there is no sign-in or production authorization.

To validate the API workflow (the audit makes real Gemini calls and may consume API quota), build once and run:

```sh
bun run build
E2E_DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require bun run test:e2e
```

On PowerShell, set `$env:E2E_DATABASE_URL` before running the test. The runner creates a uniquely named temporary PostgreSQL schema, starts a production server, and removes that schema afterward. Never point it at production data.

## Quality checks and production build

```sh
bun run lint
bun run typecheck
bun test
bun run build
bun run start
```

The production build type-checks the app. Vercel serves the app through its native Next.js integration.

## Current prototype boundaries

- Role selection demonstrates workflow rules, **not authentication**. Do not deploy this prototype with real users or confidential data without adding identity, server-enforced authorization, rate limiting, and operational safeguards.
- Gemini calls send the redacted text (or the uploaded image for visual analysis) to Google's API. Review your provider's data terms before using real customer content.
- Certificates provide an integrity hash for the recorded demo audit; they are not a legal or regulatory certification.
