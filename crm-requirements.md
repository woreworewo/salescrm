# Spesifikasi awal Sales CRM

## Keputusan implementasi dan batas rilis

Keputusan pengerjaan terbaru: pengembangan dan uji lokal dahulu; provisioning staging Supabase/Vercel ditunda. Gunakan Supabase CLI dengan Docker dan kotak email uji lokal, tanpa mengirim email internet. Setup tidak menginstal Docker/mengubah Windows, menimpa env, atau mereset data otomatis. Panduan: docs/local-development.md. Docker belum tersedia pada komputer saat tahap ini dibuat; uji Auth/SMTP end-to-end menunggu runtime lokal aktif.

Disetujui: aplikasi modular Next.js App Router + TypeScript/Node.js; Tailwind CSS + shadcn/ui; Supabase PostgreSQL/Auth/Storage privat; Trigger.dev untuk background job; Vercel untuk aplikasi. Region utama diusulkan Singapura, dengan compute dekat database. Akun/region/paket final belum diprovisikan. Development, staging dan production harus terpisah; staging tidak memakai data atau secret production.

MVP peluncuran awal: fondasi multi-tenant/multi-property; login undangan dan role Tenant Admin/Property Admin/Sales; perusahaan dan banyak PIC; import dengan validasi/deduplikasi; Kanban dan tabel peluang; aktivitas/selfie/GPS kunjungan; task follow-up; LOO→LOA dengan PDF/versi/bukti persetujuan; greeting dan pengiriman dokumen lewat satu provider email dengan mailbox per property; dashboard dasar; tombol Maps/WhatsApp.

Rilis lanjutan: inbox email masuk, widget live chat, sinkronisasi WhatsApp, tanda tangan elektronik terintegrasi, campaign, automasi kompleks, forecasting/analitik lanjutan dan offline penuh. Kebutuhan ini tetap tercatat sebagai backlog produk, bukan syarat MVP awal. Bagian fitur di bawah menjelaskan target produk; batas rilis ini mengatur prioritasnya.

UI/UX: dashboard bisnis berlatar netral dengan satu aksen brand, tabel mudah dipindai, navigasi responsif, fokus keyboard terlihat, status dengan teks, skeleton saat fetching, dan feedback setiap mutasi. Menu utama: Dashboard, Clients, Pipeline, Activities, Tasks, Documents, Settings; Inbox muncul saat fiturnya tersedia. Detail client mengelompokkan ringkasan/PIC, timeline, peluang dan dokumen. Form kunjungan mengutamakan mobile; form dokumen memakai rincian→preview→konfirmasi→kirim. Hindari grafik dekoratif, metrik contoh tanpa label, tombol tanpa fungsi dan notifikasi sukses semu.

Aturan agen: ikuti AGENTS.md; bedakan fitur implemented, belum diverifikasi, dan pending pada README. Infrastruktur belum terhubung harus menampilkan setup state, bukan data demo otomatis. Demo read-only hanya pada mode eksplisit yang diberi label; database tetap sumber kebenaran. Bangun bertahap dengan vertical slice yang diuji, bukan mengklaim seluruh MVP selesai dari tampilan saja.

## 1. Database client

### Tenant dan property — fondasi MVP disetujui

