"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPropertyContext } from "@/lib/access";
import { isDemo } from "@/lib/supabase/server";
import { matchesProperty } from "@/lib/property-context";
import { activitySchema, localActivityTime } from "@/lib/activity-validation";
import { normalizeSelfie } from "@/lib/selfie";
import type { ActionState } from "@/lib/models";

const fail = (message: string): ActionState => ({ status: "error", message });
const nullable = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};
const number = (form: FormData, key: string) => {
  const value = nullable(form, key);
  return value === null ? null : Number(value);
};

export async function createSalesActivity(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (isDemo())
    return fail("Demo hanya-baca. Aktivitas dan foto tidak disimpan.");
  const c = await getPropertyContext();
  if (!matchesProperty(c.property.id, form.get("property_id")))
    return fail("Property aktif berubah. Muat ulang form sebelum menyimpan.");
  let selfie: Buffer | null = null;
  let occurredAt: string;
  try {
    occurredAt = localActivityTime(
      String(form.get("occurred_local") ?? ""),
      c.property.timezone,
    );
    const file = form.get("selfie");
    if (file instanceof File && file.size)
      selfie = await normalizeSelfie(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return fail(
      "Waktu atau selfie tidak valid. Gunakan foto JPEG hasil kompresi maksimal 200 KB.",
    );
  }
  const parsed = activitySchema.safeParse({
    id: form.get("request_id"),
    company_id: form.get("company_id"),
    contact_id: nullable(form, "contact_id"),
    opportunity_id: nullable(form, "opportunity_id"),
    communication_type: form.get("communication_type"),
    occurred_at: occurredAt,
    summary: form.get("summary"),
    outcome: form.get("outcome"),
    notes: form.get("notes") || "",
    next_action: nullable(form, "next_action"),
    follow_up_date: nullable(form, "follow_up_date"),
    latitude: number(form, "latitude"),
    longitude: number(form, "longitude"),
    accuracy_m: number(form, "accuracy_m"),
    gps_captured_at: nullable(form, "gps_captured_at"),
    photo_sha256: selfie
      ? createHash("sha256").update(selfie).digest("hex")
      : null,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, ...payload } = parsed.data;
  try {
    const { error: registered } = await c.db.rpc("register_sales_activity", {
      target_property: c.property.id,
      activity: id,
      payload,
    });
    if (registered)
      return fail(
        "Aktivitas belum dapat disiapkan. Periksa akses client/PIC/peluang, waktu dan GPS terbaru; muat ulang jika form pernah diubah setelah percobaan simpan.",
      );
    if (selfie) {
      const path = `${c.tenant.id}/${c.property.id}/${c.user.id}/${id}.jpg`;
      const upload = await c.db.storage
        .from("activity-selfies")
        .upload(path, selfie, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "0",
        });
      if (upload.error) {
        const existing = await c.db.storage
          .from("activity-selfies")
          .download(path);
        if (
          !existing.data ||
          createHash("sha256")
            .update(new Uint8Array(await existing.data.arrayBuffer()))
            .digest("hex") !== payload.photo_sha256
        )
          return fail(
            "Unggah selfie belum terkonfirmasi. Aktivitas belum tercatat; periksa koneksi lalu coba lagi dengan form yang sama.",
          );
      }
    }
    const { error: finalized } = await c.db.rpc("finalize_sales_activity", {
      target_property: c.property.id,
      activity: id,
    });
    if (finalized)
      return fail(
        "Aktivitas belum terkonfirmasi. Pastikan selfie terunggah dan GPS tidak lebih dari 10 menit; periksa daftar aktivitas sebelum mengulang.",
      );
  } catch {
    return fail(
      "Hasil simpan belum diketahui karena koneksi terputus. Periksa daftar aktivitas; retry form yang sama aman dari duplikasi.",
    );
  }
  revalidatePath("/", "layout");
  redirect(`/activities?created=${id}`);
}
