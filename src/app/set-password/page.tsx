import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { MutationForm } from "@/components/mutation-form";
import { setPassword } from "@/app/auth-actions";
import { createClient, isConfigured, isDemo } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function SetPassword() {
  if (!isConfigured() || isDemo()) redirect("/forgot-password");
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/forgot-password");
  return (
    <AccountShell
      title="Atur kata sandi Anda"
      description={`Akun: ${user.email}. Gunakan minimal 12 karakter. Anda dapat memakai frasa panjang yang mudah diingat.`}
    >
      <MutationForm action={setPassword} label="Simpan kata sandi">
        <label>
          Kata sandi baru
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label>
          Ulangi kata sandi
          <input
            type="password"
            name="confirmation"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
      </MutationForm>
    </AccountShell>
  );
}
