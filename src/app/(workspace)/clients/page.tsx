import Link from "next/link";
import { Plus, Search, ArrowUpRight } from "lucide-react";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/lib/workspace";
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const w = await getWorkspace();
  const { q = "" } = await searchParams;
  const query = q.slice(0, 200).toLocaleLowerCase();
  const companies = w.companies.filter((c) =>
    `${c.name} ${c.code} ${c.city}`.toLocaleLowerCase().includes(query),
  );
  return (
    <>
      <PageHeading
        eyebrow="Relationships"
        title="Clients"
        description="Semua perusahaan dan PIC, dengan konteks yang Anda butuhkan."
        action={
          <Button asChild>
            <Link href="/clients/new">
              <Plus />
              Tambah client
            </Link>
          </Button>
        }
      />
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <p className="text-sm font-semibold">
            Directory{" "}
            <span className="ml-2 rounded bg-slate-100 px-2 py-1 text-xs font-normal text-slate-500">
              {companies.length}
            </span>
          </p>
          <form className="flex w-full gap-2 sm:w-auto" role="search">
            <label className="sr-only" htmlFor="client-search">
              Cari client, kode, atau kota
            </label>
            <input
              id="client-search"
              name="q"
              defaultValue={q}
              maxLength={200}
              placeholder="Cari client, kode, kota…"
              className="sm:w-64"
            />
            <Button variant="outline" type="submit" aria-label="Cari client">
              <Search />
            </Button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Perusahaan</th>
                <th>Kota</th>
                <th>PIC</th>
                <th>Account type</th>
                <th>Sales account</th>
                <th>
                  <span className="sr-only">Detail</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const pic = w.contacts.find((p) => p.company_id === c.id);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td>
                      <Link
                        href={`/clients/${c.id}`}
                        className="font-semibold hover:text-emerald-800"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-1.5 text-xs text-slate-400">{c.code}</p>
                    </td>
                    <td className="text-sm text-slate-500">{c.city || "—"}</td>
                    <td>
                      <p className="text-sm">
                        {pic
                          ? `${pic.first_name} ${pic.last_name}`
                          : "Belum ada PIC"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {pic?.email || pic?.mobile || "—"}
                      </p>
                    </td>
                    <td>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">
                        {c.account_type || "Belum diisi"}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {w.profiles.find((p) => p.id === c.owner_id)?.full_name ||
                        "—"}
                    </td>
                    <td>
                      <Link
                        href={`/clients/${c.id}`}
                        aria-label={`Detail ${c.name}`}
                        className="inline-flex rounded p-2 text-slate-400 hover:bg-slate-100"
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!companies.length && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    {q
                      ? "Tidak ada client yang cocok."
                      : "Belum ada client. Tambahkan perusahaan pertama Anda."}
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
