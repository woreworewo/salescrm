"use client";
import { useActionState } from "react";
import Link from "next/link";
import {
  createCompany,
  createOpportunity,
  createTask,
  signIn,
} from "@/app/actions";
import { INITIAL_STATE, type ActionState, type Company } from "@/lib/models";
import { Button } from "./ui/button";

export function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-lg border p-3 text-sm ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
    >
      {state.message}
    </p>
  );
}

function Field({
  name,
  label,
  required = false,
  type = "text",
  maxLength = 200,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      {required && " *"}
      <input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
      />
    </label>
  );
}

export function CompanyForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState(createCompany, INITIAL_STATE);
  return (
    <form action={action} className="max-w-4xl space-y-6">
      <Feedback state={state} />
      <fieldset
        disabled={demo || pending}
        className="space-y-6 disabled:opacity-60"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 font-semibold">Informasi perusahaan</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="name" label="Company name" required />
            <Field name="account_type" label="Account type" />
            <div className="sm:col-span-2">
              <Field name="address" label="Address" maxLength={1000} />
            </div>
            <Field name="city" label="City" />
            <Field name="phone" label="Tel no." type="tel" maxLength={40} />
            <Field name="fax" label="Fax no." maxLength={40} />
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-2 font-semibold">PIC utama</h2>
          <p className="mb-5 text-xs text-slate-500">
            Isi minimal satu email atau nomor telepon. Owner sales adalah
            pengguna yang membuat client.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="title" label="Title" />
            <Field name="first_name" label="First name" required />
            <Field name="last_name" label="Last name" />
            <Field name="position" label="Position" />
            <Field name="mobile" label="Mobile no." type="tel" maxLength={40} />
            <Field name="email" label="Email" type="email" />
          </div>
        </section>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={demo || pending || state.status === "success"}
        >
          {pending ? "Menyimpan…" : "Simpan client"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/clients">Kembali ke clients</Link>
        </Button>
      </div>
      {demo && (
        <p className="text-xs text-amber-800">
          Form dinonaktifkan dalam demo hanya-baca.
        </p>
      )}
    </form>
  );
}

export function OpportunityForm({
  companies,
  demo,
}: {
  companies: Company[];
  demo: boolean;
}) {
  const [state, action, pending] = useActionState(
    createOpportunity,
    INITIAL_STATE,
  );
  return (
    <form
      action={action}
      className="max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-6"
    >
      <Feedback state={state} />
      <fieldset
        disabled={demo || pending}
        className="grid gap-5 sm:grid-cols-2"
      >
        <label className="sm:col-span-2">
          Client *
          <select name="company_id" required defaultValue="">
            <option value="" disabled>
              Pilih client
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <Field name="name" label="Nama peluang" required />
        </div>
        <label>
          Jenis offering *
          <select name="offering_type">
            <option value="room">Kamar</option>
            <option value="meeting">Meeting</option>
            <option value="package">Paket</option>
          </select>
        </label>
        <label>
          Estimasi nilai (IDR) *
          <input
            name="estimated_value"
            type="number"
            step="0.01"
            min="0"
            max="999999999999.99"
            required
          />
        </label>
        <Field
          name="target_close"
          label="Target closing"
          type="date"
          required
        />
        <Field
          name="follow_up_date"
          label="Follow-up berikutnya"
          type="date"
          required
        />
        <div className="sm:col-span-2">
          <Field name="next_action" label="Next action" required />
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={demo || pending || state.status === "success"}
          type="submit"
        >
          {pending ? "Menyimpan…" : "Buat peluang"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/pipeline">Kembali ke pipeline</Link>
        </Button>
      </div>
      {demo && (
        <p className="text-xs text-amber-800">
          Demo hanya-baca. Pembuatan peluang dinonaktifkan.
        </p>
      )}
    </form>
  );
}

export function TaskForm({
  companies,
  demo,
}: {
  companies: Company[];
  demo: boolean;
}) {
  const [state, action, pending] = useActionState(createTask, INITIAL_STATE);
  return (
    <form
      action={action}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2 className="font-semibold">Task baru</h2>
      <Feedback state={state} />
      <fieldset disabled={demo || pending} className="space-y-4">
        <label>
          Client *
          <select name="company_id" defaultValue="" required>
            <option value="" disabled>
              Pilih client
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Field name="title" label="Tindak lanjut" required />
        <Field name="due_date" label="Tenggat" type="date" required />
      </fieldset>
      <Button disabled={demo || pending} type="submit">
        {pending ? "Menyimpan…" : "Tambah task"}
      </Button>
      {demo && <p className="text-xs text-amber-800">Demo hanya-baca.</p>}
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, INITIAL_STATE);
  return (
    <form action={action} className="space-y-5">
      <Feedback state={state} />
      <label>
        Email kerja
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Kata sandi
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
        />
      </label>
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Memeriksa akun…" : "Masuk ke workspace"}
      </Button>
      <p className="text-xs leading-5 text-slate-400">
        Akses melalui undangan admin. Untuk akun atau pemulihan kata sandi,
        hubungi admin perusahaan.
      </p>
    </form>
  );
}
