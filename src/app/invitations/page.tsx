import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { MutationForm } from "@/components/mutation-form";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/app/auth-actions";
import { signOut } from "@/app/actions";
import { createClient, isConfigured, isDemo } from "@/lib/supabase/server";
import { ACCESS_ROLE_LABELS, type AccessRole } from "@/lib/models";
export const dynamic = "force-dynamic";
export default async function Invitations({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  if (!isConfigured() || isDemo())
    return (
      <AccountShell
        title="Undangan saya"
        description="Undangan memerlukan Supabase aktif dan akun yang terverifikasi."
      >
        <p className="rounded-lg bg-amber-50 p-4 text-amber-900">
          Demo tidak menerima undangan atau mengirim email.
        </p>
        <Link href="/" className="mt-5 underline">
          Buka workspace
        </Link>
      </AccountShell>
    );
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { password } = await searchParams;
  const [{ data, error }, { data: profile }] = await Promise.all([
    db.rpc("list_my_invitations"),
    db.from("profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);
  if (error) throw new Error("Undangan tidak dapat dimuat.");
  const invitations = (data ?? []) as {
    id: string;
    tenant_name: string;
    property_name: string;
    requested_role: AccessRole;
    expires_at: string;
  }[];
  return (
    <AccountShell
      title="Undangan saya"
      description={`Anda masuk sebagai ${user.email}. Periksa organisasi, property, dan role sebelum menerima akses.`}
    >
      {password === "updated" && (
        <p
          role="status"
          className="mb-5 rounded-lg bg-emerald-50 p-4 text-emerald-900"
        >
          Kata sandi berhasil diperbarui.
        </p>
      )}
      <div className="space-y-4">
        {invitations.map((invitation) => (
          <section
            key={invitation.id}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="font-semibold">
              {invitation.tenant_name} / {invitation.property_name}
            </h2>
            <p className="my-3 text-sm text-slate-500">
              Role: {ACCESS_ROLE_LABELS[invitation.requested_role]} · Berlaku
              sampai{" "}
              {new Date(invitation.expires_at).toLocaleDateString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}
            </p>
            <MutationForm action={acceptInvitation} label="Terima akses">
              <input type="hidden" name="invitation_id" value={invitation.id} />
            </MutationForm>
          </section>
        ))}
        {!invitations.length && (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Tidak ada undangan aktif untuk akun ini. Jika membutuhkan akses,
            hubungi admin.
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {profile && (
          <Button asChild>
            <Link href="/">Buka workspace</Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/set-password">Atur kata sandi</Link>
        </Button>
        <form action={signOut}>
          <Button variant="outline" type="submit">
            Keluar
          </Button>
        </form>
      </div>
    </AccountShell>
  );
}
