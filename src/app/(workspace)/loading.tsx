export default function Loading() {
  return (
    <div role="status" aria-label="Memuat workspace" className="animate-pulse">
      <div className="mb-8 h-20 w-2/3 rounded-xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-32 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="mt-7 h-96 rounded-xl bg-slate-200" />
      <span className="sr-only">Memuat data…</span>
    </div>
  );
}
