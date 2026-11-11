# VeriLoom AI

**Catch brand, claims, and accessibility problems before a campaign goes live.**

VeriLoom is a hackathon prototype for pre-publication brand governance. It gives a marketing team one auditable workflow: check a draft against a living brand vault, review grounded findings, make human decisions, and issue a tamper-evident approval certificate.

## Architecture

- **UI:** Next.js App Router, React, TypeScript, Tailwind CSS, and Zustand for transient workspace navigation state.
- **API:** Next.js route handlers for authentication, accounts, drafts, audits, finding decisions, Vault rules, review, analytics, and certificates.
- **Persistence:** Prisma with PostgreSQL (Neon is supported). Draft versions, audit runs, citations, decisions, events, and Vault-rule versions are persisted.
- **Authentication:** NextAuth credentials sessions. Passwords are stored as salted scrypt hashes; signed-in roles are checked server-side. The first account is an administrator; administrators provision author, reviewer, and approver accounts.
- **Audit:** Deterministic terminology, claims, palette, accessibility, and confidentiality checks run alongside Gemini-powered, Vault-cited analysis. Each audit records the active Vault rule versions it used. Failed checks are marked incomplete and block remediation and approval.

Audit history is read-only and can be rerun against saved draft versions and the current Vault. Vault edits and archival create immutable rule-version snapshots; older audits keep their original lineage.

## What makes the demo different

- **Deterministic checks where exactness matters:** terminology, numeric claims, color distance (ΔE2000), contrast ratios (WCAG), and local confidentiality scrubbing.
- **Cross-channel claim drift:** compare approved source copy with an email, ad, or social adaptation; numeric changes and omissions are surfaced locally before a full audit.
- **AI where language understanding helps:** Gemini reviews tone and claims against the brand vault, and samples text regions in images. AI findings are citation-checked before they are shown.
- **Humans remain accountable:** findings can be accepted, edited, or overridden with a written reason; decisions are included in the audit trail.
- **One end-to-end story:** draft → audit → resolve → remediate → review → certificate.

The AI proposes and explains; deterministic code and human review remain in the loop. This is a prototype, not a legal compliance guarantee.

## Run locally

