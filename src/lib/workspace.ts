import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isConfigured, isDemo } from "./supabase/server";
import { demoWorkspace } from "./demo";
import type { Workspace } from "./models";
import { getPropertyContext } from "./access";
import { PROPERTY_COOKIE } from "./property-context";

export const getWorkspace = cache(async (): Promise<Workspace> => {
  if (isDemo())
    return demoWorkspace((await cookies()).get(PROPERTY_COOKIE)?.value);
  if (!isConfigured()) redirect("/setup");
  const { db, profile, property, tenant, accessRole, propertyOptions } =
    await getPropertyContext();
  const results = await Promise.all([
    db
      .from("companies")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    db
      .from("contacts")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenant.id),
    db
      .from("opportunities")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenant.id)
      .eq("property_id", property.id)
      .order("created_at", { ascending: false }),
    db
      .from("tasks")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenant.id)
      .eq("property_id", property.id)
      .order("due_date"),
    db
      .from("tenant_memberships")
      .select("user_id", { count: "exact" })
      .eq("tenant_id", tenant.id)
      .eq("active", true),
  ]);
  if (results.some((result) => result.error))
    throw new Error(
      "Data CRM tidak dapat dimuat. Periksa koneksi dan migrasi database.",
    );
  if (results.some((result) => result.count !== result.data?.length))
    throw new Error(
      "Data melebihi batas respons. Pagination server perlu diaktifkan sebelum memuat seluruh workspace.",
    );
  const directory = await db
    .from("profiles")
    .select("id, full_name", { count: "exact" })
    .in(
      "id",
      results[4].data!.map((member) => member.user_id),
    );
  if (directory.error || directory.count !== directory.data?.length)
    throw new Error("Directory pengguna tidak dapat dimuat secara lengkap.");
  return {
    demo: false,
    profile,
    property,
    tenant,
    accessRole,
    propertyOptions,
    companies: results[0].data!,
    contacts: results[1].data!,
    opportunities: results[2].data!,
    tasks: results[3].data!,
    profiles: directory.data!,
  } as Workspace;
});
