"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/models";
import { getPropertyContext } from "@/lib/access";
import { matchesProperty } from "@/lib/property-context";
import { isDemo } from "@/lib/supabase/server";
import { invitationSchema, propertySchema } from "@/lib/admin-validation";
import {
  deliverInvitation,
  invitationMailConfigured,
} from "@/lib/invitation-mail";

const fail = (message: string): ActionState => ({ status: "error", message });
const ok = (message: string): ActionState => ({ status: "success", message });
const version = z.coerce.number().int().min(0);
async function context(form: FormData) {
  if (isDemo()) return null;
  const current = await getPropertyContext();
  if (
    current.accessRole === "sales" ||
    !matchesProperty(current.property.id, form.get("context_property_id"))
  )
    return null;
  return current;
}
async function result(error: unknown, message: string): Promise<ActionState> {
  if (error)
    return fail(
      "Perubahan ditolak: periksa hak akses, data terbaru, batas admin/property terakhir, atau duplikasi data. Muat ulang sebelum mencoba lagi.",
    );
  revalidatePath("/", "layout");
  return ok(message);
}

export async function renameTenant(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c || c.accessRole !== "tenant-admin")
    return fail("Tenant Admin pada konteks aktif diperlukan.");
  const parsed = z
    .object({ name: z.string().trim().min(2).max(200), version })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Nama organisasi atau versi tidak valid.");
  const { error } = await c.db.rpc("rename_tenant", {
    target_tenant: c.tenant.id,
    expected_version: parsed.data.version,
    next_name: parsed.data.name,
  });
  return result(error, "Nama organisasi diperbarui.");
}
export async function saveProperty(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c || c.accessRole !== "tenant-admin")
    return fail("Tenant Admin diperlukan.");
  const parsed = propertySchema
    .extend({
      target_property_id: z.union([z.literal(""), z.uuid()]),
      version,
      active: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return fail("Isi nama, kode, timezone dan status property yang valid.");
  const p = parsed.data;
  const { error } = await c.db.rpc("save_property", {
    target_tenant: c.tenant.id,
    target_property: p.target_property_id || null,
    expected_version: p.version,
    next_name: p.name,
    next_code: p.code,
    next_timezone: p.timezone,
    next_active: p.active === "true",
  });
  return result(error, "Property berhasil disimpan.");
}
export async function setTenantMembership(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c || c.accessRole !== "tenant-admin")
    return fail("Tenant Admin diperlukan.");
  const parsed = z
    .object({
      user_id: z.uuid(),
      version,
      role: z.enum(["tenant-admin", "member"]),
      active: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Membership tidak valid.");
  const p = parsed.data;
  const { error } = await c.db.rpc("set_tenant_membership", {
    target_tenant: c.tenant.id,
    target_user: p.user_id,
    expected_version: p.version,
    next_role: p.role,
    next_active: p.active === "true",
  });
  return result(error, "Membership organisasi diperbarui.");
}
export async function setPropertyMembership(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c) return fail("Akses administrasi/property aktif diperlukan.");
  const parsed = z
    .object({
      user_id: z.uuid(),
      version,
      role: z.enum(["property-admin", "sales"]),
      active: z.enum(["true", "false"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Membership tidak valid.");
  const p = parsed.data;
  const { error } = await c.db.rpc("set_property_membership", {
    target_property: c.property.id,
    target_user: p.user_id,
    expected_version: p.version,
    next_role: p.role,
    next_active: p.active === "true",
  });
  return result(error, "Membership property diperbarui.");
}
export async function requestInvitation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c) return fail("Akses administrasi/property aktif diperlukan.");
  const parsed = invitationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Isi nama, email dan role yang valid.");
  const { error } = await c.db.rpc("request_membership_invitation", {
    target_property: c.property.id,
    recipient_email: parsed.data.email,
    recipient_name: parsed.data.full_name,
    requested_role: parsed.data.role,
  });
  return result(
    error,
    "Undangan tersimpan; email belum dikirim. Gunakan tombol Kirim email aktivasi pada daftar undangan.",
  );
}
export async function revokeInvitation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c) return fail("Akses administrasi diperlukan.");
  const parsed = z.uuid().safeParse(form.get("invitation_id"));
  if (!parsed.success) return fail("Undangan tidak valid.");
  const { data } = await c.db
    .from("membership_invitations")
    .select("id")
    .eq("id", parsed.data)
    .eq("tenant_id", c.tenant.id)
    .eq("property_id", c.property.id)
    .maybeSingle();
  if (!data) return fail("Undangan tidak tersedia dalam property aktif.");
  const { error } = await c.db.rpc("revoke_membership_invitation", {
    invitation: parsed.data,
  });
  return result(error, "Undangan dicabut.");
}
export async function sendInvitation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c) return fail("Akses administrasi diperlukan.");
  if (!invitationMailConfigured())
    return fail(
      "SMTP lokal dan layanan akun belum dikonfigurasi. Email belum dikirim.",
    );
  const parsed = z.uuid().safeParse(form.get("invitation_id"));
  if (!parsed.success) return fail("Undangan tidak valid.");
  const { data: invite, error: readError } = await c.db
    .from("membership_invitations")
    .select("id,email")
    .eq("id", parsed.data)
    .eq("tenant_id", c.tenant.id)
    .eq("property_id", c.property.id)
    .maybeSingle();
  if (readError || !invite)
    return fail("Undangan tidak tersedia pada property aktif.");
  const { data: attempt, error: claimError } = await c.db.rpc(
    "claim_invitation_delivery",
    { invitation: invite.id },
  );
  if (claimError || !attempt)
    return fail(
      "Undangan tidak dapat dikirim. Periksa masa berlaku/akses atau tunggu 2 menit sebelum mencoba ulang.",
    );
  let sending = false;
  let status = "provider-accepted";
  try {
    await deliverInvitation(
      invite.email,
      c.tenant.name,
      c.property.name,
      () => {
        sending = true;
      },
    );
  } catch {
    status = sending ? "unknown" : "failed";
  }
  const finished = await c.db.rpc("finish_invitation_delivery", {
    invitation: invite.id,
    attempt,
    next_status: status,
  });
  revalidatePath("/", "layout");
  if (finished.error || status === "unknown")
    return fail(
      "Hasil pengiriman belum terkonfirmasi. Periksa kotak email uji sebelum mengirim ulang.",
    );
  if (status === "failed")
    return fail("Tautan akun belum dapat dibuat; email tidak dikirim.");
  return ok(
    "Server SMTP menerima email aktivasi. Pada lingkungan lokal, buka kotak email uji; ini belum merupakan bukti dibaca penerima.",
  );
}
export async function assignSalesRecord(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const c = await context(form);
  if (!c) return fail("Akses administrasi diperlukan.");
  const parsed = z
    .object({
      record_type: z.enum(["opportunity", "task"]),
      record_id: z.uuid(),
      owner_id: z.uuid(),
      version,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("Assignment tidak valid.");
  const p = parsed.data;
  const { error } = await c.db.rpc("assign_sales_record", {
    target_property: c.property.id,
    record_type: p.record_type,
    record_id: p.record_id,
    expected_version: p.version,
    next_owner: p.owner_id,
  });
  return result(error, "Penanggung jawab sales diperbarui.");
}
