# Implementation contract

Read crm-requirements.md before changes. This file defines implementation guardrails, not a claim that every requirement has shipped.

- MVP: multi-tenant/multi-property foundation; invitation login; scoped Tenant Admin/Property Admin/Sales authorization; companies and multiple PICs; validated import; opportunities with Kanban/table; activities/selfie/GPS; follow-up tasks; versioned LOO→LOA PDFs; one email provider with property-specific mailboxes; basic dashboard; Maps/WhatsApp links.
- Tenancy: profiles are global identity only, never global admin authority. Tenant memberships grant tenant-admin/member; property memberships grant property-admin/sales. Tenant Admin governs only its tenant, Property Admin only assigned properties, Sales only owned transactions in assigned properties. All tenant members intentionally share company/PIC records; never share across tenants.
- Every property-owned record, file, document, mailbox and background job must carry tenant_id/property_id, validated against composite foreign keys and RLS/server authorization. Existing company/PIC records carry tenant_id only. New modules must establish these checks before writes are enabled.
- Property cookie is an untrusted UI selector, not permission. Resolve current active membership from database on each request; filter queries by verified tenant/property. Bind mutations to the form's original property and reject stale context after switching. Never derive authorization from user-editable JWT metadata, localStorage, or a hidden field alone.
- Keep roles out of profiles. Test tenant crossing, property crossing, multi-membership role differences, revoked membership, direct API/RPC access and privileged roles. Migration history is immutable; add forward migrations and test legacy backfill. Cross-property dashboards are Tenant Admin only.
- Later: inbound email inbox, live-chat widget, WhatsApp synchronization, e-signatures, campaigns, advanced reporting, full offline support. Preserve these in the product backlog.
- Stack: Next.js App Router, TypeScript, Node.js, Tailwind, shadcn/ui; Supabase Postgres/Auth/private Storage; Trigger.dev persistent jobs. Vercel hosting; proposed primary data/application region Singapore. Never provision paid resources without a concrete need and existing authorization.
- Use Server Components and server-side authorization first. Database is the only business source of truth. SWR/React Query only for necessary client fetching. Local useState/useReducer; Zustand only with justification; no Redux.
- Separate development, staging and production data/secrets. Never commit secrets, expose service-role keys, seed production with demo records, or silently fall back to demo when production queries fail.
- Ship working vertical slices. README must distinguish implemented, unverified, and pending. No fake success, decorative buttons, invented metrics or simulated delivery acknowledgments.
- Missing integrations show explicit setup/pending states. Demo must be clearly labeled and isolated from writes.
- Business UI: neutral background, restrained brand accent, readable dense tables, visible focus, semantic controls, skeleton loading, responsive layouts. Every mutation has success/error feedback. Keyboard alternative required for drag-and-drop. Never rely on color alone.
- Client detail groups overview/PICs, timeline, opportunities, documents. Sales mobile flows minimize typing. Document flow: details→preview→review→send.
- Keep lead, opportunity, document, delivery, payment and booking states separate. Won requires verified agreement and deposit/approved credit under configured policy; never fabricate commercial defaults.
- Sent document snapshots are immutable. Revisions invalidate review. Authorization, pricing and transitions are validated server-side. Durable outbox and deduplication required before enabling sending.
- Files/folders kebab-case, components/types PascalCase, functions/variables camelCase, constants UPPER_SNAKE_CASE. Unit tests live beside logic. No global tests directory.
- Verify types/build and meaningful changed business rules. Record limits honestly. Do not introduce Redux, microservices, offline sync or speculative abstractions.
- Maintain .ai_context.md with terse facts, shipped scope, blockers and next actions.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
