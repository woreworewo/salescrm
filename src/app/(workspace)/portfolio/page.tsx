import { notFound } from "next/navigation";
import { PageHeading } from "@/components/shell";
import { getWorkspace } from "@/lib/workspace";
import { getPropertyContext } from "@/lib/access";
import { demoWorkspace } from "@/lib/demo";
import { money } from "@/lib/utils";

export default async function PortfolioPage() {
  const w = await getWorkspace();
  if (w.accessRole !== "tenant-admin") notFound();
  const properties = w.propertyOptions.filter(
    (p) => p.tenant_id === w.tenant.id,
  );
  let opportunities = w.opportunities;
  let tasks = w.tasks;
  if (w.demo) {
    const demos = properties.map((p) => demoWorkspace(p.id));
    opportunities = demos.flatMap((d) => d.opportunities);
    tasks = demos.flatMap((d) => d.tasks);
  } else {
    const { db } = await getPropertyContext();
    const results = await Promise.all([
      db
        .from("opportunities")
        .select("*", { count: "exact" })
        .eq("tenant_id", w.tenant.id),
      db
        .from("tasks")
        .select("*", { count: "exact" })
        .eq("tenant_id", w.tenant.id),
    ]);
    if (results.some((r) => r.error || r.count !== r.data?.length))
      throw new Error("Ringkasan property tidak dapat dimuat secara lengkap.");
    opportunities = results[0].data!;
    tasks = results[1].data!;
  }
  return (
    <>
      <PageHeading
        eyebrow="Tenant administration"
        title="Property overview"
        description={`Ringkasan lintas-property aktif untuk ${w.tenant.name}. Hanya Tenant Admin.`}
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Peluang aktif</th>
              <th>Estimasi pipeline (IDR)</th>
              <th>Task tertunda</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const open = opportunities.filter(
                (o) =>
                  o.property_id === p.id && !["won", "lost"].includes(o.stage),
              );
              return (
                <tr key={p.id}>
                  <td className="font-medium">
                    {p.name}
                    <p className="mt-1 text-xs text-slate-400">{p.code}</p>
                  </td>
                  <td>{open.length}</td>
                  <td className="whitespace-nowrap">
                    {money(
                      open.reduce(
                        (sum, o) => sum + Number(o.estimated_value),
                        0,
                      ),
                    )}
                  </td>
                  <td>
                    {
                      tasks.filter(
                        (t) => t.property_id === p.id && !t.completed,
                      ).length
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Client/PIC digunakan bersama dalam organisasi; jumlah client tidak
        dijumlahkan per property. Nilai pipeline merupakan estimasi, bukan
        pendapatan.
      </p>
    </>
  );
}
