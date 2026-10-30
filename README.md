# Salesroom · Sales CRM

Initial implementation of the approved CRM, not a completed MVP. Scope and business rules: [crm-requirements.md](crm-requirements.md). Agent implementation contract: [AGENTS.md](AGENTS.md).

## Implemented

- Next.js App Router/TypeScript with server-rendered private workspace and responsive Tailwind/shadcn-style components.
- Supabase cookie sessions, password login, logout, authenticated profile checks and session refresh proxy. No public signup UI.
- Account-link confirmation, password recovery/update, recipient invitation review/acceptance, and scoped administration UI for property management, memberships, invitation creation/revocation, and sales assignment. Tenant rename/property creation require Tenant Admin. Last active Tenant Admin/property are protected; changes are audited.
- Local Supabase CLI config, captured test email, guarded setup and idempotent fixtures for two tenants/three properties/five accounts. Docker is required and is not installed by helpers. See [local-development.md](docs/local-development.md).
- Multi-tenant/multi-property membership, visible organization/property switcher and server-verified context. Tenant Admin, Property Admin and Sales roles are scoped to memberships, never global profile authority.
- Dashboard calculated from the active property's accessible transactions and tenant-shared client directory; Tenant Admin also has a cross-property portfolio overview. No fabricated production metrics.
- Client search/list/detail and atomic creation of company plus initial PIC. Schema permits multiple PICs; additional PIC editing UI is pending.
- Opportunity creation, Kanban/table, sales/offering/closing-date filters, overdue/aging indicators, drag-and-drop plus keyboard-accessible select controls.
- Stage changes with database row locks, expected-version checks and atomic stage history. Lost requires a reason. Won is blocked until agreement/payment verification exists.
- Follow-up task creation and optimistic completion with failure feedback and version checks.
- Forward SQL migrations with RLS, tenant/property/owner access, composite foreign keys, restricted grants and authorized RPCs. Membership tables have no direct browser write grants; authorized changes use guarded administrative RPCs. Stale forms after a property switch are rejected.
- Explicit, read-only demo. Missing configuration opens setup; failed real queries never fall back to demo.

## Pending MVP work

Live local Supabase/Auth/SMTP end-to-end verification (Docker missing); client editing, extra PIC management and validated import/deduplication; lead qualification; server pagination; activity logging, selfie/GPS; LOO/LOA generation/versioning/PDF/approval; private file storage; per-property pricing/document/mailbox configuration, CRM outbound mailbox, durable outbox and Trigger.dev; production monitoring and backup/restore procedures. Activities and Documents explicitly show unavailable status. Invitation email is implemented through configured SMTP but has not been sent/tested against a running local stack. CRM greeting/document emailing remains unavailable.

Inbound email inbox, live-chat widget, WhatsApp synchronization, integrated e-signatures, campaigns and full offline are later releases.

## Local development

Current priority is local development; cloud staging/deployment is deferred. Requires Node.js 24 LTS, npm and Docker Desktop for the full local Supabase stack. Use the committed lockfile and [local setup guide](docs/local-development.md).

```powershell
npm ci
npm run local:setup
npm run local:seed
npm run dev
```

The setup helper writes ignored `.env.local` only if it does not exist, using local CLI status. Core CRM uses the user's JWT. Invitation delivery additionally requires a server-only Supabase service-role/secret key and SMTP; it never exposes that key to the browser. Never commit secrets. Without Docker, preview the read-only UI by setting `CRM_DEMO_MODE=true` in a temporary shell/environment and running `npm run dev`; this does not enable business writes.

For a standalone UI preview, set `CRM_DEMO_MODE=true` in `.env.local` and restart. All records are synthetic and business writes are blocked in UI and actions. The property switcher changes a UI preference only; Jakarta and Bali have distinct opportunities/tasks and shared demo clients. Set the flag back to `false` for real authentication/data. Vercel production rejects demo mode; on other hosting the operator must keep it disabled. Do not use production data for preview.

## Supabase setup

1. Use separate projects for development, staging and production. Singapore is the proposed primary region, subject to the organization's data requirements.
2. Apply all numbered `.sql` migrations in order; existing installations apply only pending migrations. Migration 003 adds scoped administration/invitations/audit, not cloud resources. Do not edit/reapply migration 001 or run against an unrelated schema. Migration 002 preserves legacy single-organization data as described in the scope document. Fresh databases get no default tenant; use the local seed or trusted bootstrap below.
3. Disable public signups in Auth settings. The checked-in local config does so and configures captured SMTP plus the recovery email template. New account links are issued only after an authorized invitation request. Auth user creation and tenant membership are separate: verified recipient acceptance grants membership.
4. Provision the profile, tenant, property and memberships with trusted admin tooling. For a fresh development database, replace the Auth UUID and names in this SQL Editor example (each execution creates a new tenant/property):

