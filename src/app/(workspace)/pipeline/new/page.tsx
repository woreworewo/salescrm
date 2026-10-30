import { OpportunityForm } from "@/components/forms";
import { EmptyState, PageHeading } from "@/components/shell";
import { getWorkspace } from "@/lib/workspace";
export default async function NewOpportunity() {
  const w = await getWorkspace();
  return (
    <>
      <PageHeading
        eyebrow="Pipeline / New"
        title="Peluang baru"
        description="Tentukan client, estimasi nilai, dan tindak lanjut pertama."
      />
      {w.companies.length ? (
        <OpportunityForm
          companies={w.companies}
          demo={w.demo}
          propertyId={w.property.id}
        />
      ) : (
        <EmptyState
          title="Tambahkan client terlebih dahulu"
          description="Setiap peluang harus terhubung ke perusahaan yang dapat Anda akses. Buka menu Clients untuk menambahkan perusahaan."
        />
      )}
    </>
  );
}