- Tenant/organisasi adalah batas isolasi antarperusahaan atau grup hotel. Satu tenant memiliki banyak property/hotel/cabang. Pengguna dapat menjadi anggota beberapa tenant dan beberapa property dengan role berbeda.
- Profil pengguna hanya menyimpan identitas. Tenant membership memiliki role tenant-admin/member; property membership memiliki role property-admin/sales. Tidak ada global admin dalam aplikasi.
- Tenant Admin dapat mengakses semua property aktif dalam tenant miliknya serta ringkasan lintas-property. Property Admin mengelola transaksi seluruh sales pada property yang ditugaskan. Sales mengakses transaksi miliknya pada property yang ditugaskan.
- Perusahaan/PIC dibagikan kepada anggota aktif dalam tenant yang sama; ini aturan bisnis yang disengaja. Kebutuhan pembatasan client tertentu di dalam tenant memerlukan kebijakan terpisah. Data perusahaan/PIC tidak pernah dibagikan antar-tenant secara otomatis.
- Peluang, aktivitas, task, LOO/LOA, booking, pembayaran, mailbox, percakapan dan assignment terikat tenant/property. Semua relasi client, transaksi dan property harus berasal dari tenant yang sama melalui composite foreign key, bukan validasi UI saja.
- Identitas/branding pengirim, harga, nomor dokumen, template, ketentuan dan mailbox dikonfigurasi per property saat modul terkait dibangun. MVP memakai IDR; timezone awal per property mendukung WIB/WITA/WIT. Konfigurasi pricing/dokumen/mailbox belum diimplementasikan pada fondasi ini.
- Property switcher menampilkan organisasi dan property aktif, hanya menawarkan akses sah, dan mengarahkan kembali ke Overview setelah pergantian. Form yang belum tersimpan tidak ikut berpindah. Form lama dari tab lain ditolak bila konteksnya berbeda dari property aktif.
- Cookie property hanyalah preferensi UI. Server membaca ulang membership aktif dan database menerapkan RLS. Membership property atau property nonaktif menutup akses transaksi property tersebut. Membership tenant atau tenant nonaktif juga menutup directory bersama dalam tenant, tanpa menunggu login ulang. Cache privat, export, file, pencarian dan pekerjaan background wajib mengikuti scope yang sama.
- Migrasi dari fondasi satu organisasi memakai forward migration: data lama, PIC, peluang, task dan riwayat masuk satu organisasi/property awal; role admin lama menjadi Tenant Admin hanya untuk organisasi tersebut. Instalasi baru tidak membuat tenant/data demo otomatis. Pengelompokan data lama harus ditinjau sebelum migrasi production.
- Fondasi implementasi mencakup schema/RLS, scope query/mutasi, switcher, ringkasan Tenant Admin dan UI Administration. Tenant Admin mengubah nama organisasi, membuat/mengubah/menonaktifkan property serta mengelola membership; Property Admin hanya mengelola Sales pada property-nya. Bootstrap organisasi pertama melalui tooling tepercaya; tidak ada hak global untuk membuat tenant bebas. Billing SaaS/domain khusus tetap rilis lanjutan.
- Undangan menyimpan email, role, tenant/property, pengundang dan masa berlaku. Simpan undangan, kirim email, dan penerimaan adalah aksi berbeda. Server membuat tautan Auth hanya setelah otorisasi; token tidak disimpan pada tabel undangan. Penerima harus memverifikasi email Auth dan menerima rincian; issuer harus masih berwenang. Undangan sekali pakai, dapat dicabut, dan kedaluwarsa. Alur aktivasi/reset kata sandi memakai origin aplikasi tetap dan konfirmasi eksplisit sebelum token digunakan.
- Lindungi Tenant Admin aktif terakhir serta property aktif terakhir dari deaktivasi; mutasi administratif memakai pemeriksaan versi dan audit. Assignment peluang/task hanya ke anggota dengan akses aktif pada property yang sama. Browser tidak diberi grant UPDATE langsung ke membership.
- Tes wajib: penolakan lintas-tenant/property, role berbeda per membership, self-escalation, FK campur tenant, owner yang aksesnya dicabut, RPC tanpa otorisasi, form stale setelah switch, dan preservasi data lama.

Seluruh field sumber harus tersedia:

| Kelompok               | Field                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| Identitas perusahaan   | No., Company Name, Address, City, Tel No., Fax No., Account Type    |
| PIC client             | Title, First Name, Last Name, Position, Mobile No., Email           |
| Penanggung jawab sales | Sales Account, Position (Sales/Account), Mobile No. (Sales/Account) |

Usulan struktur: perusahaan memiliki banyak PIC, aktivitas, peluang penjualan, percakapan, dan dokumen. Sales Account direlasikan ke pengguna sales; jabatan dan nomor sales berasal dari profil pengguna. Nomor urut tampilan dipisahkan dari ID database.

Halaman detail client menyediakan tautan Google Maps berdasarkan alamat, tombol WhatsApp berdasarkan nomor yang dipilih, Send Greeting ke email PIC, serta riwayat aktivitas dan dokumen.

## 2. Sales activity

