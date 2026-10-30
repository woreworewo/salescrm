import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { ActivityCards } from "@/components/activity-cards";
import { PageHeading, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getActivityFeed } from "@/lib/activities";
import {
  COMMUNICATION_LABELS,
  COMMUNICATION_TYPES,
} from "@/lib/activity-models";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const input = await searchParams;
  const {
    workspace: w,
    activities,
    total,
    filters,
    error,
  } = await getActivityFeed(input);
  function pageHref(page: number) {
    const query = new URLSearchParams(
      Object.entries(filters).map(([key, value]) => [key, String(value)]),
    );
    query.set("page", String(page));
    return `/activities?${query}`;
  }
  return (
    <>
      <PageHeading
        eyebrow="Sales in the field"
        title="Sales activities"
        description="Riwayat komunikasi dan kunjungan pada property aktif. Pipeline tetap dikelola terpisah."
        action={
          <Button asChild>
            <Link href="/activities/new">
              <Plus />
              Catat aktivitas
            </Link>
          </Button>
        }
      />
      {input.created && activities.some((a) => a.id === input.created) && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          Aktivitas telah tercatat. Jika ada tindak lanjut, task juga sudah
          dibuat.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-800"
        >
          Filter tidak valid: {error}
        </p>
      )}
      <form
        className="mb-6 rounded-xl border border-slate-200 bg-white p-5"
        role="search"
      >
        <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label>
            Cari ringkasan
            <input
              name="q"
              maxLength={200}
              defaultValue={filters.q}
              placeholder="Ringkasan aktivitas…"
            />
          </label>
          <label>
            Client
            <select name="company" defaultValue={filters.company}>
              <option value="">Semua client</option>
              {w.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Komunikasi
            <select name="type" defaultValue={filters.type}>
              <option value="">Semua komunikasi</option>
              {COMMUNICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {COMMUNICATION_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sales
            <select name="owner" defaultValue={filters.owner}>
              <option value="">Semua yang dapat diakses</option>
              {w.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dari tanggal
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label>
            Sampai tanggal
            <input name="until" type="date" defaultValue={filters.until} />
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <Button type="submit" variant="outline">
            <Search />
            Terapkan filter
          </Button>
          <Button asChild variant="ghost">
            <Link href="/activities">Reset</Link>
          </Button>
        </div>
      </form>
      <p className="mb-4 text-xs text-slate-500">
        {total} aktivitas tercatat · Sales melihat aktivitas miliknya; admin
        mengikuti cakupan property.
      </p>
      {activities.length ? (
        <ActivityCards activities={activities} workspace={w} />
      ) : (
        <EmptyState
          title="Belum ada aktivitas yang cocok"
          description="Catat komunikasi pertama atau sesuaikan filter. Kunjungan wajib menyertakan selfie dan GPS terbaru."
        />
      )}
      <nav
        aria-label="Halaman aktivitas"
        className="mt-6 flex flex-wrap items-center justify-between gap-3"
      >
        <span className="text-xs text-slate-400">
          Halaman {filters.page} dari {Math.max(1, Math.ceil(total / 20))}
        </span>
        <div className="flex gap-3">
          {filters.page > 1 && (
            <Button variant="outline" asChild>
              <Link href={pageHref(filters.page - 1)}>Sebelumnya</Link>
            </Button>
          )}
          {filters.page * 20 < total && (
            <Button variant="outline" asChild>
              <Link href={pageHref(filters.page + 1)}>Berikutnya</Link>
            </Button>
          )}
        </div>
      </nav>
    </>
  );
}
