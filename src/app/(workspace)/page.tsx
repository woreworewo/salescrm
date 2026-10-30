import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Columns3,
  ListChecks,
  Wallet,
  ChevronRight,
  Plus,
} from "lucide-react";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/lib/workspace";
import { dateLabel, money, today } from "@/lib/utils";
import { STAGES, STAGE_LABELS } from "@/lib/models";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ context?: string }>;
}) {
  const w = await getWorkspace();
  const { context } = await searchParams;
  const open = w.opportunities.filter(
    (o) => !["won", "lost"].includes(o.stage),
  );
  const pending = w.tasks.filter((t) => !t.completed);
  const overdue = pending.filter(
    (t) => t.due_date < today(w.property.timezone),
  );
  const metrics = [
    {
      label: "Total clients",
      value: w.companies.length,
      detail: "Perusahaan dalam cakupan akses",
      icon: Building2,
    },
    {
      label: "Peluang aktif",
      value: open.length,
      detail: "Discovery hingga Negotiation",
      icon: Columns3,
    },
    {
      label: "Nilai pipeline",
      value: money(open.reduce((sum, o) => sum + Number(o.estimated_value), 0)),
      detail: "Estimasi · bukan pendapatan",
      icon: Wallet,
    },
    {
      label: "Follow-up overdue",
      value: overdue.length,
      detail: `${pending.length} task belum selesai`,
      icon: ListChecks,
    },
  ];
  return (
    <>
      {context === "updated" && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          Workspace ditampilkan untuk {w.tenant.name} / {w.property.name}.
        </p>
      )}
      <PageHeading
        eyebrow="Your sales, in focus"
        title={`Selamat datang, ${w.profile.full_name.split(" ")[0]}`}
        description="Lihat prioritas hari ini dan jaga setiap peluang tetap bergerak."
        action={
          <Button asChild>
            <Link href="/clients/new">
              <Plus />
              Tambah client
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <section
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-slate-500">{label}</h2>
              <Icon size={17} className="text-slate-400" />
            </div>
            <p className="mt-5 truncate text-[26px] font-semibold tracking-tight">
              {value}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">{detail}</p>
          </section>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Pipeline snapshot</h2>
              <p className="mt-1 text-xs text-slate-400">
                Distribusi peluang berdasarkan tahap saat ini
              </p>
            </div>
            <Link
              href="/pipeline"
              className="flex items-center gap-1 text-xs font-semibold text-emerald-800"
            >
              Lihat board <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="mt-7 space-y-5">
            {STAGES.map((stage) => {
              const count = w.opportunities.filter(
                (o) => o.stage === stage,
              ).length;
              return (
                <div
                  key={stage}
                  className="grid grid-cols-[105px_1fr_24px] items-center gap-4"
                >
                  <span className="text-xs text-slate-500">
                    {STAGE_LABELS[stage]}
                  </span>
                  <div className="h-5 overflow-hidden rounded bg-slate-50">
                    <div
                      className={`h-full rounded ${stage === "lost" ? "bg-rose-200" : "bg-emerald-700"}`}
                      style={{
                        width: `${w.opportunities.length ? (count / w.opportunities.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-right text-xs font-semibold">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Prioritas follow-up</h2>
            <Link href="/tasks" aria-label="Lihat semua follow-up">
              <ChevronRight size={18} className="text-slate-400" />
            </Link>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {pending.slice(0, 4).map((task) => (
              <Link
                href="/tasks"
                key={task.id}
                className="block py-4 first:pt-0"
              >
                <p className="text-sm font-medium">{task.title}</p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {w.companies.find((c) => c.id === task.company_id)?.name}
                </p>
                <p
                  className={`mt-2 text-[11px] ${task.due_date < today(w.property.timezone) ? "text-rose-700" : "text-emerald-700"}`}
                >
                  {task.due_date < today(w.property.timezone)
                    ? "Overdue · "
                    : "Tenggat · "}
                  {dateLabel(task.due_date)}
                </p>
              </Link>
            ))}
            {!pending.length && (
              <p className="py-12 text-center text-sm text-slate-400">
                Tidak ada task tertunda.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between p-6">
          <div>
            <h2 className="font-semibold">Peluang yang sedang berjalan</h2>
            <p className="mt-1 text-xs text-slate-400">
              Ringkasan client, nilai, dan langkah berikutnya
            </p>
          </div>
          <Link
            href="/pipeline"
            className="text-xs font-semibold text-emerald-800"
          >
            Semua peluang →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Peluang / Client</th>
                <th>Tahap</th>
                <th>Estimasi nilai</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {open.slice(0, 5).map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link
                      className="font-medium hover:text-emerald-800"
                      href={`/clients/${o.company_id}`}
                    >
                      {o.name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-400">
                      {w.companies.find((c) => c.id === o.company_id)?.name}
                    </p>
                  </td>
                  <td>
                    <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                      {STAGE_LABELS[o.stage]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-sm font-medium">
                    {money(o.estimated_value)}
                  </td>
                  <td className="text-xs text-slate-500">{o.next_action}</td>
                </tr>
              ))}
              {!open.length && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    Belum ada peluang aktif. Tambahkan client lalu buat peluang
                    pertama.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
