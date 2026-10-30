import Link from "next/link";
import Image from "next/image";
import {
  COMMUNICATION_LABELS,
  type SalesActivity,
} from "@/lib/activity-models";
import type { Workspace } from "@/lib/models";
import { dateLabel } from "@/lib/utils";

export function ActivityCards({
  activities,
  workspace: w,
}: {
  activities: SalesActivity[];
  workspace: Workspace;
}) {
  return (
    <div className="space-y-4">
      {activities.map((a) => {
        const company = w.companies.find((c) => c.id === a.company_id);
        const pic = w.contacts.find((p) => p.id === a.contact_id);
        return (
          <article
            key={a.id}
            className="min-w-0 break-words rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-block rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                  {COMMUNICATION_LABELS[a.communication_type]}
                </span>
                <h2 className="mt-3 text-base font-semibold">{a.summary}</h2>
                <Link
                  href={`/clients/${a.company_id}`}
                  className="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline"
                >
                  {company?.name || "Client"}
                </Link>
                {pic && (
                  <span className="ml-2 text-xs text-slate-400">
                    · {pic.first_name} {pic.last_name}
                  </span>
                )}
              </div>
              <p className="text-xs leading-6 text-slate-400">
                {new Date(a.occurred_at).toLocaleString("id-ID", {
                  timeZone: w.property.timezone,
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                <br />
                {w.profiles.find((p) => p.id === a.owner_id)?.full_name ||
                  "Sales"}
              </p>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {a.outcome}
            </p>
            {a.notes && (
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-400">
                {a.notes}
              </p>
            )}
            {a.opportunity_id && (
              <p className="mt-3 text-xs text-slate-500">
                Peluang:{" "}
                {w.opportunities.find((o) => o.id === a.opportunity_id)?.name ||
                  "Peluang terkait"}
              </p>
            )}
            {a.next_action && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                <Link
                  href="/tasks"
                  className="font-semibold text-emerald-800 hover:underline"
                >
                  Task tindak lanjut
                </Link>
                : {a.next_action} · {dateLabel(a.follow_up_date)}
              </div>
            )}
            {a.latitude !== null && (
              <p className="mt-4 text-xs leading-6 text-slate-500">
                GPS: {a.latitude.toFixed(6)}, {a.longitude?.toFixed(6)} ·
                Akurasi ±{Math.round(a.accuracy_m ?? 0)} m · Diambil{" "}
                {new Date(a.gps_captured_at!).toLocaleString("id-ID", {
                  timeZone: w.property.timezone,
                })}
              </p>
            )}
            {a.photo_path && !w.demo && (
              <details className="mt-4">
                <summary className="w-fit rounded text-xs font-semibold text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500">
                  Lihat selfie kunjungan
                </summary>
                <Image
                  unoptimized
                  src={`/activities/${a.id}/photo`}
                  alt="Selfie bukti kunjungan"
                  width={320}
                  height={240}
                  className="mt-3 h-60 max-w-full rounded-lg bg-slate-100 object-contain"
                />
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}
