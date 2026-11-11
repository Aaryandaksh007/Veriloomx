# VeriLoom AI

**Catch brand, claims, and accessibility problems before a campaign goes live.**

VeriLoom is a hackathon prototype for pre-publication brand governance. It gives a marketing team one auditable workflow: check a draft against a living brand vault, review grounded findings, make human decisions, and issue a tamper-evident approval certificate.

You can run your own instance, adapt it to your organization, or contribute improvements. The source code is licensed under the [MIT License](./LICENSE); see [License and third-party services](#license-and-third-party-services) for important limits.

## What you can do

- **Authors** create marketing drafts, run six-pillar checks, and resolve or explain findings.
- **Reviewers** inspect versions and request changes before release.
- **Approvers** provide final sign-off and issue an integrity-hash certificate.
- **Administrators** manage accounts and versioned brand rules in the Brand Vault.
- **Evaluators** can try the browser-based instant scan and compare numeric claims between approved source copy and a channel adaptation.

Each role is a separate account. An administrator provisions the team, and the server enforces role permissions.

### Try the hosted demo

Visit [veriloomx.vercel.app](https://veriloomx.vercel.app/) and choose **Fill demo credentials** on the sign-in page. The demo uses a shared public Author account; its drafts and actions are visible to other visitors. Do not enter real, confidential, or customer data.

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

## Run your own instance

### Requirements

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) (package manager and test runner)
- [Python 3](https://www.python.org/) (used by image-processing/runtime checks)
- PostgreSQL 15 or later, installed locally or provided by a host such as [Neon](https://neon.tech/)
- A [Google AI Studio API key](https://aistudio.google.com/app/apikey) for Gemini-powered audit checks

pgAdmin is a database client, not a database server. You may use another PostgreSQL host, but the database must be reachable from the application and support Prisma migrations.

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/Aaryandaksh007/Veriloomx.git
   cd Veriloomx
   bun install
   ```

2. Create a PostgreSQL database for this app. For local PostgreSQL, create a database named `veriloom`; for a hosted database, create a project/database with your provider.

3. Copy `.env.example` to `.env` in the repository root (PowerShell users can run `Copy-Item .env.example .env`) and replace its placeholder values:

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

   The example URLs are templates: replace them with your provider's pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) PostgreSQL URLs. For a local PostgreSQL database named `veriloom`, both values can instead use:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/veriloom?schema=public
   DIRECT_URL=postgresql://USER:PASSWORD@localhost:5432/veriloom?schema=public
   ```

   Generate separate random values for `NEXTAUTH_SECRET` and `INITIAL_ADMIN_SETUP_KEY`, for example by running `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` twice. URL-encode reserved characters in database credentials. `.env` is ignored by Git; never commit secrets or place private keys in `NEXT_PUBLIC_*` variables.

4. Apply the migrations and start the development server:

   ```sh
   bun run db:deploy
   bun run dev
   ```

   Open `http://localhost:3000/setup`. Use the one-time setup key from `.env` to create your first Administrator. This first-run endpoint stops creating accounts once the first account exists. Sign in and create separate Author, Reviewer, and Approver accounts under **Manage accounts**. The first authenticated dashboard request seeds a sample brand Vault and drafts.

5. Keep a valid `GEMINI_API_KEY` configured on the server to use the full AI-powered audit. Without it, Gemini-dependent checks cannot run; do not treat an incomplete audit as passing.

### Common commands

```sh
bun run dev          # Start the development server
bun run lint         # Run ESLint
bun run typecheck    # Run TypeScript checks
bun test             # Run unit tests
bun run build        # Create a production build
```

In development, open `http://localhost:3000`. To run the production build locally, configure the required environment variables, then run `bun run build` followed by `bun run start`.

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

## Current prototype boundaries

- Credentials and server-enforced role checks are implemented, but there is no password-reset, MFA, invite flow, or rate limiting. Use unique strong passwords and an administrator-controlled deployment; do not treat this hackathon prototype as a hardened identity service.
- Gemini calls send the redacted text (or the uploaded image for visual analysis) to Google's API. Review your provider's data terms before using real customer content.
- Certificates provide an integrity hash for the recorded demo audit; they are not a legal or regulatory certification.

## Roadmap

1. **Production identity controls:** add account recovery, MFA, invitations, and server-side rate limits before onboarding an external team.
2. **Operational review workflow:** add configurable reviewer assignment and notifications so teams can manage approvals without polling the dashboard.
3. **Governance operations:** add exportable audit evidence and configurable retention so administrators can archive decisions and certificates.

These are planned follow-ups, not capabilities currently included in the prototype.

## Contributing

Contributions and forks are welcome. A practical contribution workflow is:

1. Fork the repository and create a branch for your change.
2. Install dependencies and configure a non-production PostgreSQL database.
3. Make a focused change and add or update tests for behavior that changed.
4. Run `bun run lint`, `bun run typecheck`, and `bun test`.
5. Open a pull request describing the user problem, behavior change, and validation performed.

Never include `.env` files, API keys, passwords, production data, or user content in a commit, issue, or pull request. Keep generated files and local database files out of pull requests unless the change specifically requires them.

## License and third-party services

This repository's original code and documentation are available under the [MIT License](./LICENSE). The license does not grant rights to third-party names, trademarks, logos, sample content, or other assets that may appear in the project. Dependencies retain their own licenses; review their notices before redistributing a bundled product.

Running your own instance may require separate accounts, credentials, or payment with PostgreSQL and Google AI Studio (Gemini). Those services have their own terms, privacy policies, quotas, and costs. Do not send sensitive or customer data to an AI provider unless you have approval and have reviewed the provider's data terms. VeriLoom is a prototype and does not provide legal, regulatory, or security certification.

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
