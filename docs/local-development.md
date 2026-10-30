# Menjalankan Salesroom secara lokal

Status saat perubahan ini dibuat: Docker belum tersedia pada komputer pengembangan. Kode, migrasi dan helper disiapkan; Supabase Auth/SMTP lokal belum dijalankan atau diverifikasi end-to-end. Tidak ada staging/cloud yang dibuat.

## 1. Persiapan satu kali

- Node.js 24 dan npm.
- Docker Desktop dengan Linux containers, aktif dan dapat diakses melalui `docker version`. Instalasi Docker/komponen virtualisasi Windows dilakukan pengguna; helper tidak memasang atau mengubah pengaturan sistem.
- Port aplikasi 3000; Supabase API 54321; PostgreSQL 54322; Studio 54323; email uji 54324; SMTP uji 54325.

Rujukan: [Supabase CLI lokal](https://supabase.com/docs/guides/local-development/cli/getting-started), [Docker Desktop Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

## 2. Mulai database dan akun lokal

```powershell
npm ci
npm run local:setup
npm run local:seed
npm run dev
```

`local:setup` memeriksa Docker, menjalankan Supabase lokal, menerapkan migrasi yang belum dijalankan, lalu membuat `.env.local` yang diabaikan Git. Nilai key/password tidak dicetak. File yang sudah ada tidak ditimpa. Helper tidak melakukan `db reset` atau menyentuh project cloud. Download image pertama dapat memerlukan beberapa menit; bila gagal, periksa hasil CLI secara lokal.

Jika `.env.local` sudah ada, pertahankan salinannya di tempat aman dan konfigurasikan manual: `npx supabase start`, `npx supabase migration up --local`, lalu ambil nilai dari `npx supabase status` pada komputer sendiri. Isi field `.env.example` dengan API/key lokal; tambahkan `CRM_LOCAL_ONLY=true`, `CRM_LOCAL_DATABASE_URL` dari status CLI, serta password awal minimal 12 karakter pada `CRM_LOCAL_TEST_PASSWORD`. Jangan menempelkan output key/password ke chat atau commit. Helper akan menolak target API/database yang bukan `127.0.0.1:54321` / `127.0.0.1:54322`.

`local:seed` membuat fixture melalui Auth admin API dan PostgreSQL lokal: dua tenant, tiga property, lima akun, directory client contoh dan peluang per property. Ini data fiktif untuk pengujian, bukan data production. Pembuatan Auth user dan transaksi database merupakan dua langkah; rerun dapat memperbaiki seed yang terputus. Seed idempotent tidak menghapus data, mereset password akun yang sudah ada, atau menimpa role/status yang sudah diedit.

## 3. Login dan email uji

Buka [aplikasi lokal](http://127.0.0.1:3000).

| Akun                               | Akses awal                                                   |
| ---------------------------------- | ------------------------------------------------------------ |
| tenant.admin@local.salescrm.test   | Tenant Admin Local Nusantara Group; Jakarta dan Bali         |
| property.admin@local.salescrm.test | Property Admin Jakarta                                       |
| sales.jakarta@local.salescrm.test  | Sales Jakarta                                                |
| sales.bali@local.salescrm.test     | Sales Bali                                                   |
| other.admin@local.salescrm.test    | Tenant Admin Local Meridian Group; terisolasi dari Nusantara |

Password awal tersimpan pada `CRM_LOCAL_TEST_PASSWORD` dalam `.env.local`. Baca file itu pada komputer sendiri. Jangan gunakan password fixture untuk akun sungguhan.

- [Supabase Studio lokal](http://127.0.0.1:54323).
- [Kotak email uji lokal](http://127.0.0.1:54324): email aktivasi/reset ditangkap Mailpit, bukan dikirim ke internet.
- `npm run local:mail` menampilkan alamat kotak email tanpa membuka aplikasi lain.

Gunakan jendela/profil browser terpisah untuk menguji pengguna berbeda. Cookie property dibagikan antar-tab dalam sesi browser yang sama; form lama ditolak bila tab lain berpindah property.

## 4. Uji alur administrasi

1. Masuk sebagai Tenant Admin. Buka Administration, ubah nama organisasi, tambah property dan atur timezone. Nonaktifkan/aktifkan property; property aktif terakhir dilindungi.
2. Buat undangan ke email fiktif baru, misalnya `new.sales@local.salescrm.test`, dengan role Sales pada property aktif. Menyimpan undangan belum mengirim email.
3. Klik Kirim email aktivasi, lalu periksa Mailpit. Status diterima server email belum berarti dibaca penerima. Jika hasil tidak diketahui, periksa mailbox sebelum retry; jeda retry minimal dua menit.
4. Buka tautan email di sesi browser baru. Halaman konfirmasi meminta klik Lanjutkan sebelum menggunakan token. Verifikasi nama tenant/property/role lalu Terima akses. Atur password melalui halaman akun bila ingin login berikutnya memakai password.
5. Undangan terikat email terverifikasi dan hanya dapat diterima sekali, maksimal tujuh hari; tautan Auth memiliki masa berlaku lebih pendek. Cabut undangan atau cabut role pengundang, lalu pastikan penerimaan ditolak. Mengirim tautan akun tidak otomatis memberi akses tenant.
6. Uji Lupa kata sandi dari login, buka email uji, konfirmasi dan simpan password baru. Pengaturan password memerlukan sesi autentikasi yang valid/recent sesuai Auth policy. Jangan menggunakan token/password asli dalam screenshot/log.
7. Property Admin hanya dapat mengundang/mengelola Sales pada property-nya. Ia tidak dapat memberi role admin, mengubah admin lain, membuat property, atau memulihkan membership tenant yang dicabut.
8. Assign peluang/task ke Sales yang memiliki membership property aktif. Pastikan owner lama kehilangan akses transaksinya dan target lintas-property/tenant ditolak.
9. Uji Tenant Admin terakhir tidak dapat didemote/dinonaktifkan. Gunakan pengguna tenant kedua untuk memeriksa isolasi directory, transaksi, undangan dan audit.

## 5. Batas implementasi

- Tenant Admin mengelola organisasi miliknya dan membuat/mengubah property. Organisasi baru tidak dapat dibuat bebas dari aplikasi; tenant awal melalui seed/bootstrap admin tepercaya.
- Tidak ada public signup. Undangan dibuat di database oleh admin berwenang; server membuat link akun melalui Supabase Admin API dan mengirimnya lewat SMTP yang dikonfigurasi. Service-role key hanya dipakai server untuk link Auth, bukan untuk melewati otorisasi bisnis.
- Role/membership/assignment diperbarui melalui RPC dengan pemeriksaan scope, versi, guard admin terakhir dan audit. Tidak ada grant UPDATE tabel membership kepada browser.
- Pengiriman aktivasi saat ini sinkron dengan delivery claim, cooldown dan status hasil; belum memakai worker antrean/outbox. Durable job tetap diperlukan untuk pengiriman dokumen/CRM dan rollout produksi. Token tidak disimpan pada tabel undangan maupun dikembalikan ke UI admin.
- Auth link menggunakan origin tetap `CRM_APP_URL`; flow hanya magiclink/recovery dan tidak menerima tujuan redirect bebas. Log argumen Server Functions serta request konfirmasi dimatikan di development untuk menghindari token/password tercetak. Terapkan redaksi URL token pada proxy/hosting sebelum cloud rollout.
- Tes PostgreSQL/RLS memakai PGlite dan mock skema Auth/Storage; bukan pengganti pengujian Supabase Auth/Storage/SMTP setelah Docker tersedia. Build/UI demo dapat diverifikasi tanpa Docker; penyimpanan bisnis tetap dinonaktifkan pada demo.
- Sales Activities sudah diimplementasikan; kamera/lokasi dan unggah Storage belum diuji end-to-end. Dokumen, email greeting/follow-up, inbox dan live chat belum diaktifkan. Tidak ada deployment cloud dalam tahap lokal ini.

### Uji Sales Activities setelah backend lokal tersedia

Storage lokal kini diaktifkan. Untuk instalasi lokal yang sudah berjalan, hentikan dengan `npm run local:stop`, jalankan `npx supabase start`, lalu terapkan migrasi tambahan dengan `npx supabase migration up --local`; jangan reset database. Gunakan konfigurasi lokal yang dibuat helper.

1. Buka Activities → Catat aktivitas, pilih client/PIC/peluang yang sesuai. WhatsApp/Direct Call/Email dapat dicatat tanpa selfie/GPS; aktivitas tidak mengubah pipeline.
2. Sales Visit/Meeting wajib selfie dan lokasi. Izinkan kamera/lokasi hanya saat diminta. Gunakan localhost atau HTTPS; origin HTTP dari alamat LAN bukan secure context untuk Geolocation. Foto sumber JPEG/PNG/WebP maksimal 10 MB/24 MP dikompresi menjadi JPEG ≤200 KB; server memvalidasi isi, mengompresi ulang dan menghapus EXIF. Tidak ada pelacakan lokasi berkala atau jaminan liveness/anti-pemalsuan.
3. Uji penolakan izin, GPS >10 menit, foto tidak valid, dan kegagalan unggah: tidak boleh muncul aktivitas tercatat atau task follow-up. Koreksi form yang berubah menggunakan request baru; retry identik tetap idempotent. Peringatan akurasi rendah tidak membuat lokasi palsu.
4. Tambahkan tindak lanjut dan simpan; periksa satu aktivitas dan satu task. Ulangi request identik; pastikan tidak ada duplikasi. Uji filter/paginasi dan timeline client.
5. Periksa foto hanya dapat dibaca penulis atau admin berwenang pada property terkait, tidak oleh sales lain, tenant lain, atau anggota yang dicabut aksesnya. Foto tercatat tidak dapat ditimpa/dihapus melalui role aplikasi. Route foto memeriksa sesi/property dan tidak menggunakan URL publik.

Draft yang belum selesai disembunyikan dari feed/admin. Unggah/finalisasi draft dibatasi satu jam dan finalisasi memeriksa ulang usia GPS. Draft/file yatim belum dihapus otomatis; retensi dan pekerjaan cleanup wajib ditentukan sebelum produksi. Lokasi/foto adalah bukti yang dikirim perangkat, bukan verifikasi anti-fraud.

## 6. Pemeriksaan dan berhenti

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run local:stop
```

Hentikan dev server dengan Ctrl+C. `local:stop` menghentikan layanan lokal tanpa opsi penghapusan data. Reset database bukan bagian helper rutin.
