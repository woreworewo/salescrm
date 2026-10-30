import { redirect } from "next/navigation";
import { PropertySwitcher } from "@/components/property-switcher";
import { getAccess } from "@/lib/access";
import { isDemo } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export default async function AccessPage() {
  if (isDemo()) redirect("/");
  const { propertyOptions } = await getAccess();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">
        Pilih workspace yang dapat diakses
      </h1>
      <p className="leading-7 text-slate-500">
        Property sebelumnya tidak tersedia atau belum dipilih. Hak akses
        diperiksa kembali pada setiap permintaan.
      </p>
      {propertyOptions.length ? (
        <PropertySwitcher options={propertyOptions} />
      ) : (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
        >
          Belum ada akses property aktif. Hubungi admin untuk aktivasi
          membership organisasi dan property.
        </p>
      )}
      <form action={signOut}>
        <Button variant="outline" type="submit">
          Keluar
        </Button>
      </form>
    </main>
  );
}