- Disimpan di tabel sendiri dan terhubung ke client, PIC, sales, serta peluang penjualan jika relevan.
- Tipe komunikasi wajib: WhatsApp, Direct Call, Sales Visit / Meeting, Email.
- Catat waktu aktivitas, catatan hasil, tindak lanjut, dan tanggal follow-up.
- Dukung pengambilan selfie, kompresi gambar sebelum unggah, serta GPS berupa latitude, longitude, akurasi, dan waktu pengambilan.
- Usulan kompresi: resize dan kualitas adaptif dengan batas ukuran yang disepakati; wajah harus tetap terbaca. Jangan menyimpan gambar asli tanpa kebutuhan.
- Izin kamera/GPS yang ditolak harus menghasilkan pesan yang jelas. Kewajiban selfie/GPS per tipe aktivitas masih perlu ditentukan.
- GPS perangkat adalah bukti lokasi yang dilaporkan perangkat; belum mencakup jaminan anti-pemalsuan.

## 3. Pipeline penjualan

Usulan awal, bukan standar tunggal yang wajib diikuti:

- Status lead: New → Contacted → Qualified / Disqualified. Lead yang belum siap dapat ditandai Nurturing dengan jadwal follow-up.
- Tahap peluang setelah qualified: Discovery → Proposal Sent → Negotiation → Won / Lost.
- Konversi lead menghubungkan atau membuat perusahaan, PIC, dan peluang setelah pemeriksaan duplikasi. Riwayat lead tetap tersimpan.

Pipeline melekat pada peluang penjualan agar satu client dapat memiliki beberapa transaksi. Simpan owner, estimasi nilai, target closing, riwayat perubahan tahap, dan alasan lost. Aktivitas komunikasi dicatat terpisah dari tahap pipeline.

### Kanban pipeline — cakupan MVP disetujui

- Satu board dengan kolom Discovery, Proposal Sent, Negotiation, Won, dan Lost; setiap kartu mewakili satu peluang transaksi.
- Kartu menampilkan perusahaan, nama peluang, estimasi nilai, sales penanggung jawab, target closing, dan follow-up berikutnya.
- Berikan penanda follow-up overdue dan aging tahap; ambang aging dapat dikonfigurasi.
- Board selalu dibatasi property aktif. Filter berdasarkan sales, periode target closing, dan jenis offering. Sediakan tampilan tabel untuk pencarian dan pengurutan data.
- Perpindahan tahap tersedia melalui drag-and-drop serta menu yang dapat digunakan dengan keyboard. Validasi hak akses dan syarat transisi dilakukan di server; kegagalan mengembalikan kartu ke tahap sebelumnya dan menampilkan alasan.
- Lost wajib disertai alasan. Won mengikuti syarat komersial pada bagian 7; perpindahan kartu tidak boleh melewati persyaratan tersebut.
- Pada mobile, setiap kolom tetap dapat diakses dan aksi pindah tahap tersedia tanpa drag. Inbox menggunakan daftar percakapan dengan status dan assignment.

## 4. Email dan greeting

- Hubungkan email PIC pada client untuk greeting dan follow-up.
- Tombol Send Greeting membuka preview penerima, subjek, dan isi sebelum pengiriman.
- Email masuk ke mailbox CRM tampil di dashboard; demo menggunakan mailbox admin terdaftar setelah integrasi mailbox tersedia.
- Admin dapat menugaskan email kepada sales atau membalas dari dashboard.
- Simpan thread, penerima, pengirim, lampiran, assignment, waktu, dan status pengiriman/gagal. Balasan mengikuti thread asal.
- Integrasi mailbox harus mendukung penerimaan dan pengiriman; alamat email admin saja belum cukup sebagai integrasi.

## 5. Live chat website

- Widget dapat dipasang pada website melalui embed script.
- Percakapan masuk ke inbox dashboard CRM.
- Admin dapat membalas atau assign kepada sales; sales melanjutkan percakapan yang ditugaskan.
- Usulan status percakapan: Open, Pending, Resolved. Assignment disimpan terpisah: Unassigned atau pengguna/tim yang bertanggung jawab.
- Pesan masuk baru pada percakapan resolved membuka kembali percakapan sesuai aturan yang disepakati. Simpan riwayat assignment dan cegah balasan ganda oleh dua agen.
- Identitas pengunjung dapat dihubungkan ke client/PIC setelah diverifikasi; pengunjung anonim tidak otomatis disamakan berdasarkan nama.

## 6. WhatsApp dan Maps

- WhatsApp: normalisasi nomor ke format internasional dan buka chat pada nomor pilihan. Tautan chat tidak membuktikan nomor aktif atau mencatat pesan otomatis ke CRM.
- Google Maps: buka pencarian alamat lengkap client; koordinat client dapat ditambahkan jika tersedia.
- Sinkronisasi percakapan WhatsApp ke inbox merupakan integrasi tambahan di luar tombol chat yang diminta.

