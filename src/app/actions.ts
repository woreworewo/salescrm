"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import type { ActionState } from "@/lib/models";
import {
  companySchema,
  opportunitySchema,
  transitionError,
  transitionSchema,
} from "@/lib/validation";
import { createClient, isDemo } from "@/lib/supabase/server";
import { getAccess, getPropertyContext } from "@/lib/access";
import { matchesProperty, PROPERTY_COOKIE } from "@/lib/property-context";
import { demoWorkspace } from "@/lib/demo";

const errorState = (message: string): ActionState => ({
  status: "error",
  message,
});
const successState = (message: string): ActionState => ({
  status: "success",
  message,
});
function refresh() {
  revalidatePath("/", "layout");
}

const contextError = () =>
  errorState(
    "Property aktif berubah atau tidak sesuai. Muat ulang form sebelum menyimpan.",
  );

async function mutationContext(submittedProperty: unknown) {
  const context = await getPropertyContext();
  return matchesProperty(context.property.id, submittedProperty)
    ? context
    : null;
}

export async function switchProperty(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = z.uuid().safeParse(form.get("property_id"));
  if (!parsed.success) return errorState("Pilih property yang valid.");
  const options = isDemo()
    ? demoWorkspace().propertyOptions
    : (await getAccess()).propertyOptions;
  if (!options.some((p) => p.id === parsed.data))
    return errorState("Property tidak tersedia atau akses telah dicabut.");
  (await cookies()).set(PROPERTY_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  refresh();
  redirect("/?context=updated");
}

export async function signIn(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const credentials = z
    .object({ email: z.email(), password: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!credentials.success)
    return errorState("Isi email dan kata sandi yang valid.");
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(credentials.data);
  if (error)
    return errorState("Login gagal. Periksa kredensial atau hubungi admin.");
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(PROPERTY_COOKIE);
  if (!isDemo()) {
    const db = await createClient();
    await db.auth.signOut();
  }
  redirect("/login");
}

export async function createCompany(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (isDemo())
    return errorState(
      "Demo hanya-baca. Hubungkan database untuk menyimpan data.",
    );
  const parsed = companySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return errorState(parsed.error.issues[0].message);
  const context = await mutationContext(form.get("property_id"));
  if (!context) return contextError();
  const { db, property } = context;
  const { error } = await db.rpc("create_company_with_contact", {
    target_property: property.id,
    payload: parsed.data,
  });
  if (error)
    return errorState(
      "Client gagal disimpan. Periksa koneksi dan konfigurasi database.",
    );
  refresh();
  return successState("Client dan PIC berhasil disimpan.");
}

export async function createOpportunity(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (isDemo()) return errorState("Demo hanya-baca.");
  const parsed = opportunitySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return errorState(parsed.error.issues[0].message);
  const context = await mutationContext(form.get("property_id"));
  if (!context) return contextError();
  const { db, user, tenant, property } = context;
  const { error } = await db.from("opportunities").insert({
    ...parsed.data,
    owner_id: user.id,
    tenant_id: tenant.id,
    property_id: property.id,
  });
  if (error)
    return errorState(
      "Peluang gagal disimpan. Periksa akses client dan koneksi database.",
    );
  refresh();
  return successState("Peluang berhasil dibuat pada tahap Discovery.");
}

export async function moveOpportunity(input: unknown): Promise<ActionState> {
  if (isDemo()) return errorState("Demo hanya-baca. Perubahan tidak disimpan.");
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return errorState("Perubahan tahap tidak valid.");
  const invalid = transitionError(parsed.data.stage, parsed.data.reason);
  if (invalid) return errorState(invalid);
  const context = await mutationContext(parsed.data.property_id);
  if (!context) return contextError();
  const { db, property } = context;
  const { error } = await db.rpc("transition_opportunity", {
    target_property: property.id,
    opportunity: parsed.data.id,
    expected_version: parsed.data.version,
    next_stage: parsed.data.stage,
    reason: parsed.data.reason,
  });
  if (error)
    return errorState(
      "Tahap gagal diubah. Data mungkin telah berubah atau akses tidak tersedia; muat ulang sebelum mencoba lagi.",
    );
  refresh();
  return successState("Tahap peluang berhasil diperbarui.");
}

export async function createTask(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (isDemo()) return errorState("Demo hanya-baca.");
  const parsed = z
    .object({
      company_id: z.uuid(),
      title: z.string().trim().min(3).max(200),
      due_date: z.iso.date(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return errorState(
      "Isi client, judul minimal 3 karakter, dan tanggal tenggat.",
    );
  const context = await mutationContext(form.get("property_id"));
  if (!context) return contextError();
  const { db, user, tenant, property } = context;
  const { error } = await db.from("tasks").insert({
    ...parsed.data,
    owner_id: user.id,
    tenant_id: tenant.id,
    property_id: property.id,
  });
  if (error)
    return errorState("Task gagal disimpan. Periksa akses dan koneksi.");
  refresh();
  return successState("Task berhasil disimpan.");
}

export async function completeTask(input: unknown): Promise<ActionState> {
  if (isDemo()) return errorState("Demo hanya-baca.");
  const parsed = z
    .object({
      id: z.uuid(),
      version: z.number().int().positive(),
      completed: z.boolean(),
      property_id: z.uuid(),
    })
    .safeParse(input);
  if (!parsed.success) return errorState("Task tidak valid.");
  const context = await mutationContext(parsed.data.property_id);
  if (!context) return contextError();
  const { db, property } = context;
  const { error } = await db.rpc("set_task_completed", {
    target_property: property.id,
    task: parsed.data.id,
    expected_version: parsed.data.version,
    next_completed: parsed.data.completed,
  });
  if (error)
    return errorState(
      "Task gagal diubah. Muat ulang untuk mendapatkan data terbaru.",
    );
  refresh();
  return successState(
    parsed.data.completed ? "Task diselesaikan." : "Task dibuka kembali.",
  );
}
