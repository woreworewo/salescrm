import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, isConfigured, isDemo } from "./supabase/server";
import { demoWorkspace } from "./demo";
import type { Profile, Workspace } from "./models";

export async function requireUser() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();
  if (profileError || !profile)
    throw new Error(
      "Profil belum tersedia. Hubungi admin untuk aktivasi akun.",
    );
  return { db, user, profile: profile as Profile };
}

export const getWorkspace = cache(async (): Promise<Workspace> => {
  if (isDemo()) return demoWorkspace();
  if (!isConfigured()) redirect("/setup");
  const { db, profile } = await requireUser();
  const results = await Promise.all([
    db
      .from("companies")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false }),
    db.from("contacts").select("*", { count: "exact" }),
    db
      .from("opportunities")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false }),
    db.from("tasks").select("*", { count: "exact" }).order("due_date"),
    db.from("profiles").select("id, full_name, role", { count: "exact" }),
  ]);
  if (results.some((result) => result.error))
    throw new Error(
      "Data CRM tidak dapat dimuat. Periksa koneksi dan migrasi database.",
    );
  if (results.some((result) => result.count !== result.data?.length))
    throw new Error(
      "Data melebihi batas respons. Pagination server perlu diaktifkan sebelum memuat seluruh workspace.",
    );
  return {
    demo: false,
    profile,
    companies: results[0].data!,
    contacts: results[1].data!,
    opportunities: results[2].data!,
    tasks: results[3].data!,
    profiles: results[4].data!,
  } as Workspace;
});