## 7. LOO / LOA dan penawaran

### Definisi dan alur — disetujui

- LOO (Letter of Offer) adalah dokumen penawaran produk, harga, dan ketentuan kepada client.
- LOA (Letter of Agreement) adalah dokumen kesepakatan final setelah negosiasi. Keduanya terpisah dan saling terhubung ke client serta peluang yang sama.
- Alur: peluang → buat LOO → review dan konfirmasi sales → kirim → negosiasi/revisi → pilih LOO versi final → generate LOA → review dan konfirmasi sales → kirim → persetujuan client → konfirmasi booking sesuai kebijakan.
- LOA mengambil data dari versi LOO yang dipilih tanpa mengetik ulang. Simpan referensi versi asal; perubahan LOO berikutnya tidak otomatis mengubah LOA yang sudah dibuat.

### Isi dan validasi

| Dokumen | Isi wajib                                                                                                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LOO     | Nomor/versi, perusahaan, PIC/penerima, item kamar/meeting/paket, tanggal layanan, kuantitas dan satuan, harga, mata uang, pajak/diskon jika berlaku, total, masa berlaku, ketentuan penawaran                         |
| LOA     | Nomor/versi, referensi LOO, identitas para pihak, rincian layanan dan nilai final, jadwal pembayaran/deposit atau ketentuan kredit, pembatalan/perubahan jadwal, tenggat persetujuan, pihak yang berwenang menyetujui |

- Total dihitung dan divalidasi di server dengan aturan pembulatan yang ditetapkan.
- Sebelum mengirim LOO maupun LOA, sales wajib memeriksa dan mengonfirmasi ulang penerima, nama perusahaan, item, tanggal, harga, dan total pada preview versi terbaru. Perubahan isi, penerima, atau lampiran membatalkan konfirmasi sebelumnya.
- Konfirmasi internal sales terpisah dari persetujuan client. Send LOA tidak berarti client telah menyetujui.
- Upload LOO/LOA eksternal tetap didukung; jenis dokumen, relasi client/peluang, metadata wajib, dan pemeriksaan sales tetap berlaku.

### Versi, persetujuan, dan status

- Dokumen yang telah dikirim tidak ditimpa. Simpan snapshot data client/PIC, rincian, ketentuan, template, nomor/versi, PDF, penerima, waktu, dan riwayat pengiriman.
- Revisi LOO menghasilkan versi baru. LOA yang belum disepakati dapat direvisi sebagai versi baru; perubahan setelah disepakati dilakukan melalui amendment/addendum yang merujuk dokumen sebelumnya dan memiliki bukti persetujuan tersendiri.
- Lifecycle LOO: Draft → Reviewed → Issued → Accepted / Rejected / Expired / Superseded. Lifecycle LOA: Draft → Reviewed → Issued → Agreed / Rejected / Expired / Superseded. Reviewed adalah konfirmasi internal; Issued berarti versi telah diterbitkan untuk dikirim, bukan bukti diterima client.
- Status setiap pengiriman (Queued, Processing, Provider Accepted, Delivered bila tersedia, Failed, Unknown) disimpan terpisah dari lifecycle dokumen. Satu versi dapat memiliki beberapa pengiriman yang tercatat.
- Accepted/Agreed memerlukan bukti persetujuan atas versi tertentu, identitas pihak yang menyetujui, waktu, dan pengguna yang memverifikasinya. Upload dokumen bertanda tangan belum otomatis mengubah status sebelum diverifikasi.
- Status dokumen, pembayaran, booking, dan tahap peluang dipisahkan. LOA terkirim/disepakati tidak otomatis membuktikan deposit diterima atau ketersediaan kamar/ruang.
- Won hanya dapat ditetapkan setelah syarat komersial terpenuhi: LOA disetujui serta deposit diverifikasi atau fasilitas kredit disetujui sesuai kebijakan. Catat bukti, verifier, dan waktu; detail ambang deposit/kredit masih perlu ditetapkan.
- Konfirmasi booking memerlukan pemeriksaan ketersediaan dan referensi konfirmasi operasional. CRM tidak mengunci stok tanpa integrasi reservasi.

### Cakupan MVP

