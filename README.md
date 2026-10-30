# Salesroom · Sales CRM

Initial implementation of the approved CRM, not a completed MVP. Scope and business rules: [crm-requirements.md](crm-requirements.md). Agent implementation contract: [AGENTS.md](AGENTS.md).

## Implemented

- Next.js App Router/TypeScript with server-rendered private workspace and responsive Tailwind/shadcn-style components.
- Supabase cookie sessions, password login, logout, authenticated profile checks and session refresh proxy. No public signup UI.
- Multi-tenant/multi-property membership, visible organization/property switcher and server-verified context. Tenant Admin, Property Admin and Sales roles are scoped to memberships, never global profile authority.
- Dashboard calculated from the active property's accessible transactions and tenant-shared client directory; Tenant Admin also has a cross-property portfolio overview. No fabricated production metrics.
- Client search/list/detail and atomic creation of company plus initial PIC. Schema permits multiple PICs; additional PIC editing UI is pending.
- Opportunity creation, Kanban/table, sales/offering/closing-date filters, overdue/aging indicators, drag-and-drop plus keyboard-accessible select controls.
- Stage changes with database row locks, expected-version checks and atomic stage history. Lost requires a reason. Won is blocked until agreement/payment verification exists.
- Follow-up task creation and optimistic completion with failure feedback and version checks.
- Forward SQL migrations with RLS, tenant/property/owner access, composite foreign keys, restricted grants and authorized RPCs. Users cannot update memberships or their own role. Stale forms after a property switch are rejected.
- Explicit, read-only demo. Missing configuration opens setup; failed real queries never fall back to demo.

## Pending MVP work

Invitation acceptance/password recovery UI; tenant/property/membership provisioning UI, user management and assignment; client editing, extra PIC management and validated import/deduplication; lead qualification; server pagination; activity logging, selfie/GPS; LOO/LOA generation/versioning/PDF/approval; private file storage; per-property pricing/document/mailbox configuration, outbound mailbox, durable outbox and Trigger.dev; production monitoring and backup/restore procedures. Activities and Documents pages explicitly show unavailable status. No email is sent by this revision.

Inbound email inbox, live-chat widget, WhatsApp synchronization, integrated e-signatures, campaigns and full offline are later releases.

## Local development

Requires Node.js 24 LTS and npm. Use the committed lockfile.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to your development project's values. No service-role key is needed or used by the app. Never expose or commit service-role keys.

For a standalone UI preview, set `CRM_DEMO_MODE=true` in `.env.local` and restart. All records are synthetic and business writes are blocked in UI and actions. The property switcher changes a UI preference only; Jakarta and Bali have distinct opportunities/tasks and shared demo clients. Set the flag back to `false` for real authentication/data. Vercel production rejects demo mode; on other hosting the operator must keep it disabled. Do not use production data for preview.

## Supabase setup

1. Use separate projects for development, staging and production. Singapore is the proposed primary region, subject to the organization's data requirements.
2. Apply both numbered `.sql` files in `supabase/migrations` in order using Supabase SQL Editor or migration tooling. On an existing foundation deployment, apply only `202610300002-tenancy.sql`. Do not edit/reapply migration 001 or run against an unrelated schema. Migration 002 is transactional, preserves legacy business data in one `Migrated organization` / `Main property`, and converts old admins to Tenant Admin in that organization only. Fresh databases get no default tenant. Review and rename the legacy organization/property before operational use; unrelated legacy customers must be explicitly mapped rather than guessed into tenants.
3. Disable public signups in Auth settings. Account invitation and activation must be controlled by the admin; invitation acceptance screens are not implemented yet. For development, provision a test Auth user with a password through trusted Supabase admin tooling.
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

Tenant Admin needs no per-property membership within its own tenant. For a sales user, create its identity profile, then a `tenant_memberships` row with `role='member'` and a `property_memberships` row using the matching tenant/property and `role='sales'`. Use `property-admin` on the property membership for local administrators. The same user may have different roles in different tenants/properties. Deactivate the appropriate membership using `active=false` to revoke access while retaining historical foreign-key references. Browser roles have no membership/provisioning write grants. Never expose a service key in a client component.

5. Set application env vars, restart, then log in. Users without an accessible property get the access/setup screen. Verify tenant, property and owner isolation with multiple real users before operational use.

## Access and scope

- One deployment supports multiple isolated tenants. Companies and contacts are intentionally readable by every active member of their tenant, regardless of property/creator. Transactions are not shared by that rule.
- Tenant Admin sees all active properties/transactions within that tenant, including the portfolio overview. Property Admin sees all owners' transactions only in the property where it has that role. Sales sees its own transactions only within assigned properties. A role in one tenant/property never grants that role in another.
- Profiles are global identity, with no role column. Other users' names are visible only when sharing an active tenant; workspace directory queries explicitly scope to the active tenant. Membership management remains trusted admin tooling until its UI ships.
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

Tests live beside their logic/migration. PGlite runs actual PostgreSQL migrations/RLS with a minimal mock Auth schema: legacy backfill, shared clients within tenant, tenant/property/owner isolation, roles differing across memberships, forbidden membership escalation, cross-tenant foreign keys, membership revocation, stale record property RPC arguments, atomic company/PIC creation, version conflicts, stage history, Lost validation and Won blocking. Pure tests cover invalid/revoked property selectors and stale form context. This does not replace live Supabase/Auth integration testing. Real provider/email/storage/Trigger.dev behavior has not been tested because these services are not configured.

## Hosting plan

- Vercel hosts Next.js; place server compute close to the selected Supabase region where supported by the plan.
- Supabase provides PostgreSQL/Auth and, in a later slice, private Storage.
- Trigger.dev will run persistent background work, driven by a transactional outbox. It is planned, not integrated in this revision.
- Connect this GitHub repository to the intended Vercel project; configure development/preview/production env values separately. Run migration against staging first and perform real-user UAT before production.
- No hosted deployment, Supabase project, paid subscription or external mailbox has been provisioned by this commit. Plan limits, data retention, backup/restore, mailbox provider and commercial Won policy must be configured before operational rollout.

The checked-in SQL has no production demo seed. Never enable emailing, payment confirmation or booking confirmation using simulated responses.
