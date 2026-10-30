import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, isConfigured } from "./supabase/server";
import { PROPERTY_COOKIE, selectProperty } from "./property-context";
import type { Profile, Property, PropertyOption, Tenant } from "./models";

export async function requireUser() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .single();
  if (profileError || !profile)
    throw new Error(
      "Profil belum tersedia. Hubungi admin untuk aktivasi akun.",
    );
  return { db, user, profile: profile as Profile };
}

export const getAccess = cache(async () => {
  if (!isConfigured()) redirect("/setup");
  const auth = await requireUser();
  const results = await Promise.all([
    auth.db
      .from("properties")
      .select("id, tenant_id, name, code, timezone, currency", {
        count: "exact",
      })
      .order("name"),
    auth.db.from("tenants").select("id, name", { count: "exact" }),
    auth.db
      .from("tenant_memberships")
      .select("tenant_id, role", { count: "exact" })
      .eq("user_id", auth.user.id)
      .eq("active", true),
    auth.db
      .from("property_memberships")
      .select("property_id, role", { count: "exact" })
      .eq("user_id", auth.user.id)
      .eq("active", true),
  ]);
  if (results.some((r) => r.error || r.count !== r.data?.length))
    throw new Error(
      "Akses organisasi/property tidak dapat dimuat secara lengkap.",
    );
  const properties = results[0].data as Property[];
  const tenants = results[1].data as Tenant[];
  const propertyOptions: PropertyOption[] = [];
  for (const property of properties) {
    const tenant = tenants.find((t) => t.id === property.tenant_id);
    const member = results[2].data!.find(
      (m) => m.tenant_id === property.tenant_id,
    );
    const propertyMember = results[3].data!.find(
      (m) => m.property_id === property.id,
    );
    if (!tenant || !member) continue;
    const role =
      member.role === "tenant-admin" ? "tenant-admin" : propertyMember?.role;
    if (
      role !== "tenant-admin" &&
      role !== "property-admin" &&
      role !== "sales"
    )
      continue;
    propertyOptions.push({
      ...property,
      tenant_name: tenant.name,
      access_role: role,
    });
  }
  return { ...auth, propertyOptions };
});

export const getPropertyContext = cache(async () => {
  const access = await getAccess();
  const selected = selectProperty(
    access.propertyOptions,
    (await cookies()).get(PROPERTY_COOKIE)?.value,
  );
  if (!selected) redirect("/access");
  return {
    ...access,
    property: selected,
    tenant: { id: selected.tenant_id, name: selected.tenant_name },
    accessRole: selected.access_role,
  };
});
