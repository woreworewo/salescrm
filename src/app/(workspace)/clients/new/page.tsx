import { PageHeading } from "@/components/shell";
import { CompanyForm } from "@/components/forms";
import { getWorkspace } from "@/lib/workspace";
export default async function NewClient() {
  const w = await getWorkspace();
  return (
    <>
      <PageHeading
        eyebrow="Clients / New"
        title="Tambah client"
        description="Mulai dari perusahaan dan PIC utama. Kode client dibuat otomatis."
      />
      <CompanyForm demo={w.demo} />
    </>
  );
}