Template LOO, generate LOA dari versi penawaran final, upload dokumen eksternal, preview/konfirmasi ulang, pengiriman PDF, upload dan verifikasi dokumen bertanda tangan, serta riwayat versi/persetujuan. Tanda tangan elektronik terintegrasi dapat ditambahkan kemudian. Isi ketentuan resmi dan kewenangan persetujuan ditetapkan perusahaan sebelum penggunaan operasional.

Template isi awal LOO:

> Kepada: [Nama PIC], [Nama Perusahaan]
>
> Perihal: Penawaran [Kamar / Meeting / Paket]
>
> Dengan hormat, berikut penawaran kami:
>
> [Item] | [Kuantitas] | [Harga Satuan] | [Subtotal]
>
> Total penawaran: [Mata Uang dan Total]
>
> Berlaku sampai: [Tanggal]. Ketentuan: [Ketentuan Penawaran].
>
> Hormat kami, [Nama Sales], [Perusahaan Pengirim], [Kontak Sales].

## 8. Entitas data yang diusulkan

Fondasi multi-tenancy menambahkan `tenants`, `properties`, `tenant-memberships`, dan `property-memberships`. `profiles` hanya identitas pengguna. Perusahaan/PIC membawa tenant; seluruh transaksi dan riwayat membawa tenant/property dengan composite foreign key dan RLS. Daftar entitas modul berikut mengikuti scope tersebut.

| Entitas                      | Fungsi                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| companies                    | Identitas, alamat, jenis account, owner sales                                     |
| contacts                     | PIC dan detail kontak per perusahaan                                              |
| users                        | Admin/sales beserta profil                                                        |
| leads                        | Prospek awal, sumber lead, status kualifikasi, referensi hasil konversi           |
| opportunities                | Peluang, nilai, tahap pipeline, target closing                                    |
| tasks                        | Tindak lanjut, tenggat, penanggung jawab, status penyelesaian                     |
| pipeline-stage-history       | Riwayat perubahan tahap                                                           |
| sales-activities             | Aktivitas komunikasi, hasil, lokasi, follow-up                                    |
| attachments                  | Metadata file, selfie, dan dokumen                                                |
| conversations                | Kanal, client/PIC, status, assignment                                             |
| messages                     | Isi pesan, arah, thread provider, status kirim                                    |
| mailbox-connections          | Koneksi mailbox dan referensi kredensial aman                                     |
| offers / offer-items         | Penawaran, rincian harga, total, versi, konfirmasi                                |
| agreements / agreement-items | LOA, snapshot rincian final, referensi versi LOO, versi dan ketentuan kesepakatan |
| document-approvals           | Bukti persetujuan per versi, pihak yang menyetujui, verifier dan waktu            |
| document-deliveries          | Penerima, lampiran versi tertentu, waktu dan status setiap pengiriman             |
| agreement-amendments         | Amendment/addendum dan relasi ke kesepakatan sebelumnya                           |
| outbox-jobs                  | Antrean pengiriman yang persisten, percobaan, status dan referensi provider       |
| integration-events           | Deduplikasi event masuk dan status pemrosesan                                     |
| audit-events                 | Jejak aksi penting dan pengiriman                                                 |

Nama di atas bersifat konseptual; penamaan tabel mengikuti konvensi database saat implementasi.

## 9. Usulan tahapan pengerjaan

1. Fondasi: autentikasi, tenant/property/membership dan role terstruktur, database client/PIC tenant bersama, import data dengan preview/deduplikasi, detail client, tombol Maps/WhatsApp. Uji koneksi provider email sejak fase ini untuk memvalidasi kelayakan integrasi.
2. Sales: aktivitas, selfie terkompresi, GPS, peluang/pipeline dengan Kanban dan tabel, follow-up.
3. Dokumen: template/upload LOO, generate LOA dari versi final, perhitungan, preview, konfirmasi ulang, pengiriman greeting/PDF, versi dan verifikasi bukti persetujuan.
4. Inbox: integrasi email masuk/keluar, widget live chat, assignment dan balasan.

Tahapan ini tidak menghapus kebutuhan pada fase berikutnya. Integrasi eksternal harus diuji dengan akun/provider yang sebenarnya; data demo harus diberi label.

## 10. Kriteria penerimaan utama

