import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenantA = id(100),
  tenantB = id(200),
  pA = id(101),
  pA2 = id(102),
  pB = id(201),
  companyA = id(301),
  companyA2 = id(302),
  companyB = id(303),
  contact = id(401),
  otherContact = id(402),
  opportunity = id(501),
  otherOpportunity = id(502);
async function asUser(db: PGlite, n: number) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id(n),
  ]);
}
function payload(overrides: Record<string, unknown> = {}) {
  return {
    company_id: companyA,
    contact_id: null,
    opportunity_id: null,
    communication_type: "whatsapp",
    occurred_at: new Date().toISOString(),
    summary: "Follow up client",
    outcome: "Discuss package options",
    notes: "",
    next_action: null,
    follow_up_date: null,
    latitude: null,
    longitude: null,
    accuracy_m: null,
    gps_captured_at: null,
    photo_sha256: null,
    ...overrides,
  };
}
function visit(overrides: Record<string, unknown> = {}) {
  return payload({
    communication_type: "visit",
    latitude: -6.2,
    longitude: 106.8,
    accuracy_m: 15,
    gps_captured_at: new Date().toISOString(),
    photo_sha256: "a".repeat(64),
    ...overrides,
  });
}
async function register(
  db: PGlite,
  activity: string,
  data: Record<string, unknown>,
  property = pA,
) {
  await db.query("select public.register_sales_activity($1,$2,$3::jsonb)", [
    property,
    activity,
    JSON.stringify(data),
  ]);
}
async function finalize(db: PGlite, activity: string, property = pA) {
  await db.query("select public.finalize_sales_activity($1,$2)", [
    property,
    activity,
  ]);
}
function path(activity: string, owner = 3) {
  return `${tenantA}/${pA}/${id(owner)}/${activity}.jpg`;
}
async function upload(
  db: PGlite,
  activity: string,
  metadata = { mimetype: "image/jpeg", size: 12345 },
) {
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('activity-selfies',$1,$2::jsonb)",
    [path(activity), JSON.stringify(metadata)],
  );
}
async function fixture() {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
    );
    for (const migration of [
      "202610300001-foundation.sql",
      "202610300002-tenancy.sql",
      "202610300003-administration.sql",
    ])
      await db.exec(
        await readFile(new URL(`./${migration}`, import.meta.url), "utf8"),
      );
    await db.exec(
      "create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name)); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;",
    );
    await db.exec(
      await readFile(
        new URL("./202610300004-sales-activities.sql", import.meta.url),
        "utf8",
      ),
    );
    for (let n = 1; n <= 6; n++) {
      await db.query("insert into auth.users values($1,$2,now())", [
        id(n),
        `user${n}@example.test`,
      ]);
      await db.query(
        "insert into public.profiles(id,full_name) values($1,$2)",
        [id(n), `User ${n}`],
      );
    }
    await db.query(
      "insert into public.tenants(id,name) values($1,'Group A'),($2,'Group B')",
      [tenantA, tenantB],
    );
    await db.query(
      "insert into public.properties(id,tenant_id,name,code) values($1,$2,'Hotel A','A'),($3,$2,'Hotel A2','A2'),($4,$5,'Hotel B','B')",
      [pA, tenantA, pA2, pB, tenantB],
    );
    for (let n = 1; n <= 6; n++)
      await db.query(
        "insert into public.tenant_memberships(tenant_id,user_id,role) values($1,$2,$3)",
        [
          n === 6 ? tenantB : tenantA,
          id(n),
          [1, 6].includes(n) ? "tenant-admin" : "member",
        ],
      );
    await db.query(
      "insert into public.property_memberships(tenant_id,property_id,user_id,role) values($1,$2,$3,'property-admin'),($1,$2,$4,'sales'),($1,$5,$6,'sales'),($1,$2,$7,'sales')",
      [tenantA, pA, id(2), id(3), pA2, id(4), id(5)],
    );
    await db.query(
      "insert into public.companies(id,tenant_id,owner_id,name) values($1,$2,$3,'Client A'),($4,$2,$3,'Client A2'),($5,$6,$7,'Client B')",
      [companyA, tenantA, id(3), companyA2, companyB, tenantB, id(6)],
    );
    await db.query(
      "insert into public.contacts(id,tenant_id,company_id,first_name,email) values($1,$2,$3,'PIC A','a@example.test'),($4,$2,$5,'PIC A2','a2@example.test')",
      [contact, tenantA, companyA, otherContact, companyA2],
    );
    await db.query(
      "insert into public.opportunities(id,tenant_id,property_id,company_id,owner_id,name,offering_type,estimated_value,target_close,next_action,follow_up_date) values($1,$2,$3,$4,$5,'Own meeting','meeting',100,current_date,'Call PIC',current_date),($6,$2,$3,$4,$7,'Peer meeting','meeting',100,current_date,'Call PIC',current_date)",
      [opportunity, tenantA, pA, companyA, id(3), otherOpportunity, id(5)],
    );
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

