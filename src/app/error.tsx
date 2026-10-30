"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto my-16 max-w-lg rounded-xl border border-rose-200 bg-white p-8"
    >
      <h1 className="text-xl font-semibold">Workspace belum dapat dimuat</h1>
      <p className="my-4 leading-6 text-slate-500">
        Periksa koneksi, migrasi database, dan aktivasi profil dengan admin.
        Data contoh tidak digunakan untuk menggantikan data yang gagal dimuat.
      </p>
      <Button onClick={reset}>Coba lagi</Button>
    </div>
  );
}
