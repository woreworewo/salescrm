import Link from "next/link";
export function AccountShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-800">
        Salesroom · Account
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 mb-7 text-sm leading-7 text-slate-500">
        {description}
      </p>
      {children}
      <Link
        href="/login"
        className="mt-7 text-sm font-medium text-emerald-800 underline"
      >
        Kembali ke login
      </Link>
    </main>
  );
}
