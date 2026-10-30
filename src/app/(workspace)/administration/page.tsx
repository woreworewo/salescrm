import { PageHeading } from "@/components/shell";
import { MutationForm } from "@/components/mutation-form";
import { getAdministration } from "@/lib/administration";
import { invitationMailConfigured } from "@/lib/invitation-mail";
import { ACCESS_ROLE_LABELS } from "@/lib/models";
import {
  renameTenant,
  saveProperty,
  setTenantMembership,
  setPropertyMembership,
  requestInvitation,
  revokeInvitation,
  sendInvitation,
  assignSalesRecord,
} from "@/app/admin-actions";

const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];
const EVENT_LABELS: Record<string, string> = {
  "tenant-renamed": "Nama organisasi diperbarui",
  "property-saved": "Property disimpan",
  "tenant-membership-updated": "Akses organisasi diperbarui",
  "property-membership-updated": "Akses property diperbarui",
  "sales-owner-assigned": "Penanggung jawab diubah",
  "invitation-created": "Undangan dibuat",
  "invitation-revoked": "Undangan dicabut",
  "invitation-accepted": "Undangan diterima",
  "invitation-delivery-recorded": "Hasil pengiriman dicatat",
};
const DELIVERY_LABELS: Record<string, string> = {
  "not-sent": "Belum dikirim",
  processing: "Diproses",
  "provider-accepted": "Diterima server email",
  failed: "Gagal sebelum pengiriman",
  unknown: "Hasil belum diketahui",
};
function StatusSelect({ active = true }: { active?: boolean }) {
  return (
    <label>
      Status
      <select name="active" defaultValue={String(active)}>
        <option value="true">Aktif</option>
        <option value="false">Nonaktif</option>
      </select>
    </label>
  );
}
export default async function AdministrationPage() {
  const a = await getAdministration();
  const w = a.workspace;
  const tenantAdmin = w.accessRole === "tenant-admin";
  const senderReady = invitationMailConfigured() && !w.demo;
  const context = (
    <input type="hidden" name="context_property_id" value={w.property.id} />
  );
  const person = (id: string) =>
    a.profiles.find((p) => p.id === id)?.full_name ??
    `Pengguna ${id.slice(0, 8)}`;
  const eligibleMembers = a.tenantMembers.filter(
    (m) =>
      m.active &&
      (tenantAdmin ||
        (m.role !== "tenant-admin" &&
          !a.propertyMembers.some(
            (p) => p.user_id === m.user_id && p.role === "property-admin",
          ))),
  );
  const owners = a.tenantMembers.filter(
    (m) =>
      m.active &&
      (m.role === "tenant-admin" ||
        a.propertyMembers.some((p) => p.user_id === m.user_id && p.active)),
  );
  return (
    <>
      <PageHeading
        eyebrow="Access & ownership"
        title="Administration"
        description="Kelola organisasi, akses pengguna, dan penanggung jawab sesuai kewenangan Anda."
      />
      {w.demo && (
        <p className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Preview administrasi hanya-baca. Hubungkan Supabase lokal untuk
          menguji penyimpanan, akun dan email uji.
        </p>
      )}
      {tenantAdmin && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 font-semibold">Organisasi aktif</h2>
          <MutationForm
            action={renameTenant}
            revision={a.tenantVersion}
            label="Simpan nama organisasi"
            disabled={w.demo}
            className="max-w-xl"
          >
            {context}
            <input type="hidden" name="version" value={a.tenantVersion} />
            <label>
              Nama organisasi
              <input
                name="name"
                required
                minLength={2}
                maxLength={200}
                defaultValue={w.tenant.name}
              />
            </label>
          </MutationForm>
        </section>
      )}
      {tenantAdmin && (
        <section className="mb-6 space-y-5">
          <h2 className="text-lg font-semibold">Property dalam organisasi</h2>
          <div className="grid gap-5 xl:grid-cols-2">
            {a.properties.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-6"
              >
                <h3 className="mb-4 font-semibold">{p.name}</h3>
                <MutationForm
                  action={saveProperty}
                  revision={p.version}
                  label="Simpan property"
                  disabled={w.demo}
                >
                  {context}
                  <input type="hidden" name="target_property_id" value={p.id} />
                  <input type="hidden" name="version" value={p.version} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      Nama property
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={200}
                        defaultValue={p.name}
                      />
                    </label>
                    <label>
                      Kode
                      <input
                        name="code"
                        required
                        pattern="[A-Za-z0-9_-]+"
                        maxLength={40}
                        defaultValue={p.code}
                      />
                    </label>
                    <label>
                      Timezone
                      <select name="timezone" defaultValue={p.timezone}>
                        {TIMEZONES.map((zone) => (
                          <option key={zone}>{zone}</option>
                        ))}
                      </select>
                    </label>
                    <StatusSelect active={p.active} />
                  </div>
                </MutationForm>
              </article>
            ))}
            <article className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
              <h3 className="mb-4 font-semibold">Tambah property</h3>
              <MutationForm
                action={saveProperty}
                label="Buat property"
                disabled={w.demo}
              >
                {context}
                <input type="hidden" name="target_property_id" value="" />
                <input type="hidden" name="version" value="0" />
                <input type="hidden" name="active" value="true" />
                <label>
                  Nama property
                  <input name="name" required minLength={2} maxLength={200} />
                </label>
                <label>
                  Kode unik dalam organisasi
                  <input
                    name="code"
                    required
                    pattern="[A-Za-z0-9_-]+"
                    maxLength={40}
                  />
                </label>
                <label>
                  Timezone
                  <select name="timezone">
                    {TIMEZONES.map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                  </select>
                </label>
              </MutationForm>
            </article>
          </div>
          <p className="text-xs text-slate-500">
            Property aktif terakhir tidak dapat dinonaktifkan. Pembuatan
            organisasi baru dilakukan melalui bootstrap admin, bukan hak global
            pada aplikasi.
          </p>
        </section>
      )}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-semibold">
          Undang pengguna ke {w.property.name}
        </h2>
        <p className="mb-5 text-sm leading-6 text-slate-500">
          Undangan tidak langsung memberikan akses. Penerima harus memverifikasi
          email dan menerima rincian membership.
        </p>
        <MutationForm
          action={requestInvitation}
          label="Simpan undangan"
          disabled={w.demo}
          className="max-w-xl"
        >
          {context}
          <label>
            Nama lengkap
            <input name="full_name" required maxLength={200} />
          </label>
          <label>
            Email penerima
            <input name="email" type="email" required maxLength={254} />
          </label>
          <label>
            Role
            <select name="role">
              <option value="sales">Sales pada property ini</option>
              {tenantAdmin && (
                <>
                  <option value="property-admin">
                    Property Admin pada property ini
                  </option>
                  <option value="tenant-admin">
                    Tenant Admin — seluruh organisasi
                  </option>
                </>
              )}
            </select>
          </label>
        </MutationForm>
      </section>
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Undangan property · 50 terbaru</h2>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          {senderReady
            ? "Pengiriman email aktivasi tersedia; status layanan tetap diperiksa saat mengirim."
            : "Email belum aktif. Konfigurasikan Supabase dan SMTP lokal untuk mengirim ke kotak email uji."}{" "}
          Hasil pengiriman tidak diketahui harus diperiksa sebelum mengulang;
          jeda kirim ulang minimal 2 menit.
        </p>
        <div className="mt-4 divide-y divide-slate-100">
          {a.invitations.map((invite) => {
            const pending =
              !invite.accepted_at &&
              !invite.revoked_at &&
              new Date(invite.expires_at).getTime() > a.snapshotTime;
            return (
              <article key={invite.id} className="py-5">
                <h3 className="font-medium">
                  {invite.full_name} · {invite.email}
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  {ACCESS_ROLE_LABELS[invite.requested_role]} ·{" "}
                  {invite.accepted_at
                    ? "Diterima"
                    : invite.revoked_at
                      ? "Dicabut"
                      : pending
                        ? "Menunggu penerima"
                        : "Kedaluwarsa"}{" "}
                  · Pengiriman:{" "}
                  {DELIVERY_LABELS[invite.delivery_status] ?? "Belum diketahui"}
                </p>
                {pending && (
                  <div className="mt-4 flex flex-wrap gap-5">
                    <MutationForm
                      action={sendInvitation}
                      label="Kirim email aktivasi"
                      pendingLabel="Mengirim…"
                      disabled={!senderReady}
                    >
                      {context}
                      <input
                        type="hidden"
                        name="invitation_id"
                        value={invite.id}
                      />
                    </MutationForm>
                    <MutationForm
                      action={revokeInvitation}
                      label="Cabut undangan"
                      disabled={w.demo}
                    >
                      {context}
                      <input
                        type="hidden"
                        name="invitation_id"
                        value={invite.id}
                      />
                    </MutationForm>
                  </div>
                )}
              </article>
            );
          })}
          {!a.invitations.length && (
            <p className="py-6 text-sm text-slate-400">
              Belum ada undangan pada property ini.
            </p>
          )}
        </div>
      </section>
      {tenantAdmin && (
        <section className="mb-6 space-y-4">
          <h2 className="text-lg font-semibold">Membership organisasi</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {a.tenantMembers.map((m) => (
              <article
                key={m.user_id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <h3 className="mb-4 font-semibold">{person(m.user_id)}</h3>
                <MutationForm
                  action={setTenantMembership}
                  revision={m.version}
                  label="Simpan akses organisasi"
                  disabled={w.demo}
                >
                  {context}
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <input type="hidden" name="version" value={m.version} />
                  <label>
                    Role organisasi
                    <select name="role" defaultValue={m.role}>
                      <option value="member">Member</option>
                      <option value="tenant-admin">Tenant Admin</option>
                    </select>
                  </label>
                  <StatusSelect active={m.active} />
                </MutationForm>
              </article>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Admin aktif terakhir dilindungi di database. Perubahan akses berlaku
            pada permintaan berikutnya.
          </p>
        </section>
      )}
      <section className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold">
          Membership · {w.property.name}
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {a.propertyMembers.map((m) => (
            <article
              key={m.user_id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <h3 className="mb-4 font-semibold">{person(m.user_id)}</h3>
              <MutationForm
                action={setPropertyMembership}
                revision={m.version}
                label="Simpan akses property"
                disabled={
                  w.demo ||
                  (!tenantAdmin &&
                    (m.role !== "sales" ||
                      a.tenantMembers.some(
                        (t) =>
                          t.user_id === m.user_id && t.role === "tenant-admin",
                      )))
                }
              >
                {context}
                <input type="hidden" name="user_id" value={m.user_id} />
                <input type="hidden" name="version" value={m.version} />
                <label>
                  Role property
                  <select name="role" defaultValue={m.role}>
                    <option value="sales">Sales</option>
                    {(tenantAdmin || m.role === "property-admin") && (
                      <option value="property-admin">Property Admin</option>
                    )}
                  </select>
                </label>
                <StatusSelect active={m.active} />
              </MutationForm>
            </article>
          ))}
          <article className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
            <h3 className="mb-4 font-semibold">
              Tambahkan anggota organisasi ke property
            </h3>
            <MutationForm
              action={setPropertyMembership}
              label="Tambah akses property"
              disabled={
                w.demo ||
                !eligibleMembers.some(
                  (m) =>
                    !a.propertyMembers.some((p) => p.user_id === m.user_id),
                )
              }
            >
              {context}
              <input type="hidden" name="version" value="0" />
              <input type="hidden" name="active" value="true" />
              <label>
                Anggota
                <select name="user_id" required defaultValue="">
                  <option value="" disabled>
                    Pilih anggota
                  </option>
                  {eligibleMembers
                    .filter(
                      (m) =>
                        !a.propertyMembers.some((p) => p.user_id === m.user_id),
                    )
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {person(m.user_id)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Role property
                <select name="role">
                  <option value="sales">Sales</option>
                  {tenantAdmin && (
                    <option value="property-admin">Property Admin</option>
                  )}
                </select>
              </label>
            </MutationForm>
          </article>
        </div>
      </section>
      <section className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold">
          Assignment sales · {w.property.name}
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          {[
            ...w.opportunities.map((o) => ({
              ...o,
              label: o.name,
              type: "opportunity",
            })),
            ...w.tasks.map((t) => ({ ...t, label: t.title, type: "task" })),
          ].map((record) => (
            <article
              key={record.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <h3 className="mb-3 font-medium">{record.label}</h3>
              <MutationForm
                action={assignSalesRecord}
                revision={record.version}
                label="Simpan penanggung jawab"
                disabled={w.demo}
              >
                {context}
                <input type="hidden" name="record_id" value={record.id} />
                <input type="hidden" name="record_type" value={record.type} />
                <input type="hidden" name="version" value={record.version} />
                <label>
                  Sales account
                  <select name="owner_id" defaultValue={record.owner_id}>
                    {owners.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {person(m.user_id)}
                      </option>
                    ))}
                  </select>
                </label>
              </MutationForm>
            </article>
          ))}
        </div>
        {!w.opportunities.length && !w.tasks.length && (
          <p className="text-sm text-slate-400">
            Belum ada peluang/task untuk di-assign.
          </p>
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">
          Audit {tenantAdmin ? "organisasi" : "property"} · 20 terbaru
        </h2>
        <ul className="space-y-3">
          {a.events.map((event) => (
            <li key={event.id} className="text-xs text-slate-500">
              <strong>{EVENT_LABELS[event.action] ?? event.action}</strong> ·{" "}
              {person(event.actor_id)} ·{" "}
              {new Date(event.created_at).toLocaleString("id-ID", {
                timeZone: w.property.timezone,
              })}
              <p className="mt-1">
                {a.profiles.find((p) => p.id === event.subject_id)?.full_name ??
                  a.properties.find((p) => p.id === event.subject_id)?.name ??
                  a.invitations.find((i) => i.id === event.subject_id)?.email ??
                  `Objek ${event.subject_id.slice(0, 8)}`}
                {typeof event.details.role === "string" &&
                  ` · Role ${event.details.role}`}
                {typeof event.details.active === "boolean" &&
                  (event.details.active ? " · Aktif" : " · Nonaktif")}
                {typeof event.details.previous_owner === "string" &&
                  typeof event.details.owner === "string" &&
                  ` · ${person(event.details.previous_owner)} → ${person(event.details.owner)}`}
              </p>
            </li>
          ))}
        </ul>
        {!a.events.length && (
          <p className="text-sm text-slate-400">
            Belum ada perubahan administrasi pada property ini.
          </p>
        )}
      </section>
    </>
  );
}
