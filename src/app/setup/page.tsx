import Link from "next/link";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <Sprout className="mb-6 text-emerald-800" size={36} />
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
        Salesroom · Setup
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Hubungkan workspace Anda.
      </h1>
      <p className="mt-4 leading-7 text-slate-500">
        Aplikasi siap dikonfigurasi. Belum ada koneksi database, sehingga data
        client dan aktivitas belum dapat disimpan.
      </p>
      <ol className="my-8 list-decimal space-y-4 pl-5 text-sm leading-6 text-slate-600">
        <li>
          Buat project Supabase dan jalankan migrasi yang tersedia di
          repository.
        </li>
        <li>Isi URL dan publishable key pada environment aplikasi.</li>
        <li>
          Undang pengguna, aktifkan profil admin/sales, dan nonaktifkan public
          signup.
        </li>
        <li>
          Restart aplikasi, lalu masuk menggunakan akun yang sudah diaktifkan.
        </li>
      </ol>
      <p className="mb-6 rounded-lg bg-white p-4 text-xs leading-6 text-slate-500">
        Petunjuk teknis ada di README repository. Preview contoh tersedia
        melalui konfigurasi demo eksplisit dan hanya-baca; tidak menggantikan
        database production.
      </p>
      <Button asChild variant="outline">
        <Link href="/login">Buka halaman login</Link>
      </Button>
    </main>
  );
}