Requirements: [Git](https://git-scm.com/), [Bun](https://bun.sh/), Python 3, PostgreSQL, a Google AI Studio API key, and a `NEXTAUTH_SECRET`. You can use local PostgreSQL or a hosted provider such as [Neon](https://neon.tech/); pgAdmin is a database client, not a database server.

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/Aaryandaksh007/Veriloomx.git
   cd Veriloomx
   bun install
   ```

2. Copy `.env.example` to `.env` in the project root (PowerShell users can run `Copy-Item .env.example .env`) and replace its placeholder values:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require
   DIRECT_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DATABASE?sslmode=require
   NEXTAUTH_SECRET=<unique-random-secret>
   INITIAL_ADMIN_SETUP_KEY=<different-random-secret>
   GEMINI_API_KEY=your-google-ai-studio-key
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_VISION_MODEL=gemini-3.8-flash
   DEMO_LOGIN_ENABLED=false
   DEMO_LOGIN_EMAIL=
   DEMO_LOGIN_PASSWORD=
   ```

   The example URLs are templates: replace them with your provider's pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) PostgreSQL URLs; for local PostgreSQL, both can use the same URL. Generate two different random values for `NEXTAUTH_SECRET` and `INITIAL_ADMIN_SETUP_KEY` (for example, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` twice). URL-encode special characters in database credentials. `.env` is ignored by Git; never commit secrets.

3. Apply the migrations and start the app:

   ```sh
   bun run db:deploy
   bun run dev
   ```

   Open `http://localhost:3000/setup` to create the first administrator account. Once it exists, the setup endpoint refuses further registration. Sign in, then create individual accounts from **Manage accounts**. The first authenticated dashboard request seeds the demo brand Vault and sample drafts.

## Deploy to Vercel

Import the GitHub repository into Vercel and add these environment variables for the environments you intend to deploy:

- `DATABASE_URL`: the hosted PostgreSQL pooled connection string.
- `DIRECT_URL`: the hosted PostgreSQL direct connection string, used to apply migrations.
- `NEXTAUTH_SECRET`: a unique cryptographically random session secret.
- `INITIAL_ADMIN_SETUP_KEY`: a one-time bootstrap secret; remove after the first administrator has been created.
- `GEMINI_API_KEY`: your server-side Google AI Studio key.
- `GEMINI_MODEL` and `GEMINI_VISION_MODEL`: optional; default to `gemini-3.8-flash`.
- `DEMO_LOGIN_ENABLED`, `DEMO_LOGIN_EMAIL`, and `DEMO_LOGIN_PASSWORD`: optional; enable the shared judge login only after creating a dedicated Author account.

Vercel runs the checked-in Prisma migrations during each build. Do not use a local-only PostgreSQL instance or expose its port to the internet for deployment. pgAdmin can connect to Neon for administration, but it does not host the database. Keep database and Gemini secrets in Vercel's project environment settings, not in source files.

### Optional judge demo login

The sign-in page can fill a shared demo Author account for judges. First create a dedicated **Author** account from **Manage accounts**, then configure these server-side environment variables and redeploy:

```env
DEMO_LOGIN_ENABLED=true
DEMO_LOGIN_EMAIL=demo-author@example.com
DEMO_LOGIN_PASSWORD=<that-account's-password>
```

The app only offers the button when the configured password matches an active Author account. These credentials are intentionally disclosed to every visitor when this feature is enabled. Use a disposable demo deployment and data, never an administrator or real employee account, and disable the feature after judging. Anyone using the shared account can see or change its drafts, and audit actions may consume your Gemini quota.

## Golden walkthrough

Create accounts for each workflow role, then sign in separately to demonstrate the full journey: author drafts and audits content, reviewer requests changes or sends it forward, and approver signs off. Inspect an incomplete audit's retry state, compare Vault rule versions, remediate a complete audit, and open the certificate.

To validate the API workflow (the audit makes real Gemini calls and may consume API quota), build once and run:

```sh
bun run build
E2E_DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require bun run test:e2e
```

On PowerShell, set `E2E_DATABASE_URL` to a **disposable PostgreSQL database** and run:

```powershell
$env:E2E_DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
bun run test:e2e
Remove-Item Env:E2E_DATABASE_URL
```

The runner creates a uniquely named temporary schema, starts a production server, and removes that schema afterward. Never point it at production data; the test also calls Gemini and can consume API quota.

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

- Credentials and server-enforced role checks are implemented, but there is no password-reset, MFA, invite flow, or rate limiting. Use unique strong passwords and an administrator-controlled deployment; do not treat this hackathon prototype as a hardened identity service.
- Gemini calls send the redacted text (or the uploaded image for visual analysis) to Google's API. Review your provider's data terms before using real customer content.
- Certificates provide an integrity hash for the recorded demo audit; they are not a legal or regulatory certification.

## Roadmap

1. **Production identity controls:** add account recovery, MFA, invitations, and server-side rate limits before onboarding an external team.
2. **Operational review workflow:** add configurable reviewer assignment and notifications so teams can manage approvals without polling the dashboard.
3. **Governance operations:** add exportable audit evidence and configurable retention so administrators can archive decisions and certificates.

These are planned follow-ups, not capabilities currently included in the prototype.

## API overview

All API routes require a signed-in session except NextAuth endpoints and the one-time `/api/setup` endpoint.

| Route | Purpose | Access |
|---|---|---|
| `/api/auth/[...nextauth]` | Credentials sign-in/out | Public |
| `/api/setup` | Create the first administrator only | Public until initialized |
| `/api/users` and `/api/users/:id` | List, provision, update roles, and deactivate accounts | Administrator |
| `/api/drafts` and `/api/drafts/:id` | Create and manage draft versions | Author |
| `/api/audit` | Run audits, retry failed checks (`retryAuditId`), or review version history | Author to run; any signed-in role to view |
| `/api/findings/action`, `/api/remediate` | Resolve findings and create a remediated version | Author |
| `/api/vault` and `/api/vault/:id` | Read rules, edit or restore rule versions, and inspect rule history | Read: signed-in; write: administrator |
| `/api/review` | Submit, request changes, and approve | Role-specific |
| `/api/certificate/:draftId` | Retrieve the approval certificate | Signed-in |
