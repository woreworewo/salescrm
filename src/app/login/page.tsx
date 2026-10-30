import Link from "next/link";
import { redirect } from "next/navigation";
import { Sprout } from "lucide-react";
import { LoginForm } from "@/components/forms";
import { isConfigured, isDemo } from "@/lib/supabase/server";
export default function LoginPage() {
  if (isDemo()) redirect("/");
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-emerald-950 p-16 text-white lg:flex">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <Sprout />
          salesroom.
        </div>
        <div>
          <p className="text-xs tracking-[.2em] text-emerald-300">
            RELATIONSHIPS, MOVING FORWARD
          </p>
          <h1 className="mt-5 max-w-lg text-5xl leading-tight font-semibold tracking-tight">
            Setiap hubungan punya peluang berikutnya.
          </h1>
          <p className="mt-6 max-w-sm leading-7 text-emerald-100/70">
            Client, pipeline, dan tindak lanjut dalam satu workspace yang
            terarah.
          </p>
        </div>
        <p className="text-xs text-emerald-200/50">
          Sales CRM · Workspace perusahaan
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-800">
            Selamat datang kembali
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Masuk ke Salesroom
          </h2>
          <p className="mb-8 mt-3 text-sm text-slate-500">
            Lanjutkan dari prioritas terakhir Anda.
          </p>
          {isConfigured() ? (
            <LoginForm />
          ) : (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
            >
              Koneksi workspace belum dikonfigurasi.
              <Link
                className="mt-3 block font-semibold underline"
                href="/setup"
              >
                Lihat panduan setup
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
