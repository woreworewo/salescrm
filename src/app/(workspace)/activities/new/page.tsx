import { ActivityForm } from "@/components/activity-form";
import { EmptyState, PageHeading } from "@/components/shell";
import { activityFormData } from "@/lib/activities";
export default async function NewActivity({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { workspace, requestId, initialTime } = await activityFormData();
  const { company } = await searchParams;
  const initialCompany = workspace.companies.some((c) => c.id === company)
    ? company
    : "";
  return (
    <>
      <PageHeading
        eyebrow="Activities / New"
        title="Catat aktivitas sales"
        description="Hubungkan hasil komunikasi ke client, lalu tentukan tindak lanjut yang jelas."
      />
      {workspace.companies.length ? (
        <ActivityForm
          key={requestId}
          workspace={workspace}
          requestId={requestId}
          initialTime={initialTime}
          initialCompany={initialCompany}
        />
      ) : (
        <EmptyState
          title="Tambahkan client terlebih dahulu"
          description="Setiap aktivitas harus terhubung ke perusahaan dalam organisasi aktif."
        />
      )}
    </>
  );
}
