import Link from "next/link";
import { ArrowUpRight, LogOut, Sprout, Mail } from "lucide-react";
import { Navigation } from "./navigation";
import { signOut } from "@/app/actions";
import { ACCESS_ROLE_LABELS, type Workspace } from "@/lib/models";
import { PropertySwitcher } from "./property-switcher";
export function Shell({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <a
        className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        href="#main-content"
      >
        Lewati ke konten
      </a>
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <Link
          href="/"
          className="flex h-20 items-center gap-2.5 px-7 text-xl font-bold tracking-tight"
        >
          <span className="rounded-lg bg-emerald-900 p-1.5 text-white">
            <Sprout size={22} />
          </span>
          salesroom<span className="text-emerald-600">.</span>
        </Link>
        <div className="hidden px-7 pt-5 text-[10px] font-semibold tracking-[.18em] text-slate-400 lg:block">
          WORKSPACE
        </div>
        <Navigation
          tenantAdmin={workspace.accessRole === "tenant-admin"}
          propertyAdmin={workspace.accessRole !== "sales"}
        />
        <div className="mt-auto hidden px-5 pb-5 lg:block">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold">Satu langkah lebih dekat.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Mulai dari tindak lanjut yang paling penting hari ini.
            </p>
            <Link
              href="/tasks"
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-800"
            >
              Lihat follow-up <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:px-9">
          <PropertySwitcher
            key={workspace.property.id}
            options={workspace.propertyOptions}
            activeId={workspace.property.id}
          />
          <div className="flex items-center gap-3">
            <Link
              href="/invitations"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Undangan saya"
            >
              <Mail size={18} />
            </Link>
            <span className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">
              {workspace.profile.full_name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <p className="text-xs font-semibold">
                {workspace.profile.full_name}
              </p>
              <p className="mt-0.5 text-[11px] capitalize text-slate-400">
                {ACCESS_ROLE_LABELS[workspace.accessRole]}
              </p>
            </div>
            {!workspace.demo && (
              <form action={signOut}>
                <button
                  title="Keluar"
                  aria-label="Keluar"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                >
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
        </header>
        {workspace.demo && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900 lg:px-9">
            <strong>DEMO · HANYA BACA</strong> — seluruh client dan nilai
            merupakan data contoh. Perubahan data dinonaktifkan.
          </div>
        )}
        <main
          key={workspace.property.id}
          id="main-content"
          className="mx-auto max-w-[1600px] p-5 lg:p-9"
        >
          <p className="mb-5 text-xs text-slate-500">
            <strong>{workspace.tenant.name}</strong> / {workspace.property.name}{" "}
            · {workspace.property.timezone}
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-[28px]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
