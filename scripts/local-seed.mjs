import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { assertLocalService } from "./local-config.mjs";

try {
  process.loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
  if (
    process.env.CRM_LOCAL_ONLY !== "true" ||
    process.env.CRM_DEMO_MODE !== "false"
  )
    throw new Error("Local-only mode is required.");
  assertLocalService(process.env.NEXT_PUBLIC_SUPABASE_URL, 54321);
  assertLocalService(process.env.CRM_LOCAL_DATABASE_URL, 54322);
  const password = process.env.CRM_LOCAL_TEST_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Set a local test password of at least 12 characters in .env.local.",
    );
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const definitions = [
    ["tenant.admin@local.salescrm.test", "Local Tenant Admin"],
    ["property.admin@local.salescrm.test", "Local Property Admin"],
    ["sales.jakarta@local.salescrm.test", "Local Jakarta Sales"],
    ["sales.bali@local.salescrm.test", "Local Bali Sales"],
    ["other.admin@local.salescrm.test", "Other Tenant Admin"],
  ];
  const users = [];
  for (const [email, name] of definitions) {
    let user = null;
    for (let page = 1; page <= 20; page++) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (listed.error) throw new Error("Cannot list local Auth users.");
      user =
        listed.data.users.find((candidate) => candidate.email === email) ??
        null;
      if (user || listed.data.users.length < 100) break;
    }
    if (!user) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error)
        throw new Error(`Cannot create local fixture ${email}.`);
      user = created.data.user;
    }
    users.push({ id: user.id, name, email });
  }
  const db = new pg.Client({
    connectionString: process.env.CRM_LOCAL_DATABASE_URL,
  });
  await db.connect();
  const tenantA = "10000000-0000-4000-8000-000000000001",
    tenantB = "10000000-0000-4000-8000-000000000002";
  const jakarta = "10000000-0000-4000-8000-000000000011",
    bali = "10000000-0000-4000-8000-000000000012",
    other = "10000000-0000-4000-8000-000000000021";
  try {
    await db.query("begin");
    for (const user of users)
      await db.query(
        "insert into public.profiles(id,full_name) values($1,$2) on conflict(id) do nothing",
        [user.id, user.name],
      );
    await db.query(
      "insert into public.tenants(id,name) values($1,'Local Nusantara Group'),($2,'Local Meridian Group') on conflict(id) do nothing",
      [tenantA, tenantB],
    );
    await db.query(
      "insert into public.properties(id,tenant_id,name,code,timezone) values($1,$2,'Local Jakarta Hotel','JKT','Asia/Jakarta'),($3,$2,'Local Bali Hotel','BALI','Asia/Makassar'),($4,$5,'Local Meridian Hotel','MDN','Asia/Jakarta') on conflict(id) do nothing",
      [jakarta, tenantA, bali, other, tenantB],
    );
    for (let index = 0; index < users.length; index++)
      await db.query(
        "insert into public.tenant_memberships(tenant_id,user_id,role) values($1,$2,$3) on conflict(tenant_id,user_id) do nothing",
        [
          index === 4 ? tenantB : tenantA,
          users[index].id,
          index === 0 || index === 4 ? "tenant-admin" : "member",
        ],
      );
    for (const [index, property, role] of [
      [1, jakarta, "property-admin"],
      [2, jakarta, "sales"],
      [3, bali, "sales"],
    ])
      await db.query(
        "insert into public.property_memberships(tenant_id,property_id,user_id,role) values($1,$2,$3,$4) on conflict(property_id,user_id) do nothing",
        [tenantA, property, users[index].id, role],
      );
    for (const [company, tenant, owner, name] of [
      [
        "10000000-0000-4000-8000-000000000101",
        tenantA,
        users[2].id,
        "Local shared client A",
      ],
      [
        "10000000-0000-4000-8000-000000000102",
        tenantB,
        users[4].id,
        "Local private client B",
      ],
    ]) {
      await db.query(
        "insert into public.companies(id,tenant_id,owner_id,name) values($1,$2,$3,$4) on conflict(id) do nothing",
        [company, tenant, owner, name],
      );
    }
    for (const [index, property, tenant, company, owner] of [
      [
        1,
        jakarta,
        tenantA,
        "10000000-0000-4000-8000-000000000101",
        users[2].id,
      ],
      [2, bali, tenantA, "10000000-0000-4000-8000-000000000101", users[3].id],
      [3, other, tenantB, "10000000-0000-4000-8000-000000000102", users[4].id],
    ]) {
      await db.query(
        "insert into public.opportunities(id,tenant_id,property_id,company_id,owner_id,name,offering_type,estimated_value,target_close,next_action,follow_up_date) values($1,$2,$3,$4,$5,'Local meeting fixture','meeting',10000000,current_date + 14,'Call local PIC',current_date + 1) on conflict(id) do nothing",
        [
          `10000000-0000-4000-8000-00000000020${index}`,
          tenant,
          property,
          company,
          owner,
        ],
      );
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
  console.log("Fixture lokal siap: 2 tenant, 3 property, 5 akun. Email login:");
  for (const user of users) console.log(`- ${user.email}`);
  console.log(
    "Password awal ada pada CRM_LOCAL_TEST_PASSWORD di .env.local. Rerun tidak mereset password atau perubahan data yang sudah ada.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