```sql
begin;
insert into public.profiles (id, full_name)
values ('REPLACE_WITH_AUTH_USER_UUID', 'Admin Name');
do $$
declare organization uuid; hotel uuid;
begin
  insert into public.tenants(name) values ('Your Hotel Group') returning id into organization;
  insert into public.properties(tenant_id, name, code, timezone)
  values (organization, 'Your Jakarta Hotel', 'JKT', 'Asia/Jakarta') returning id into hotel;
  insert into public.tenant_memberships(tenant_id,user_id,role)
  values (organization,'REPLACE_WITH_AUTH_USER_UUID','tenant-admin');
end;
$$;
commit;
```

Tenant Admin needs no per-property membership within its own tenant. After trusted bootstrap, use Administration to invite users, manage membership or property status, and assign transactions. Property Admin can manage Sales in its assigned property, without granting/restoring privileged roles. Tenant Admin can restore tenant memberships and assign property admins; the last active Tenant Admin cannot be removed. No direct browser writes to membership/provisioning tables are granted. Never expose a service key in a client component.

5. Set application env vars, restart, then log in. Users without an accessible property get the access/setup screen. Verify tenant, property and owner isolation with multiple real users before operational use.

## Access and scope

- One deployment supports multiple isolated tenants. Companies and contacts are intentionally readable by every active member of their tenant, regardless of property/creator. Transactions are not shared by that rule.
- Tenant Admin sees all active properties/transactions within that tenant, including the portfolio overview. Property Admin sees all owners' transactions only in the property where it has that role. Sales sees its own transactions only within assigned properties. A role in one tenant/property never grants that role in another.
- Profiles are global identity, with no role column. Directory queries scope to the active tenant. Tenant Admin can also read inactive tenant members' names to restore their access; ordinary members only see identities sharing an active tenant. Initial organization bootstrap remains trusted tooling; subsequent scoped administration has a UI.
- The property cookie is an untrusted selector, not authorization. Every request resolves active DB membership; RLS remains effective for direct API/RPC calls. Missing/revoked selection leads to the access screen instead of silently switching organizations. Every form/action includes its original property and server actions reject stale context after another tab switches property. RPCs also require the record's actual property. Switching returns to Overview and discards unsubmitted local form state.
- Opportunity/task/client queries explicitly scope to the selected tenant/property in addition to RLS. Tenant Admin's portfolio explicitly scopes to the selected tenant. No data is cached across users/tenants. Responses exceeding provider row limits fail explicitly rather than displaying incomplete totals; server pagination is still pending.
- Future activity, files, LOO/LOA, mailboxes and jobs must carry the validated tenant/property. These modules are not yet enabled; no storage/job integration is claimed as tenant-ready. File policies and job reauthorization must ship with them.
- Billing subscriptions, tenant-specific domains and custom branding UI are later scope.

All values are IDR; opportunity amounts are PostgreSQL `numeric(14,2)`. Display summaries use Number for non-accounting estimates; document pricing must implement exact decimal/minor-unit arithmetic before shipping. Follow-up/closing values remain dates; property timezone supports Asia/Jakarta, Asia/Makassar and Asia/Jayapura. Configurable aging threshold is pending.

## Verification

```powershell
npm test
npx next typegen
npm run typecheck
npm run lint
npm run build
```

Tests live beside their logic/migration. PGlite runs PostgreSQL migrations/RLS with a minimal mock Auth schema: tenant/property/owner isolation, scoped roles/revocation, composite foreign keys, admin-last/property-last guards, version conflicts, assignment, verified recipient-only invitation acceptance, single use, expired/revoked/unauthorized invitations, and delivery claim identity/cooldown. Pure tests cover local-only setup guards, credential newline injection, fixed auth origins/types, password confirmation and stale property context. Full Supabase/Auth/SMTP integration is unverified until Docker is installed and local UAT is run; cloud services/storage/Trigger.dev are not configured.

## Hosting plan

- Vercel hosts Next.js; place server compute close to the selected Supabase region where supported by the plan.
- Supabase provides PostgreSQL/Auth and, in a later slice, private Storage.
- Trigger.dev will run persistent background work, driven by a transactional outbox. It is planned, not integrated in this revision.
- Connect this GitHub repository to the intended Vercel project; configure development/preview/production env values separately. Run migration against staging first and perform real-user UAT before production.
- No hosted deployment, Supabase project, paid subscription or external mailbox has been provisioned by this commit. Plan limits, data retention, backup/restore, mailbox provider and commercial Won policy must be configured before operational rollout.

The checked-in SQL has no production demo seed. Never enable emailing, payment confirmation or booking confirmation using simulated responses.
