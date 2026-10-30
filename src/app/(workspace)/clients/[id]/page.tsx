import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, ArrowLeft, MessageCircle } from "lucide-react";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/lib/workspace";
import { mapsLink, whatsappLink } from "@/lib/contact-links";
import { money } from "@/lib/utils";
import { STAGE_LABELS } from "@/lib/models";
export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const w = await getWorkspace();
  const c = w.companies.find((item) => item.id === id);
  if (!c) notFound();
  const contacts = w.contacts.filter((p) => p.company_id === id);
  const opportunities = w.opportunities.filter((o) => o.company_id === id);
  const maps = mapsLink(c.address, c.city);
  return (
    <>
      <Link
        href="/clients"
        className="mb-5 inline-flex items-center gap-2 text-xs text-slate-500"
      >
        <ArrowLeft size={14} />
        Kembali ke clients
      </Link>
      <PageHeading
        eyebrow={c.code}
        title={c.name}
        description={`${c.account_type || "Account type belum diisi"} · ${c.city || "Kota belum diisi"}`}
        action={
          maps && !w.demo ? (
            <Button variant="outline" asChild>
              <a href={maps} target="_blank" rel="noreferrer">
                <MapPin />
                Google Maps
              </a>
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">Informasi perusahaan</h2>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["Address", c.address],
                ["City", c.city],
                ["Tel no.", c.phone],
                ["Fax no.", c.fax],
                [
                  "Sales account",
                  w.profiles.find((p) => p.id === c.owner_id)?.full_name,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="mt-1.5">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">
              PIC perusahaan{" "}
              <span className="text-slate-400">({contacts.length})</span>
            </h2>
            <div className="mt-4 divide-y divide-slate-100">
              {contacts.map((p) => {
                const wa = whatsappLink(p.mobile);
                return (
                  <article key={p.id} className="py-4">
                    <h3 className="font-medium">
                      {[p.title, p.first_name, p.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {p.position || "Jabatan belum diisi"}
                    </p>
                    <p className="mt-3 break-all text-xs text-slate-500">
                      {p.email || "Email belum diisi"}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Phone size={13} />
                      {p.mobile || "Nomor belum diisi"}
                    </p>
                    {wa && !w.demo && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-4"
                      >
                        <a href={wa} target="_blank" rel="noreferrer">
                          <MessageCircle />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Peluang · {w.property.name}</h2>
              <Link
                href="/pipeline/new"
                className="text-xs font-semibold text-emerald-800"
              >
                Tambah peluang →
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {opportunities.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {o.next_action}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {money(o.estimated_value)}
                    </p>
                    <p className="mt-2 text-xs text-emerald-800">
                      {STAGE_LABELS[o.stage]}
                    </p>
                  </div>
                </div>
              ))}
              {!opportunities.length && (
                <p className="py-8 text-sm text-slate-400">
                  Belum ada peluang untuk client ini.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-xl border border-dashed border-slate-300 p-6">
            <h2 className="font-semibold">Timeline & dokumen</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Modul aktivitas, greeting dan LOO/LOA belum tersedia pada fondasi
              ini. Pengiriman dokumen belum diaktifkan.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