- Semua field client tersimpan dan dapat diedit; satu perusahaan dapat memiliki beberapa PIC.
- Aktivitas tersimpan pada tabel terpisah dengan tipe komunikasi wajib; foto/GPS dapat diperiksa sesuai aturan yang disepakati.
- Perubahan pipeline tersimpan dan terlihat pada riwayat peluang.
- Kanban dan tabel menampilkan peluang yang sama; filter, penanda overdue/aging, drag-and-drop, dan menu keyboard berfungsi. Transisi tidak sah ditolak tanpa meninggalkan tampilan tahap yang keliru.
- Tombol Maps dan WhatsApp menggunakan alamat/nomor client yang dipilih.
- Greeting dan penawaran menampilkan preview; sukses/gagal pengiriman terlihat jelas dan tercatat, dengan pencegahan kirim ganda.
- Status antre, diproses, diterima provider, terkirim/delivered bila tersedia, gagal, dan hasil belum diketahui dibedakan. Timeout tidak langsung dianggap gagal atau dikirim ulang tanpa rekonsiliasi.
- Dokumen tidak dapat dikirim tanpa field wajib dan konfirmasi ulang atas versi terbaru.
- LOA mengambil rincian dari versi LOO yang dipilih. Perubahan master client atau versi baru tidak mengubah PDF/snapshot yang sudah diterbitkan.
- Persetujuan client merujuk versi tertentu dan bukti terverifikasi; pengiriman saja tidak mengubah dokumen menjadi Accepted/Agreed atau peluang menjadi Won.
- Status pembayaran dan booking dapat diverifikasi melalui bukti/referensi yang tercatat; perubahan menjadi Won memvalidasi LOA dan syarat deposit/kredit di server.
- Email eksternal dan pesan widget benar-benar masuk ke dashboard, dapat di-assign, dan balasannya sampai ke kanal asal.
- Tenant Admin dan Property Admin mengelola assignment sesuai cakupannya; akses sales terhadap transaksi dibatasi owner dan membership property. Directory perusahaan/PIC bersama dalam tenant aktif.
- Tampilan responsif, dapat digunakan dengan keyboard, memiliki fokus terlihat, skeleton saat fetching, serta feedback langsung untuk setiap mutasi.
- Database menjadi sumber kebenaran. Gunakan Next.js App Router/RSC dan caching native; fetching client jika perlu memakai SWR/React Query. State lokal memakai useState/useReducer; Zustand hanya jika diperlukan, tanpa Redux.
- File/folder kebab-case; tes unit bila dibutuhkan ditempatkan di sebelah logikanya.

Kanban dan alur LOO–LOA pada bagian 3 dan 7 telah disetujui. Rekomendasi audit lain pada bagian 13 perlu disepakati sebagai cakupan implementasi; tambahan tersebut belum berarti seluruhnya wajib masuk MVP.

## 11. Keputusan yang masih dibutuhkan

- Output berikutnya: prototype UI, aplikasi MVP, atau spesifikasi untuk estimasi vendor?
- Template resmi LOO/LOA, ketentuan pembatalan/perubahan, pihak berwenang, dan format bukti persetujuan.
- Syarat Won dan konfirmasi booking secara rinci: ambang/tenggat deposit, fasilitas kredit, verifier, serta sumber pemeriksaan ketersediaan.
- Provider email (misalnya Google Workspace/Microsoft 365/provider lain) dan domain website untuk widget.
- Apakah selfie/GPS wajib hanya saat Sales Visit / Meeting? Target maksimum ukuran foto dan kebijakan retensinya?
- Daftar Account Type, tahap pipeline final, dan cakupan akses data tiap sales.
- Ketentuan harga: kuantitas kamar/malam/pax, mata uang, pajak, diskon, dan format nomor dokumen.

## 12. Referensi produk

Ditinjau 30 Oktober 2026; hanya sebagai inspirasi fitur, bukan komitmen mengadopsi seluruh produk:

