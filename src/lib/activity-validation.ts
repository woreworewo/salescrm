import { z } from "zod";
import { COMMUNICATION_TYPES } from "./activity-models";

export const activitySchema = z
  .object({
    id: z.uuid(),
    company_id: z.uuid(),
    contact_id: z.uuid().nullable(),
    opportunity_id: z.uuid().nullable(),
    communication_type: z.enum(COMMUNICATION_TYPES),
    occurred_at: z.iso.datetime(),
    summary: z.string().trim().min(3).max(200),
    outcome: z.string().trim().min(3).max(1000),
    notes: z.string().trim().max(4000),
    next_action: z.string().trim().min(3).max(200).nullable(),
    follow_up_date: z.iso.date().nullable(),
    latitude: z.number().finite().min(-90).max(90).nullable(),
    longitude: z.number().finite().min(-180).max(180).nullable(),
    accuracy_m: z.number().finite().min(0).max(100000).nullable(),
    gps_captured_at: z.iso.datetime().nullable(),
    photo_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.next_action) !== Boolean(value.follow_up_date))
      context.addIssue({
        code: "custom",
        message: "Isi tindak lanjut dan tanggal tenggat bersama-sama.",
      });
    const gps = [
      value.latitude,
      value.longitude,
      value.accuracy_m,
      value.gps_captured_at,
    ];
    if (gps.some((v) => v !== null) && gps.some((v) => v === null))
      context.addIssue({ code: "custom", message: "Data GPS belum lengkap." });
    if (
      value.communication_type === "visit" &&
      (value.photo_sha256 === null || gps.some((v) => v === null))
    )
      context.addIssue({
        code: "custom",
        message: "Sales Visit/Meeting wajib menyertakan selfie dan GPS.",
      });
    if (
      value.communication_type !== "visit" &&
      (value.photo_sha256 !== null || gps.some((v) => v !== null))
    )
      context.addIssue({
        code: "custom",
        message: "Bukti selfie/GPS hanya untuk kunjungan.",
      });
  });

export const activityFiltersSchema = z
  .object({
    q: z.string().max(200).default(""),
    company: z.union([z.uuid(), z.literal("")]).default(""),
    type: z.union([z.enum(COMMUNICATION_TYPES), z.literal("")]).default(""),
    owner: z.union([z.uuid(), z.literal("")]).default(""),
    from: z.union([z.iso.date(), z.literal("")]).default(""),
    until: z.union([z.iso.date(), z.literal("")]).default(""),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine((v) => !v.from || !v.until || v.from <= v.until, {
    message: "Tanggal awal harus sebelum atau sama dengan tanggal akhir.",
  });

const OFFSETS: Record<string, string> = {
  "Asia/Jakarta": "+07:00",
  "Asia/Makassar": "+08:00",
  "Asia/Jayapura": "+09:00",
};
export function localActivityTime(value: string, zone: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?$/.test(value) ||
    !z.iso.date().safeParse(value.slice(0, 10)).success ||
    !OFFSETS[zone]
  )
    throw new Error("Waktu aktivitas tidak valid.");
  const parsed = new Date(`${value}${OFFSETS[zone]}`);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error("Waktu aktivitas tidak valid.");
  return parsed.toISOString();
}
export function initialActivityTime(zone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}
