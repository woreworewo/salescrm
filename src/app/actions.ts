"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/models";
import {
  companySchema,
  opportunitySchema,
  transitionError,
  transitionSchema,
} from "@/lib/validation";
import { createClient, isDemo } from "@/lib/supabase/server";
import { requireUser } from "@/lib/workspace";

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
  const { db } = await requireUser();
  const { error } = await db.rpc("create_company_with_contact", {
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
  const { db, user } = await requireUser();
  const { error } = await db
    .from("opportunities")
    .insert({ ...parsed.data, owner_id: user.id });
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
  const { db } = await requireUser();
  const { error } = await db.rpc("transition_opportunity", {
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
  const { db, user } = await requireUser();
  const { error } = await db
    .from("tasks")
    .insert({ ...parsed.data, owner_id: user.id });
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
    })
    .safeParse(input);
  if (!parsed.success) return errorState("Task tidak valid.");
  const { db } = await requireUser();
  const { error } = await db.rpc("set_task_completed", {
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
