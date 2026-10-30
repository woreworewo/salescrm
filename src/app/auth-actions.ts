"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, isConfigured, isDemo } from "@/lib/supabase/server";
import {
  appOrigin,
  authLinkSchema,
  passwordSchema,
} from "@/lib/auth-validation";
import type { ActionState } from "@/lib/models";
import { PROPERTY_COOKIE } from "@/lib/property-context";
import { cookies } from "next/headers";

const fail = (message: string): ActionState => ({ status: "error", message });

export async function requestPasswordReset(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!isConfigured() || isDemo())
    return fail("Reset akun memerlukan Supabase aktif, bukan mode demo.");
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return fail("Isi alamat email yang valid.");
  let origin: string;
  try {
    origin = appOrigin(process.env.CRM_APP_URL);
  } catch {
    return fail("Alamat aplikasi belum dikonfigurasi oleh admin.");
  }
  const db = await createClient();
  try {
    const { error } = await db.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${origin}/auth/confirm`,
    });
    if (error)
      return fail(
        "Permintaan belum dapat diproses. Tunggu beberapa saat sebelum mencoba lagi.",
      );
  } catch {
    return fail("Layanan akun belum dapat dihubungi.");
  }
  return {
    status: "success",
    message:
      "Jika akun dapat dipulihkan, instruksi akan dikirim ke email tersebut. Pada lingkungan lokal, periksa kotak email uji.",
  };
}

export async function verifyAuthLink(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!isConfigured() || isDemo())
    return fail("Aktivasi memerlukan layanan akun aktif.");
  const parsed = authLinkSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return fail("Tautan aktivasi tidak valid. Minta tautan baru.");
  const db = await createClient();
  try {
    const { error } = await db.auth.verifyOtp(parsed.data);
    if (error)
      return fail(
        "Tautan sudah digunakan atau kedaluwarsa. Minta tautan baru.",
      );
  } catch {
    return fail("Layanan akun belum dapat dihubungi.");
  }
  (await cookies()).delete(PROPERTY_COOKIE);
  redirect(parsed.data.type === "recovery" ? "/set-password" : "/invitations");
}

export async function setPassword(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!isConfigured() || isDemo())
    return fail("Perubahan kata sandi tidak tersedia dalam demo.");
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return fail(
      "Sesi tidak tersedia. Buka tautan aktivasi/reset terbaru dari email.",
    );
  try {
    const { error } = await db.auth.updateUser({
      password: parsed.data.password,
    });
    if (error)
      return fail(
        "Kata sandi belum dapat diubah. Gunakan tautan reset terbaru dan kata sandi yang memenuhi persyaratan.",
      );
    const logout = await db.auth.signOut({ scope: "others" });
    if (logout.error)
      return {
        status: "success",
        message:
          "Kata sandi tersimpan. Pengakhiran sesi lain belum terkonfirmasi.",
      };
  } catch {
    return fail(
      "Hasil perubahan belum dapat dikonfirmasi. Coba login sebelum mengulang.",
    );
  }
  redirect("/invitations?password=updated");
}

export async function acceptInvitation(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!isConfigured() || isDemo())
    return fail("Penerimaan undangan tidak tersedia dalam demo.");
  const parsed = z.uuid().safeParse(form.get("invitation_id"));
  if (!parsed.success) return fail("Undangan tidak valid.");
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: property, error } = await db.rpc(
    "accept_membership_invitation",
    { invitation: parsed.data },
  );
  if (error || !property)
    return fail(
      "Undangan tidak tersedia, sudah digunakan, atau pemberi undangan tidak lagi berwenang.",
    );
  (await cookies()).set(PROPERTY_COOKIE, property, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/?context=updated");
}
