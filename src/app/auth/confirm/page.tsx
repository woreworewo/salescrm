import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { MutationForm } from "@/components/mutation-form";
import { verifyAuthLink } from "@/app/auth-actions";
import { authLinkSchema } from "@/lib/auth-validation";
import { isConfigured, isDemo } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Konfirmasi akun",
  robots: { index: false, follow: false },
};
export default async function ConfirmAccount({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const parsed = authLinkSchema.safeParse(await searchParams);
  const disabled = !parsed.success || !isConfigured() || isDemo();
  return (
    <AccountShell
      title="Konfirmasi akses akun"
      description="Tekan Lanjutkan untuk masuk ke akun pemilik tautan ini. Tautan tidak digunakan sampai Anda melanjutkan; sesi akun sebelumnya dapat terganti."
    >
      {!parsed.success && (
        <p role="alert" className="mb-4 rounded bg-rose-50 p-4 text-rose-800">
          Tautan tidak valid atau tidak lengkap. Minta email baru dari admin
          atau halaman pemulihan.
        </p>
      )}
      {!isConfigured() && (
        <p role="status" className="mb-4 text-amber-900">
          Layanan akun belum dikonfigurasi.
        </p>
      )}
      <MutationForm
        action={verifyAuthLink}
        label="Lanjutkan"
        pendingLabel="Memverifikasi…"
        disabled={disabled}
      >
        <input
          type="hidden"
          name="token_hash"
          value={parsed.success ? parsed.data.token_hash : ""}
        />
        <input
          type="hidden"
          name="type"
          value={parsed.success ? parsed.data.type : ""}
        />
      </MutationForm>
    </AccountShell>
  );
}
