# Salesroom · Sales CRM

Initial implementation of the approved CRM, not a completed MVP. Scope and business rules: [crm-requirements.md](crm-requirements.md). Agent implementation contract: [AGENTS.md](AGENTS.md).

## Implemented

- Next.js App Router/TypeScript with server-rendered private workspace and responsive Tailwind/shadcn-style components.
- Supabase cookie sessions, password login, logout, authenticated profile checks and session refresh proxy. No public signup UI.
- Dashboard calculated from accessible records; no fabricated production metrics.
- Client search/list/detail and atomic creation of company plus initial PIC. Schema permits multiple PICs; additional PIC editing UI is pending.
- Opportunity creation, Kanban/table, sales/offering/closing-date filters, overdue/aging indicators, drag-and-drop plus keyboard-accessible select controls.
- Stage changes with database row locks, expected-version checks and atomic stage history. Lost requires a reason. Won is blocked until agreement/payment verification exists.
- Follow-up task creation and optimistic completion with failure feedback and version checks.
- SQL migration with RLS, owner/admin access, restricted grants and authorized RPCs. Users cannot update their own role.
- Explicit, read-only demo. Missing configuration opens setup; failed real queries never fall back to demo.

## Pending MVP work

Invitation acceptance/password recovery UI; user management and assignment; client editing, extra PIC management and validated import/deduplication; lead qualification; server pagination; activity logging, selfie/GPS; LOO/LOA generation/versioning/PDF/approval; private file storage; outbound mailbox, durable outbox and Trigger.dev; production monitoring and backup/restore procedures. Activities and Documents pages explicitly show unavailable status. No email is sent by this revision.

Inbound email inbox, live-chat widget, WhatsApp synchronization, integrated e-signatures, campaigns and full offline are later releases.

## Local development

Requires Node.js 24 LTS and npm. Use the committed lockfile.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to your development project's values. No service-role key is needed or used by the app. Never expose or commit service-role keys.

For a standalone UI preview, set `CRM_DEMO_MODE=true` in `.env.local` and restart. All records are synthetic and writes are blocked in UI and actions. Set it back to `false` for real authentication/data. Vercel production rejects demo mode; on other hosting the operator must keep it disabled. Do not use production data for preview.

## Supabase setup

1. Use separate projects for development, staging and production. Singapore is the proposed primary region, subject to the organization's data requirements.
2. Apply `supabase/migrations/202610300001-foundation.sql` to the intended empty project using Supabase SQL Editor or your migration tooling. This migration creates app tables and grants; do not run it against an unrelated existing schema.
3. Disable public signups in Auth settings. Account invitation and activation must be controlled by the admin; invitation acceptance screens are not implemented yet. For development, provision a test Auth user with a password through trusted Supabase admin tooling.
4. Create its profile using SQL Editor with the real Auth UUID:

```sql
insert into public.profiles (id, full_name, role)
values ('REPLACE_WITH_AUTH_USER_UUID', 'Admin Name', 'admin');
```

Use `sales` for sales users. Profile writes are deliberately unavailable to browser roles; use trusted admin tooling. Never put an admin endpoint backed by a service key in a public client component.

5. Set application env vars, restart, then log in. Verify owner isolation with two different sales users before using real data.

The app currently supports one organization per deployment. Multi-organization SaaS is out of scope. All values are IDR; opportunity amounts are PostgreSQL `numeric(14,2)`. Display summaries use Number for non-accounting estimates; document pricing must implement exact decimal/minor-unit arithmetic before shipping. Date-only follow-up/closing values remain dates; current UI day uses Asia/Jakarta. Configurable timezones and aging threshold are pending.

## Verification

```powershell
npm test
npx next typegen
npm run typecheck
npm run lint
npm run build
```

Tests live beside their logic/migration. PGlite runs actual PostgreSQL migration/RLS checks with a minimal mock Auth schema: owner isolation, forbidden role changes/direct stage updates, atomic company/PIC creation, version conflicts, stage history, Lost validation and Won blocking. This does not replace live Supabase/Auth integration testing. Real provider/email/storage/Trigger.dev behavior has not been tested because these services are not configured.

## Hosting plan

- Vercel hosts Next.js; place server compute close to the selected Supabase region where supported by the plan.
- Supabase provides PostgreSQL/Auth and, in a later slice, private Storage.
- Trigger.dev will run persistent background work, driven by a transactional outbox. It is planned, not integrated in this revision.
- Connect this GitHub repository to the intended Vercel project; configure development/preview/production env values separately. Run migration against staging first and perform real-user UAT before production.
- No hosted deployment, Supabase project, paid subscription or external mailbox has been provisioned by this commit. Plan limits, data retention, backup/restore, mailbox provider and commercial Won policy must be configured before operational rollout.

The checked-in SQL has no production demo seed. Never enable emailing, payment confirmation or booking confirmation using simulated responses.
