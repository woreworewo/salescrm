import "server-only";
import { notFound } from "next/navigation";
import { getWorkspace } from "./workspace";
import { getPropertyContext } from "./access";
import type { AccessRole, Property, Profile } from "./models";

export type ManagedProperty = Property & { active: boolean; version: number };
export type TenantMember = {
  user_id: string;
  role: "tenant-admin" | "member";
  active: boolean;
  version: number;
};
export type PropertyMember = {
  user_id: string;
  role: "property-admin" | "sales";
  active: boolean;
  version: number;
};
export type Invitation = {
  id: string;
  email: string;
  full_name: string;
  requested_role: AccessRole;
  delivery_status: string;
  expires_at: string;
  revoked_at: string | null;
  accepted_at: string | null;
};
export type AdministrationEvent = {
  id: string;
  subject_id: string;
  details: Record<string, unknown>;
  actor_id: string;
  action: string;
  created_at: string;
};

export async function getAdministration() {
  const snapshotTime = Date.now();
  const workspace = await getWorkspace();
  if (workspace.accessRole === "sales") notFound();
  if (workspace.demo)
    return {
      snapshotTime,
      workspace,
      tenantVersion: 1,
      properties: workspace.propertyOptions
        .filter((p) => p.tenant_id === workspace.tenant.id)
        .map((p) => ({ ...p, active: true, version: 1 })),
      tenantMembers: [
        {
          user_id: workspace.profile.id,
          role: "tenant-admin" as const,
          active: true,
          version: 1,
        },
      ],
      propertyMembers: [] as PropertyMember[],
      profiles: workspace.profiles,
      invitations: [] as Invitation[],
      events: [] as AdministrationEvent[],
    };
  const { db } = await getPropertyContext();
  let auditQuery = db
    .from("administration_events")
    .select("id,actor_id,action,subject_id,details,created_at")
    .eq("tenant_id", workspace.tenant.id);
  if (workspace.accessRole !== "tenant-admin")
    auditQuery = auditQuery.eq("property_id", workspace.property.id);
  const results = await Promise.all([
    db.from("tenants").select("version").eq("id", workspace.tenant.id).single(),
    db
      .from("properties")
      .select("*", { count: "exact" })
      .eq("tenant_id", workspace.tenant.id)
      .order("name"),
    db
      .from("tenant_memberships")
      .select("user_id,role,active,version", { count: "exact" })
      .eq("tenant_id", workspace.tenant.id),
    db
      .from("property_memberships")
      .select("user_id,role,active,version", { count: "exact" })
      .eq("tenant_id", workspace.tenant.id)
      .eq("property_id", workspace.property.id),
    db
      .from("membership_invitations")
      .select(
        "id,email,full_name,requested_role,delivery_status,expires_at,revoked_at,accepted_at",
      )
      .eq("tenant_id", workspace.tenant.id)
      .eq("property_id", workspace.property.id)
      .order("created_at", { ascending: false })
      .limit(50),
    auditQuery.order("created_at", { ascending: false }).limit(20),
  ]);
  if (
    results.some((r) => r.error) ||
    results.slice(1, 4).some((r) => r.count !== (r.data as unknown[])?.length)
  )
    throw new Error("Data administrasi tidak dapat dimuat secara lengkap.");
  const tenantMembers = results[2].data as TenantMember[];
  const directory = await db
    .from("profiles")
    .select("id,full_name", { count: "exact" })
    .in(
      "id",
      tenantMembers.map((m) => m.user_id),
    );
  if (directory.error || directory.count !== directory.data?.length)
    throw new Error("Directory administrasi tidak dapat dimuat.");
  return {
    snapshotTime,
    workspace,
    tenantVersion: (results[0].data as { version: number }).version,
    properties: results[1].data as ManagedProperty[],
    tenantMembers,
    propertyMembers: results[3].data as PropertyMember[],
    profiles: directory.data as Profile[],
    invitations: results[4].data as Invitation[],
    events: results[5].data as AdministrationEvent[],
  };
}
