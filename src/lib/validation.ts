import { z } from "zod";
import { STAGES } from "./models";

const shortText = z.string().trim().max(200);
export const companySchema = z
  .object({
    name: shortText.min(2, "Nama perusahaan minimal 2 karakter."),
    address: z.string().trim().max(1000),
    city: shortText,
    phone: z.string().trim().max(40),
    fax: z.string().trim().max(40),
    account_type: shortText,
    title: shortText,
    first_name: shortText.min(1, "Nama PIC wajib diisi."),
    last_name: shortText,
    position: shortText,
    mobile: z.string().trim().max(40),
    email: z.union([z.literal(""), z.email("Format email tidak valid.")]),
  })
  .refine((data) => Boolean(data.mobile || data.email || data.phone), {
    message: "Isi minimal satu email atau nomor kontak.",
    path: ["email"],
  });

export const opportunitySchema = z.object({
  company_id: z.uuid(),
  name: shortText.min(3, "Nama peluang minimal 3 karakter."),
  offering_type: z.enum(["room", "meeting", "package"]),
  estimated_value: z
    .string()
    .regex(
      /^\d{1,12}(\.\d{1,2})?$/,
      "Nilai harus positif, maksimal 12 digit dan 2 desimal.",
    ),
  target_close: z.iso.date(),
  next_action: shortText.min(3, "Isi tindak lanjut berikutnya."),
  follow_up_date: z.iso.date(),
});

export const transitionSchema = z.object({
  id: z.uuid(),
  property_id: z.uuid(),
  stage: z.enum(STAGES),
  version: z.number().int().positive(),
  reason: z.string().trim().max(1000),
});

export function transitionError(stage: string, reason: string) {
  if (stage === "won")
    return "Won memerlukan LOA dan deposit/kredit terverifikasi. Modul verifikasi belum tersedia.";
  if (stage === "lost" && reason.trim().length < 3)
    return "Isi alasan Lost minimal 3 karakter.";
  return null;
}
