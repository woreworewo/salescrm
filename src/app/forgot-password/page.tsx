import { AccountShell } from "@/components/account-shell";
import { MutationForm } from "@/components/mutation-form";
import { requestPasswordReset } from "@/app/auth-actions";
import { isConfigured, isDemo } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default function ForgotPassword() {
  const disabled = !isConfigured() || isDemo();
  return (
    <AccountShell
      title="Pulihkan akses akun"
      description="Masukkan email akun Anda. Di lingkungan lokal, email pemulihan masuk ke kotak email uji."
    >
      {disabled && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          Supabase belum aktif atau aplikasi berada dalam mode demo. Email belum
          dapat dikirim.
        </p>
      )}
      <MutationForm
        action={requestPasswordReset}
        label="Minta tautan pemulihan"
        pendingLabel="Memproses…"
        disabled={disabled}
      >
        <label>
          Email akun
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </MutationForm>
    </AccountShell>
  );
}
