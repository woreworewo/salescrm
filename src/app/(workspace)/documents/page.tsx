import { PageHeading } from "@/components/shell";
export default function DocumentsPage() {
  return (
    <>
      <PageHeading
        eyebrow="From offer to agreement"
        title="LOO & LOA"
        description="Dua dokumen terhubung, dengan versi dan bukti persetujuan yang jelas."
      />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Modul dokumen belum diaktifkan. Pembuatan PDF, pengiriman, dan
        verifikasi persetujuan belum tersedia.
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {[
          {
            title: "LOO · Letter of Offer",
            text: "Rincian penawaran kamar, meeting, atau paket; jumlah, harga, tanggal, total, dan masa berlaku.",
          },
          {
            title: "LOA · Letter of Agreement",
            text: "Dibuat dari versi LOO final. Memuat rincian kesepakatan, deposit/kredit, pembatalan, dan pihak yang menyetujui.",
          },
        ].map((item) => (
          <section
            key={item.title}
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">{item.text}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm leading-7 text-slate-500">
        Won tetap diblokir sampai LOA dan syarat deposit atau kredit dapat
        diverifikasi. Pengiriman dokumen tidak otomatis berarti persetujuan
        client atau konfirmasi booking.
      </p>
    </>
  );
}
