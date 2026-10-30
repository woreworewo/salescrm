"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, MapPin, CheckCircle2 } from "lucide-react";
import { createSalesActivity } from "@/app/activity-actions";
import {
  COMMUNICATION_LABELS,
  COMMUNICATION_TYPES,
  type CommunicationType,
  type GpsEvidence,
} from "@/lib/activity-models";
import { compressSelfie } from "@/lib/compress-selfie";
import { INITIAL_STATE, type ActionState, type Workspace } from "@/lib/models";
import { Feedback } from "./forms";
import { Button } from "./ui/button";

export function ActivityForm({
  workspace: w,
  requestId,
  initialTime,
  initialCompany = "",
}: {
  workspace: Workspace;
  requestId: string;
  initialTime: string;
  initialCompany?: string;
}) {
  const [type, setType] = useState<CommunicationType>("visit");
  const [company, setCompany] = useState(initialCompany);
  const [contact, setContact] = useState("");
  const [opportunity, setOpportunity] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [photo, setPhoto] = useState<{
    file: File;
    url: string;
    original: number;
  } | null>(null);
  const photoUrl = useRef<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [gps, setGps] = useState<GpsEvidence | null>(null);
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const attempt = useRef<{ fingerprint: string | null; id: string }>({
    fingerprint: null,
    id: requestId,
  });
  useEffect(
    () => () => {
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    },
    [],
  );

  const [state, action, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      if (type === "visit") {
        if (photo) form.set("selfie", photo.file);
        if (gps)
          Object.entries(gps).forEach(([key, value]) =>
            form.set(key, String(value)),
          );
      }
      const fileHash = photo
        ? Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                await photo.file.arrayBuffer(),
              ),
            ),
          )
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("")
        : "";
      const fingerprint =
        JSON.stringify(
          [...form.entries()].filter(
            ([key, value]) => key !== "request_id" && typeof value === "string",
          ),
        ) + fileHash;
      if (
        attempt.current.fingerprint !== null &&
        attempt.current.fingerprint !== fingerprint
      )
        attempt.current.id = crypto.randomUUID();
      attempt.current.fingerprint = fingerprint;
      form.set("request_id", attempt.current.id);
      try {
        return await createSalesActivity(previous, form);
      } catch (error) {
        // Redirects belong to Next.js; let the action runtime handle them.
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          String(error.digest).startsWith("NEXT_REDIRECT")
        )
          throw error;
        return {
          status: "error" as const,
          message:
            "Koneksi terputus. Periksa daftar aktivitas sebelum mengulang simpan.",
        };
      }
    },
    INITIAL_STATE,
  );

  function clearPhoto() {
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
    setPhoto(null);
  }
  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    setPhotoError("");
    clearPhoto();
    try {
      const compressed = await compressSelfie(file);
      const url = URL.createObjectURL(compressed);
      photoUrl.current = url;
      setPhoto({ file: compressed, url, original: file.size });
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : "Foto tidak dapat diproses. Ambil ulang selfie.",
      );
    } finally {
      setCompressing(false);
    }
  }
  function captureGps() {
    setGpsError("");
    setGps(null);
    if (!navigator.geolocation || !window.isSecureContext) {
      setGpsError(
        "GPS memerlukan browser yang mendukung lokasi melalui localhost atau HTTPS.",
      );
      return;
    }
    setGpsPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          gps_captured_at: new Date(position.timestamp).toISOString(),
        });
        setGpsPending(false);
      },
      (error) => {
        setGpsPending(false);
        setGpsError(
          error.code === 1
            ? "Izin lokasi ditolak. Izinkan lokasi pada pengaturan browser lalu coba lagi."
            : error.code === 3
              ? "GPS belum merespons. Pindah ke lokasi dengan sinyal lebih baik lalu coba lagi."
              : "Lokasi belum tersedia. Periksa GPS perangkat dan coba lagi.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }

  return (
    <form action={action} className="max-w-4xl space-y-6">
      <Feedback state={state} />
      {w.demo && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Demo hanya-baca. Form ditampilkan sebagai contoh; aktivitas, lokasi
          dan selfie tidak dikirim/disimpan.
        </p>
      )}
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="property_id" value={w.property.id} />
      <fieldset
        disabled={w.demo || pending}
        className="space-y-6 disabled:opacity-60"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 font-semibold">Konteks aktivitas</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              Client *
              <select
                name="company_id"
                value={company}
                required
                disabled={compressing || gpsPending}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setContact("");
                  setOpportunity("");
                  clearPhoto();
                  setGps(null);
                  setPhotoError("");
                  setGpsError("");
                }}
              >
                <option value="" disabled>
                  Pilih perusahaan
                </option>
                {w.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jenis komunikasi *
              <select
                name="communication_type"
                value={type}
                disabled={compressing || gpsPending}
                onChange={(e) => {
                  setType(e.target.value as CommunicationType);
                  clearPhoto();
                  setGps(null);
                  setPhotoError("");
                  setGpsError("");
                }}
              >
                {COMMUNICATION_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {COMMUNICATION_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              PIC (opsional)
              <select
                name="contact_id"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              >
                <option value="">Tanpa PIC khusus</option>
                {w.contacts
                  .filter((p) => p.company_id === company)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Peluang (opsional)
              <select
                name="opportunity_id"
                value={opportunity}
                onChange={(e) => setOpportunity(e.target.value)}
              >
                <option value="">Tanpa peluang khusus</option>
                {w.opportunities
                  .filter((o) => o.company_id === company)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Waktu aktivitas · {w.property.timezone} *
              <input
                name="occurred_local"
                type="datetime-local"
                defaultValue={initialTime}
                required
              />
            </label>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 font-semibold">Hasil komunikasi</h2>
          <div className="space-y-5">
            <label>
              Ringkasan *
              <input
                name="summary"
                required
                minLength={3}
                maxLength={200}
                placeholder="Contoh: Kunjungan pembahasan company gathering"
              />
            </label>
            <label>
              Hasil / outcome *
              <textarea
                name="outcome"
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                placeholder="Apa yang disepakati atau perlu ditindaklanjuti?"
              />
            </label>
            <label>
              Catatan tambahan
              <textarea name="notes" maxLength={4000} rows={3} />
            </label>
          </div>
        </section>
        {type === "visit" && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">Bukti kunjungan · wajib</h2>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Ambil selfie dan GPS saat berada di client. Lokasi hanya diminta
              saat tombol ditekan; tidak ada pelacakan terus-menerus.
            </p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <label>
                  <span className="flex items-center gap-2">
                    <Camera size={16} />
                    Ambil / pilih selfie
                  </span>
                  <input
                    type="file"
                    className="mt-2 min-w-0 max-w-full"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    disabled={compressing || pending || w.demo}
                    onChange={(e) => {
                      void pickPhoto(e.target.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  JPEG/PNG/WebP sumber maksimal 10 MB / 24 MP. Hasil maksimal
                  200 KB; metadata gambar dibuang sebelum disimpan.
                </p>
                {compressing && (
                  <p
                    role="status"
                    className="mt-3 rounded bg-slate-100 p-3 text-xs"
                  >
                    Memperkecil foto…
                  </p>
                )}
                {photoError && (
                  <p role="alert" className="mt-3 text-xs text-rose-700">
                    {photoError}
                  </p>
                )}
                {photo && (
                  <div className="mt-4">
                    <Image
                      unoptimized
                      src={photo.url}
                      alt="Preview selfie sebelum diunggah"
                      width={320}
                      height={240}
                      className="h-48 w-full rounded-lg bg-slate-100 object-contain"
                    />
                    <p className="mt-2 text-xs text-emerald-800">
                      {Math.ceil(photo.original / 1024)} KB →{" "}
                      {Math.ceil(photo.file.size / 1024)} KB · siap diunggah
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={clearPhoto}
                      className="mt-2"
                    >
                      Ganti / hapus foto
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={captureGps}
                  disabled={gpsPending || pending || w.demo}
                >
                  <MapPin />
                  {gpsPending ? "Mencari lokasi…" : "Ambil GPS sekarang"}
                </Button>
                {gpsError && (
                  <p
                    role="alert"
                    className="mt-3 text-xs leading-6 text-rose-700"
                  >
                    {gpsError}
                  </p>
                )}
                {gps && (
                  <div
                    role="status"
                    className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs leading-6 text-emerald-900"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={14} />
                      Lokasi diperoleh
                    </p>
                    <p>
                      {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                    </p>
                    <p>Akurasi ±{Math.round(gps.accuracy_m)} m</p>
                    <p>
                      Diambil{" "}
                      {new Date(gps.gps_captured_at).toLocaleTimeString(
                        "id-ID",
                        { timeZone: w.property.timezone },
                      )}
                    </p>
                    {gps.accuracy_m > 100 && (
                      <p className="mt-2 text-amber-900">
                        Akurasi masih rendah. Coba ambil ulang di area terbuka.
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-3 text-xs leading-6 text-slate-400">
                  GPS harus diambil dalam 10 menit terakhir saat disimpan. Jika
                  izin ditolak, kunjungan belum dapat dicatat.
                </p>
              </div>
            </div>
          </section>
        )}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
            />
            Buat task tindak lanjut
          </label>
          {followUp && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label>
                Next action *
                <input
                  name="next_action"
                  required
                  minLength={3}
                  maxLength={200}
                />
              </label>
              <label>
                Tenggat *<input name="follow_up_date" type="date" required />
              </label>
            </div>
          )}
          <p className="mt-3 text-xs leading-6 text-slate-400">
            Task dibuat satu kali setelah aktivitas tercatat. Pipeline peluang
            tetap pada tahap saat ini.
          </p>
        </section>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={
            w.demo ||
            pending ||
            compressing ||
            gpsPending ||
            (type === "visit" && (!photo || !gps))
          }
        >
          {pending ? "Menyimpan aktivitas…" : "Simpan aktivitas"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/activities">Kembali ke aktivitas</Link>
        </Button>
      </div>
    </form>
  );
}
