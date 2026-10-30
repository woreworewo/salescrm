import { PageHeading } from "@/components/shell";
import { getWorkspace } from "@/lib/workspace";
import Link from "next/link";
export default async function SettingsPage() {
  const w = await getWorkspace();
  const rows = [
    {
      title: `${w.tenant.name} / ${w.property.name}`,
      status: w.accessRole,
      detail: `Property aktif: ${w.property.code} · ${w.property.timezone} · ${w.property.currency}. Admin dapat mengelola property, membership dan undangan melalui Administration.`,
    },
    {
      title: "Database & autentikasi",
      status: w.demo ? "Demo hanya-baca" : "Terhubung ke Supabase",
      detail:
        "Client/PIC bersama dalam tenant; transaksi dibatasi membership property dan owner sales.",
    },
    {
      title: "Mailbox property",
      status: "Belum dihubungkan",
      detail:
        "Greeting dan pengiriman PDF belum tersedia. Provider dan mailbox property perlu dikonfigurasi sebelum pengiriman diaktifkan.",
    },
    {
      title: "Background jobs",
      status: "Belum dikonfigurasi",
      detail:
        "Outbox, retry, dan integrasi Trigger.dev diperlukan sebelum pengiriman diaktifkan.",
    },
    {
      title: "File & dokumen",
      status: "Belum diaktifkan",
      detail:
        "Storage privat dan aturan akses file akan ditambahkan bersama modul aktivitas/dokumen.",
    },
    {
      title: "Inbox & live chat",
      status: "Rilis lanjutan",
      detail:
        "Email masuk dan widget live chat berada di backlog setelah sales inti stabil.",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Workspace configuration"
        title="Settings & integrations"
        description="Status koneksi dan kemampuan yang tersedia saat ini."
      />
      {w.accessRole !== "sales" && (
        <Link
          href="/administration"
          className="mb-5 inline-block text-sm font-semibold text-emerald-800 underline"
        >
          Buka Administration →
        </Link>
      )}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {rows.map((row) => (
          <section
            key={row.title}
            className="flex flex-wrap justify-between gap-4 p-6"
          >
            <div>
              <h2 className="font-semibold">{row.title}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                {row.detail}
              </p>
            </div>
            <span className="h-fit rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
              {row.status}
            </span>
          </section>
        ))}
      </div>
      <p className="mt-5 text-xs leading-6 text-slate-400">
        Konfigurasi secret dan provisioning dilakukan oleh admin melalui
        environment hosting. Halaman ini tidak menyimpan kredensial integrasi.
      </p>
    </>
  );
}
