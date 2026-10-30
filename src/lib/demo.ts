import type { Workspace } from "./models";
import { today } from "./utils";

export function demoWorkspace(propertyId?: string): Workspace {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    full_name: "Alya Pratama",
  };
  const tenant = {
    id: "00000000-0000-4000-8000-000000000100",
    name: "Demo Hotel Group",
  };
  const propertyOptions: Workspace["propertyOptions"] = [
    {
      id: "00000000-0000-4000-8000-000000000101",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      name: "Hotel Jakarta",
      code: "JKT",
      timezone: "Asia/Jakarta",
      currency: "IDR",
      access_role: "tenant-admin",
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      name: "Hotel Bali",
      code: "BALI",
      timezone: "Asia/Makassar",
      currency: "IDR",
      access_role: "tenant-admin",
    },
  ];
  const property =
    propertyOptions.find((p) => p.id === propertyId) ?? propertyOptions[0];
  const names = [
    "Nusantara Creative",
    "Atlas Teknologi",
    "Bumi Sentosa",
    "Sagara Travel",
    "Aruna Consulting",
    "Kencana Group",
  ];
  const companies = names.map((name, i) => ({
    id: `00000000-0000-4000-8000-00000000001${i}`,
    tenant_id: tenant.id,
    code: `CL-${String(i + 1).padStart(4, "0")}`,
    name,
    address: "Alamat contoh, bukan client sebenarnya",
    city: ["Jakarta", "Bandung", "Surabaya"][i % 3],
    phone: "",
    fax: "",
    account_type: i % 2 ? "Corporate" : "Travel",
    owner_id: user.id,
    created_at: new Date().toISOString(),
  }));
  return {
    demo: true,
    profile: user,
    tenant,
    property,
    accessRole: property.access_role,
    propertyOptions,
    profiles: [user],
    companies,
    contacts: companies.map((c, i) => ({
      id: `contact-${i}`,
      tenant_id: tenant.id,
      company_id: c.id,
      title: "",
      first_name: ["Rani", "Bima", "Dewi", "Aditya", "Nadia", "Dimas"][i],
      last_name: "",
      position: "PIC",
      mobile: "",
      email: `pic${i + 1}@example.com`,
    })),
    opportunities: companies
      .slice(0, 5)
      .map((c, i) => ({
        id: `00000000-0000-4000-8000-00000000002${i}`,
        tenant_id: tenant.id,
        property_id: propertyOptions[i % 2].id,
        company_id: c.id,
        owner_id: user.id,
        name: [
          "Annual company gathering",
          "Leadership meeting",
          "Corporate room agreement",
          "Group stay November",
          "Executive workshop",
        ][i],
        offering_type: (["package", "meeting", "room"] as const)[i % 3],
        estimated_value: [48000000, 18500000, 72000000, 35000000, 24000000][i],
        stage: (["discovery", "proposal-sent", "negotiation"] as const)[i % 3],
        target_close: today(property.timezone),
        next_action: [
          "Konfirmasi jumlah peserta",
          "Follow-up penawaran",
          "Review kebutuhan kamar",
        ][i % 3],
        follow_up_date: i === 0 ? "2026-01-01" : today(property.timezone),
        stage_entered_at: new Date().toISOString(),
        version: 1,
        lost_reason: null,
      }))
      .filter((o) => o.property_id === property.id),
    tasks: companies
      .slice(0, 3)
      .map((c, i) => ({
        id: `task-${i}`,
        tenant_id: tenant.id,
        property_id: propertyOptions[i % 2].id,
        company_id: c.id,
        owner_id: user.id,
        title: [
          "Konfirmasi kebutuhan gathering",
          "Follow-up penawaran meeting",
          "Jadwalkan kunjungan client",
        ][i],
        due_date: today(property.timezone),
        completed: false,
        version: 1,
      }))
      .filter((t) => t.property_id === property.id),
  };
}