test("activity creation enforces mandatory visit proof, finite fresh GPS and tenant/client/opportunity references", async () => {
  const db = await fixture();
  try {
    await asUser(db, 3);
    for (const data of [
      visit({ photo_sha256: null }),
      visit({ latitude: null }),
      visit({ latitude: 91 }),
      visit({ accuracy_m: -1 }),
      visit({
        gps_captured_at: new Date(Date.now() - 11 * 60000).toISOString(),
      }),
      visit({
        gps_captured_at: new Date(Date.now() + 2 * 60000).toISOString(),
      }),
      payload({ occurred_at: new Date(Date.now() + 10 * 60000).toISOString() }),
      payload({ occurred_at: "-infinity" }),
      payload({ company_id: companyB }),
      payload({ contact_id: otherContact }),
      payload({ opportunity_id: otherOpportunity }),
      payload({ next_action: "Call PIC" }),
      payload({ photo_sha256: "a".repeat(64) }),
    ])
      await assert.rejects(register(db, id(600), data));
    await assert.rejects(register(db, id(600), payload(), pA2));
    await assert.rejects(
      db.query(
        "insert into public.sales_activities(id,tenant_id,property_id,company_id,owner_id,communication_type,occurred_at,summary,outcome,request_hash) values($1,$2,$3,$4,$5,'visit',now(),'Fake visit','No proof','fake')",
        [id(600), tenantA, pA, companyA, id(3)],
      ),
    );
    assert.equal(
      (await db.query("select * from public.sales_activities")).rows.length,
      0,
    );
    await register(
      db,
      id(601),
      payload({ contact_id: contact, opportunity_id: opportunity }),
    );
    await finalize(db, id(601));
    assert.equal(
      (
        await db.query(
          "select * from public.sales_activities where status='recorded'",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ stage: string }>(
          "select stage from public.opportunities where id=$1",
          [opportunity],
        )
      ).rows[0].stage,
      "discovery",
    );
  } finally {
    await db.close();
  }
});

test("private selfie upload gates finalization; retries create one task and proof remains immutable and scoped", async () => {
  const db = await fixture();
  const activity = id(610);
  const data = visit({
    next_action: "Send proposal",
    follow_up_date: "2026-11-02",
  });
  try {
    await asUser(db, 3);
    await register(db, activity, data);
    await assert.rejects(finalize(db, activity));
    assert.equal((await db.query("select * from public.tasks")).rows.length, 0);
    await upload(db, activity, { mimetype: "image/png", size: 123 });
    await assert.rejects(finalize(db, activity));
    await db.query("delete from storage.objects where name=$1", [
      path(activity),
    ]);
    await upload(db, activity);
    await asUser(db, 5);
    assert.equal(
      (await db.query("select * from public.sales_activities")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(upload(db, activity));
    await assert.rejects(finalize(db, activity));
    await asUser(db, 1);
    assert.equal(
      (await db.query("select * from public.sales_activities")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(finalize(db, activity));
    await asUser(db, 3);
    await finalize(db, activity);
    await register(db, activity, data);
    await finalize(db, activity);
    assert.equal(
      (
        await db.query("select * from public.tasks where activity_id=$1", [
          activity,
        ])
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select * from public.sales_activities where status='recorded'",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      register(db, activity, { ...data, outcome: "Changed retry" }),
    );
    assert.equal(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning id",
          [path(activity)],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update storage.objects set metadata='{}' where name=$1 returning id",
          [path(activity)],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "update public.sales_activities set outcome='Changed' where id=$1",
        [activity],
      ),
    );
    await assert.rejects(
      db.query("delete from public.sales_activities where id=$1", [activity]),
    );
    await asUser(db, 2);
    assert.equal(
      (await db.query("select * from public.sales_activities")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await asUser(db, 4);
    assert.equal(
      (await db.query("select * from public.sales_activities")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await asUser(db, 6);
    assert.equal(
      (await db.query("select * from public.sales_activities")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(register(db, activity, data, pB));
    await db.exec("reset role");
    await db.query(
      "update public.property_memberships set active=false where property_id=$1 and user_id=$2",
      [pA, id(3)],
    );
    await asUser(db, 3);
    assert.equal(
      (await db.query("select * from public.sales_activities")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(finalize(db, activity));
    await db.exec("reset role;set role anon");
    await assert.rejects(db.query("select * from public.sales_activities"));
    await assert.rejects(finalize(db, activity));
  } finally {
    await db.close();
  }
});

test("draft upload/finalization expiration and malformed proofs never publish an activity or follow-up task", async () => {
  const db = await fixture();
  const activity = id(620);
  try {
    await asUser(db, 3);
    await assert.rejects(upload(db, activity));
    await register(
      db,
      activity,
      visit({ next_action: "Call client", follow_up_date: "2026-11-01" }),
    );
    await upload(db, activity, { mimetype: "image/jpeg", size: 204801 });
    await assert.rejects(finalize(db, activity));
    await db.query("delete from storage.objects where name=$1", [
      path(activity),
    ]);
    await upload(db, activity);
    await db.exec("reset role");
    await db.query(
      "update public.sales_activities set gps_captured_at=now()-interval '11 minutes' where id=$1",
      [activity],
    );
    await asUser(db, 3);
    await assert.rejects(finalize(db, activity));
    assert.equal((await db.query("select * from public.tasks")).rows.length, 0);
    assert.equal(
      (
        await db.query(
          "select * from public.sales_activities where status='recorded'",
        )
      ).rows.length,
      0,
    );
    await db.exec("reset role");
    await db.query(
      "update public.sales_activities set created_at=now()-interval '2 hours',gps_captured_at=now() where id=$1",
      [activity],
    );
    await asUser(db, 3);
    await assert.rejects(finalize(db, activity));
    await db.query("delete from storage.objects where name=$1", [
      path(activity),
    ]);
    await assert.rejects(upload(db, activity));
  } finally {
    await db.close();
  }
});