- [Mekari Qontak](https://qontak.com/fitur/aplikasi-crm/): manajemen kontak/deal, GPS sales, dan live chat.
- [Goapp One](https://www.goappone.com/): data pelanggan dan percakapan lintas kanal dalam satu workspace.
- [Qiscus](https://www.qiscus.com/id): omnichannel inbox dan pipeline/deal CRM.
- [Barantum](https://www.barantum.com/): sales CRM, omnichannel, dan aktivitas sales lapangan.

## 13. Rekomendasi hasil audit

### A. Kualitas data dan operasional sales — prioritas MVP

- Bedakan Account Type (segmentasi bisnis) dari lifecycle client (prospect/active/inactive). Gunakan daftar nilai terkelola agar laporan konsisten.
- Simpan kode client stabil dan unik; nomor urut hanya untuk tampilan. Normalisasi telepon, email, dan alamat untuk pencarian; jangan menjadikan nama perusahaan atau domain email sebagai kunci unik mutlak.
- Import harus menyediakan mapping kolom, preview, validasi per baris, laporan error, dan penanganan duplikasi. Merge client dilakukan dengan konfirmasi dan mempertahankan relasi/riwayat.
- Field wajib awal cukup nama perusahaan atau identitas lead dan satu kanal kontak yang dapat dipakai. Field tambahan diwajibkan saat transisi bisnis yang membutuhkan, bukan seluruhnya saat input pertama.
- Setiap peluang aktif memiliki owner, next action, dan tenggat follow-up. Tampilkan overdue dan peluang tanpa aktivitas; task terpisah dari catatan aktivitas yang sudah terjadi.
- Catat sumber lead dan alasan disqualified/lost dari daftar terkelola. Definisikan syarat masuk tiap tahap; Won memerlukan bukti penerimaan yang disepakati, bukan sekadar penawaran terkirim.
- Dashboard awal: follow-up overdue, lead belum ditangani, aging tiap tahap, nilai pipeline, konversi, won/lost, dan waktu respons inbox. Tetapkan definisi periode dan metrik agar jumlah aktivitas tidak dianggap otomatis sebagai kualitas sales.

### B. Penawaran untuk kamar/meeting/paket — prioritas MVP

- Gunakan lifecycle LOO/LOA, status pengiriman, dan verifikasi persetujuan terpisah sebagaimana bagian 7. Status penerimaan hanya berubah berdasarkan bukti terverifikasi atas versi tertentu.
- Versi yang sudah dikirim tidak ditimpa. Simpan snapshot nama/alamat perusahaan, PIC, item, harga, ketentuan, template, penerima, dan PDF agar perubahan master client tidak mengubah dokumen lama.
- Gunakan decimal atau integer satuan uang terkecil dengan aturan pembulatan eksplisit; jangan floating point biner untuk total keuangan. Tentukan urutan diskon, pajak, dan service charge bila berlaku.
- Dukung satuan sesuai produk: kamar × malam, ruang × sesi/hari, atau paket × pax. Simpan tanggal layanan, kapasitas/jumlah tamu, minimum order bila relevan, dan masa berlaku harga.
- Penawaran tidak otomatis memesan stok kamar/ruang. Reservasi dan pemeriksaan ketersediaan membutuhkan alur/integrasi tersendiri bila masuk cakupan.
- Konfirmasi ulang sales wajib; approval manager hanya bila harga/diskon melampaui batas yang disepakati. Upload file saja belum dianggap memenuhi template: metadata wajib tetap diisi dan dikonfirmasi.

### C. Keandalan email dan inbox — prioritas sebelum integrasi digunakan

- Gunakan akun mailbox organisasi khusus CRM untuk operasional; mailbox admin hanya untuk demo. Pisahkan identitas login pengguna dari identitas pengirim email.
- Gunakan OAuth/provider resmi bila tersedia, scope minimum, penyimpanan token terenkripsi, serta indikator koneksi putus dan aksi reconnect. Jangan menyimpan token di log atau browser.
- Catat permintaan kirim bersama job outbox dalam satu transaksi database; worker memprosesnya dengan retry terbatas, backoff, idempotency, dan antrean gagal yang dapat ditindaklanjuti. Jangan menjanjikan exactly-once delivery jika provider tidak mendukung deduplikasi.
- Event masuk dapat berulang atau tidak berurutan. Deduplikasi berdasarkan koneksi/provider/event atau message ID; simpan checkpoint sinkronisasi dan sediakan rekonsiliasi untuk event terlewat.
- Untuk Gmail, gunakan sinkronisasi berbasis history, penanganan checkpoint kedaluwarsa, dan pembaruan watch bila memakai push. Provider lain mengikuti mekanisme resminya.
- Thread menggunakan identitas provider serta Message-ID/In-Reply-To/References bila tersedia; subjek email saja tidak cukup. Email yang identitas client-nya ambigu masuk antrean pencocokan manual.
- Tampilkan queued segera setelah server menyimpan permintaan. Jangan tampilkan sukses terkirim hanya karena tombol diklik atau job dibuat. Pantau bounce/failure jika provider menyediakan event tersebut.
- Pisahkan email operasional dari campaign. Greeting massal dan automasi marketing memerlukan preferensi komunikasi, aturan berhenti berlangganan, serta batas pengiriman yang disepakati.

### D. Akses, file, dan widget — prioritas MVP terkait fitur

- Matriks akses mengikuti tenant/property pada bagian 1. Semua pemeriksaan dilakukan di server dan RLS, termasuk download lampiran dan export. Tenant Admin tidak memperoleh hak admin di tenant lain; Property Admin tidak memperoleh hak admin di property lain tanpa assignment tersebut.
- Lindungi selfie/dokumen melalui storage privat dan URL sementara. Validasi ukuran, ekstensi yang diizinkan, tipe dan signature isi file, nama acak, serta scan file dokumen sebelum dipakai. Render isi email dengan sanitasi dan blokir konten aktif.
- Widget memakai ID publik website, bukan secret CRM. Batasi domain embed, terapkan rate limit dan validasi server; pembatasan domain bukan pengganti autentikasi/otorisasi. Pengunjung hanya dapat membaca percakapannya sendiri melalui token sesi yang tidak mudah ditebak.
- Tentukan retensi selfie, GPS, pesan, dan dokumen; jelaskan penggunaan lokasi kepada sales dan rekam hanya saat aktivitas yang memerlukannya. Hapus metadata EXIF yang tidak diperlukan setelah koordinat yang dibutuhkan disimpan terstruktur.
- Simpan audit actor, aksi, objek, waktu, dan perubahan penting dengan akses terbatas. Backup database serta file, dan uji restore; arsip/soft-delete saja bukan backup.

### E. Pengalaman mobile dan fondasi teknis

- Mulai dengan aplikasi responsif. Usulan selfie: sisi terpanjang 1.280 px, target ≤200 KB dengan kualitas adaptif; angka ini perlu diuji pada perangkat lapangan dan tidak boleh mengorbankan keterbacaan.
- Untuk kunjungan, rekam akurasi dan umur koordinat. Bila lokasi tidak tersedia, sediakan retry atau pengecualian beralasan sesuai kebijakan; jangan menyimpan koordinat palsu sebagai fallback. Geofence hanya masuk akal setelah koordinat client diverifikasi.
- Bila koneksi buruk, simpan draft lokal dengan indikator Belum tersinkron dan hapus setelah server mengonfirmasi. Offline penuh ditunda kecuali kebutuhan lapangan terbukti; data sensitif pada perangkat perlu dibatasi.
- Optimistic UI cocok untuk task/status berisiko rendah dengan rollback saat gagal. Pengiriman email, perubahan harga, dan finalisasi dokumen menunggu konfirmasi server.
- Awali dengan modular monolith: satu aplikasi, database relasional, object storage, dan worker/job persisten untuk integrasi. Microservices belum diperlukan tanpa bukti kebutuhan skala atau isolasi.
- Cache data privat harus dibatasi sesuai pengguna/otorisasi dan diinvalidasi setelah mutasi. Simpan waktu kejadian dalam UTC dan tampilkan sesuai zona pengguna; tanggal layanan tanpa jam tetap berupa date.
- Lindungi perubahan bersamaan melalui version check agar edit satu sales tidak diam-diam menimpa edit orang lain.
- Verifikasi terarah: akses lintas pengguna, perhitungan/pembulatan harga, pembatalan konfirmasi setelah revisi, event duplikat, timeout kirim, reconnect mailbox, dan pemulihan backup. Tes unit tetap di sebelah logikanya.

### Rujukan teknis audit

Rekomendasi di atas merupakan rancangan untuk kebutuhan proyek ini; rujukan berikut mendukung pola tertentu, bukan mewajibkan pemakaian produknya:

- [Microsoft: kualifikasi lead](https://learn.microsoft.com/en-us/dynamics365/sales/qualify-lead-convert-opportunity-sales) — pemisahan lead, account/contact, dan opportunity.
- [Google: sinkronisasi Gmail](https://developers.google.com/workspace/gmail/api/guides/sync) — full/partial sync dan penanganan history yang tidak lagi tersedia.
- [AWS: transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) — konsistensi penyimpanan data dan penerbitan event, serta kebutuhan konsumen idempotent.
- [OWASP: file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — validasi file, pembatasan ukuran, penyimpanan, dan akses.
