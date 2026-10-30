import { EmptyState, PageHeading } from "@/components/shell";
export default function ActivitiesPage() {
  return (
    <>
      <PageHeading
        eyebrow="Sales in the field"
        title="Sales activities"
        description="Aktivitas komunikasi dan kunjungan, terhubung ke setiap client."
      />
      <EmptyState
        title="Modul aktivitas belum diaktifkan"
        description="Tahap implementasi berikutnya mencakup WhatsApp, Direct Call, Visit/Meeting, Email, selfie terkompresi, serta GPS saat kunjungan. Belum ada aktivitas yang direkam melalui aplikasi ini."
      />
    </>
  );
}
