import "server-only";
import { randomUUID } from "node:crypto";
import { getWorkspace } from "./workspace";
import { getPropertyContext } from "./access";
import {
  activityFiltersSchema,
  initialActivityTime,
  localActivityTime,
} from "./activity-validation";
import type { CommunicationType, SalesActivity } from "./activity-models";

export async function activityFormData() {
  const workspace = await getWorkspace();
  return {
    workspace,
    requestId: randomUUID(),
    initialTime: initialActivityTime(workspace.property.timezone),
  };
}

function demoActivities(
  w: Awaited<ReturnType<typeof getWorkspace>>,
): SalesActivity[] {
  return ["whatsapp", "direct-call", "email"].map((type, index) => ({
    id: `00000000-0000-4000-8000-00000000030${index}`,
    tenant_id: w.tenant.id,
    property_id: w.property.id,
    company_id: w.companies[index].id,
    contact_id: w.contacts[index].id,
    opportunity_id: null,
    owner_id: w.profile.id,
    communication_type: type as CommunicationType,
    occurred_at: new Date().toISOString(),
    summary: [
      "Follow-up kebutuhan gathering",
      "Diskusi kebutuhan kamar",
      "Kirim rangkuman meeting",
    ][index],
    outcome: "Contoh hasil komunikasi; bukan aktivitas client sebenarnya.",
    notes: "Data demo sintetis.",
    next_action: index === 0 ? "Konfirmasi jumlah peserta" : null,
    follow_up_date: index === 0 ? "2026-11-02" : null,
    latitude: null,
    longitude: null,
    accuracy_m: null,
    gps_captured_at: null,
    photo_path: null,
    photo_sha256: null,
    status: "recorded",
    created_at: new Date().toISOString(),
    recorded_at: new Date().toISOString(),
  }));
}

export async function getActivityFeed(input: unknown, pageSize = 20) {
  const workspace = await getWorkspace();
  const parsed = activityFiltersSchema.safeParse(input);
  const filters = parsed.success
    ? parsed.data
    : activityFiltersSchema.parse({});
  const size = Math.min(50, Math.max(1, pageSize));
  if (!parsed.success)
    return {
      workspace,
      activities: [] as SalesActivity[],
      total: 0,
      filters,
      error: parsed.error.issues[0].message,
    };
  if (workspace.demo) {
    const records = demoActivities(workspace).filter(
      (a) =>
        (!filters.type || a.communication_type === filters.type) &&
        (!filters.company || a.company_id === filters.company) &&
        (!filters.owner || a.owner_id === filters.owner) &&
        a.summary.toLowerCase().includes(filters.q.toLowerCase()) &&
        (!filters.from ||
          a.occurred_at >=
            localActivityTime(
              `${filters.from}T00:00`,
              workspace.property.timezone,
            )) &&
        (!filters.until ||
          a.occurred_at <=
            localActivityTime(
              `${filters.until}T23:59:59.999`,
              workspace.property.timezone,
            )),
    );
    return {
      workspace,
      activities: records.slice((filters.page - 1) * size, filters.page * size),
      total: records.length,
      filters,
      error: null,
    };
  }
  const { db } = await getPropertyContext();
  let query = db
    .from("sales_activities")
    .select("*", { count: "exact" })
    .eq("tenant_id", workspace.tenant.id)
    .eq("property_id", workspace.property.id)
    .eq("status", "recorded");
  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.type) query = query.eq("communication_type", filters.type);
  if (filters.owner) query = query.eq("owner_id", filters.owner);
  if (filters.q)
    query = query.ilike("summary", `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (filters.from)
    query = query.gte(
      "occurred_at",
      localActivityTime(`${filters.from}T00:00`, workspace.property.timezone),
    );
  if (filters.until)
    query = query.lte(
      "occurred_at",
      localActivityTime(
        `${filters.until}T23:59:59.999`,
        workspace.property.timezone,
      ),
    );
  const result = await query
    .order("occurred_at", { ascending: false })
    .order("id")
    .range((filters.page - 1) * size, filters.page * size - 1);
  if (result.error)
    throw new Error(
      "Aktivitas tidak dapat dimuat. Periksa migrasi dan akses property.",
    );
  return {
    workspace,
    activities: result.data as SalesActivity[],
    total: result.count ?? 0,
    filters,
    error: null,
  };
}
