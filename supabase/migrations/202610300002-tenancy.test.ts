import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
async function foundation(db: PGlite) {
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  await db.exec(
    await readFile(
      new URL("./202610300001-foundation.sql", import.meta.url),
      "utf8",
    ),
  );
}
async function tenancy(db: PGlite) {
  await db.exec(
    await readFile(
      new URL("./202610300002-tenancy.sql", import.meta.url),
      "utf8",
    ),
  );
}
async function asUser(db: PGlite, user: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    user,
  ]);
}

test("upgrade preserves legacy clients, transactions and scoped admin access", async () => {
  const db = new PGlite();
  try {
    await foundation(db);
    await db.query("insert into auth.users values ($1),($2)", [id(1), id(2)]);
    await db.query(
      "insert into public.profiles values ($1,'Legacy Admin','admin'),($2,'Legacy Sales','sales')",
      [id(1), id(2)],
    );
    await asUser(db, id(2));
    const company = (
      await db.query<{ id: string }>(
        "select public.create_company_with_contact($1::jsonb) as id",
        [
          JSON.stringify({
            name: "Legacy client",
            first_name: "PIC",
            email: "pic@example.com",
          }),
        ],
      )
    ).rows[0].id;
    const opportunity = (
      await db.query<{ id: string }>(
        "insert into public.opportunities(company_id,owner_id,name,offering_type,estimated_value,target_close,next_action,follow_up_date) values ($1,$2,'Legacy meeting','meeting',100,'2026-11-01','Call PIC','2026-11-01') returning id",
        [company, id(2)],
      )
    ).rows[0].id;
    await db.query(
      "select public.transition_opportunity($1,1,'negotiation','')",
      [opportunity],
    );
    await db.query(
      "insert into public.tasks(company_id,owner_id,title,due_date) values ($1,$2,'Legacy followup','2026-11-01')",
      [company, id(2)],
    );
    await db.exec("reset role");
    await tenancy(db);
    assert.equal(
      (await db.query("select * from public.tenants")).rows.length,
      1,
    );
    const property = (
      await db.query<{ id: string; tenant_id: string }>(
        "select id,tenant_id from public.properties",
      )
    ).rows[0];
    await asUser(db, id(1));
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from public.tenant_memberships where user_id=$1",
          [id(1)],
        )
      ).rows[0].role,
      "tenant-admin",
    );
    const migrated = (
      await db.query<{
        tenant_id: string;
        property_id: string;
        version: number;
        stage: string;
      }>("select * from public.opportunities")
    ).rows[0];
    assert.equal(migrated.tenant_id, property.tenant_id);
    assert.equal(migrated.property_id, property.id);
    assert.equal(migrated.version, 2);
    assert.equal(migrated.stage, "negotiation");
    assert.equal(
      (await db.query("select * from public.contacts")).rows.length,
      1,
    );
    assert.equal((await db.query("select * from public.tasks")).rows.length, 1);
    assert.equal(
      (await db.query("select * from public.pipeline_stage_history")).rows
        .length,
      1,
    );
    await db.query(
      "select public.transition_opportunity($1,$2,2,'lost','No budget')",
      [property.id, opportunity],
    );
    assert.equal(
      (await db.query("select * from public.pipeline_stage_history")).rows
        .length,
      2,
    );
  } finally {
    await db.close();
  }
});

test("tenants and properties enforce scoped roles, foreign keys, RPC authorization and revocation", async () => {
  const db = new PGlite();
  const [
    tenantA,
    tenantB,
    a1,
    a2,
    b1,
    adminA,
    adminB,
    propertyAdmin,
    salesA,
    salesA2,
    peer,
  ] = Array.from({ length: 11 }, (_, i) => id(100 + i));
  try {
    await foundation(db);
    await tenancy(db);
    assert.equal(
      (await db.query("select * from public.tenants")).rows.length,
      0,
    );
    for (const user of [adminA, adminB, propertyAdmin, salesA, salesA2, peer]) {
      await db.query("insert into auth.users values ($1)", [user]);
      await db.query(
        "insert into public.profiles(id,full_name) values ($1,$2)",
        [user, `User ${user}`],
      );
    }
    await db.query(
      "insert into public.tenants(id,name) values ($1,'Group A'),($2,'Group B')",
      [tenantA, tenantB],
    );
    await db.query(
      "insert into public.properties(id,tenant_id,name,code) values ($1,$2,'A Jakarta','JKT'),($3,$2,'A Bandung','BDG'),($4,$5,'B Jakarta','JKT')",
      [a1, tenantA, a2, b1, tenantB],
    );
    await db.query(
      "insert into public.tenant_memberships(tenant_id,user_id,role) values ($1,$2,'tenant-admin'),($3,$4,'tenant-admin'),($1,$5,'member'),($1,$6,'member'),($1,$7,'member'),($1,$8,'member'),($3,$2,'member')",
      [tenantA, adminA, tenantB, adminB, propertyAdmin, salesA, salesA2, peer],
    );
    await db.query(
      "insert into public.property_memberships(tenant_id,property_id,user_id,role) values ($1,$2,$3,'property-admin'),($1,$4,$3,'sales'),($1,$2,$5,'sales'),($1,$4,$6,'sales'),($1,$2,$7,'sales'),($8,$9,$10,'sales')",
      [
        tenantA,
        a1,
        propertyAdmin,
        a2,
        salesA,
        salesA2,
        peer,
        tenantB,
        b1,
        adminA,
      ],
    );
    await asUser(db, salesA);
    const companyA = (
      await db.query<{ id: string }>(
        "select public.create_company_with_contact($1,$2::jsonb) as id",
        [
          a1,
          JSON.stringify({
            name: "Company A",
            first_name: "PIC",
            email: "a@example.com",
            tenant_id: tenantB,
            owner_id: adminB,
          }),
        ],
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query<{ tenant_id: string }>(
          "select tenant_id from public.companies",
        )
      ).rows[0].tenant_id,
      tenantA,
    );
    await assert.rejects(
      db.query("select public.create_company_with_contact($1,$2::jsonb)", [
        b1,
        JSON.stringify({
          name: "Unauthorized",
          first_name: "PIC",
          email: "a@example.com",
        }),
      ]),
    );
    async function opportunity(
      property: string,
      tenant: string,
      company: string,
      user: string,
    ) {
      return (
        await db.query<{ id: string }>(
          "insert into public.opportunities(tenant_id,property_id,company_id,owner_id,name,offering_type,estimated_value,target_close,next_action,follow_up_date) values ($1,$2,$3,$4,'Meeting opportunity','meeting',100,'2026-11-01','Call PIC','2026-11-01') returning id",
          [tenant, property, company, user],
        )
      ).rows[0].id;
    }
    const own = await opportunity(a1, tenantA, companyA, salesA);
    const task = (
      await db.query<{ id: string }>(
        "insert into public.tasks(tenant_id,property_id,company_id,owner_id,title,due_date) values ($1,$2,$3,$4,'Call client','2026-11-01') returning id",
        [tenantA, a1, companyA, salesA],
      )
    ).rows[0].id;
    await db.query(
      "select public.transition_opportunity($1,$2,1,'negotiation','')",
      [a1, own],
    );
    await assert.rejects(
      db.query("select public.transition_opportunity($1,$2,2,'won','')", [
        a1,
        own,
      ]),
    );
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,$2,null,'lost','No budget')",
        [a1, own],
      ),
    );
    await assert.rejects(
      db.query("select public.transition_opportunity($1,$2,2,'lost',null)", [
        a1,
        own,
      ]),
    );
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,$2,2,'lost','No budget')",
        [a2, own],
      ),
    );
    await assert.rejects(opportunity(a2, tenantA, companyA, salesA));
    await assert.rejects(
      db.query(
        "update public.tenant_memberships set role='tenant-admin' where user_id=$1",
        [salesA],
      ),
    );
    await assert.rejects(
      db.query("update public.opportunities set property_id=$1 where id=$2", [
        a2,
        own,
      ]),
    );
    await assert.rejects(
      db.query(
        "insert into public.property_memberships(tenant_id,property_id,user_id) values ($1,$2,$3)",
        [tenantA, a2, salesA],
      ),
    );
    await asUser(db, peer);
    assert.equal(
      (await db.query("select * from public.companies")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.contacts")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.opportunities")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.pipeline_stage_history")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,$2,2,'lost','No budget')",
        [a1, own],
      ),
    );
    await assert.rejects(
      db.query("select public.set_task_completed($1,$2,1,true)", [a1, task]),
    );
    await asUser(db, salesA2);
    assert.equal(
      (await db.query("select * from public.properties")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.companies")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.opportunities")).rows.length,
      0,
    );
    const secondPropertyOpportunity = await opportunity(
      a2,
      tenantA,
      companyA,
      salesA2,
    );
    await asUser(db, propertyAdmin);
    assert.equal(
      (await db.query("select * from public.opportunities")).rows.length,
      1,
    );
    await db.query("select public.set_task_completed($1,$2,1,true)", [
      a1,
      task,
    ]);
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,$2,1,'lost','No budget')",
        [a2, secondPropertyOpportunity],
      ),
    );
    await asUser(db, adminB);
    assert.equal(
      (await db.query("select * from public.companies")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.opportunities")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      2,
    );
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,$2,2,'lost','No budget')",
        [a1, own],
      ),
    );
    const companyB = (
      await db.query<{ id: string }>(
        "select public.create_company_with_contact($1,$2::jsonb) as id",
        [
          b1,
          JSON.stringify({
            name: "Company B",
            first_name: "PIC",
            email: "b@example.com",
          }),
        ],
      )
    ).rows[0].id;
    const foreignOpportunity = await opportunity(b1, tenantB, companyB, adminB);
    await asUser(db, adminA);
    assert.equal(
      (await db.query("select * from public.properties")).rows.length,
      3,
    );
    assert.equal(
      (await db.query("select * from public.opportunities")).rows.length,
      2,
    );
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,$2,1,'lost','No budget')",
        [b1, foreignOpportunity],
      ),
    );
    await db.query(
      "select public.transition_opportunity($1,$2,1,'lost','No budget')",
      [a2, secondPropertyOpportunity],
    );
    await assert.rejects(opportunity(a1, tenantA, companyB, adminA));
    await db.exec("reset role");
    await assert.rejects(
      db.query(
        "insert into public.contacts(tenant_id,company_id,first_name) values ($1,$2,'Cross tenant')",
        [tenantA, companyB],
      ),
    );
    await assert.rejects(opportunity(a1, tenantB, companyB, adminB));
    await assert.rejects(opportunity(a1, tenantA, companyA, adminB));
    await assert.rejects(
      db.query(
        "insert into public.property_memberships(tenant_id,property_id,user_id) values ($1,$2,$3)",
        [tenantB, a1, adminB],
      ),
    );
    await db.query(
      "update public.property_memberships set active=false where user_id=$1 and property_id=$2",
      [salesA, a1],
    );
    await asUser(db, salesA);
    assert.equal(
      (await db.query("select * from public.opportunities")).rows.length,
      0,
    );
    assert.equal((await db.query("select * from public.tasks")).rows.length, 0);
    await assert.rejects(
      db.query("select public.set_task_completed($1,$2,2,false)", [a1, task]),
    );
    await db.exec("reset role");
    await db.query(
      "update public.tenant_memberships set active=false where tenant_id=$1 and user_id=$2",
      [tenantA, salesA2],
    );
    await asUser(db, salesA2);
    assert.equal(
      (await db.query("select * from public.properties")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.companies")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.contacts")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.transition_opportunity($1,$2,2,'discovery','')", [
        a2,
        secondPropertyOpportunity,
      ]),
    );
    await db.exec("reset role");
    await db.query("update public.properties set active=false where id=$1", [
      a2,
    ]);
    await asUser(db, adminA);
    assert.equal(
      (
        await db.query(
          "select * from public.opportunities where property_id=$1",
          [a2],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.transition_opportunity($1,$2,2,'discovery','')", [
        a2,
        secondPropertyOpportunity,
      ]),
    );
    await db.exec("reset role");
    await db.query("update public.tenants set active=false where id=$1", [
      tenantB,
    ]);
    await asUser(db, adminB);
    for (const table of [
      "tenants",
      "properties",
      "companies",
      "contacts",
      "opportunities",
      "tasks",
    ]) {
      assert.equal(
        (await db.query(`select * from public.${table}`)).rows.length,
        0,
      );
    }
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,$2,1,'lost','No budget')",
        [b1, foreignOpportunity],
      ),
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.tenants"));
    await assert.rejects(
      db.query("select public.create_company_with_contact($1,'{}'::jsonb)", [
        a1,
      ]),
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ legacy: string | null }>(
          "select to_regprocedure('public.transition_opportunity(uuid,integer,text,text)')::text as legacy",
        )
      ).rows[0].legacy,
      null,
    );
  } finally {
    await db.close();
  }
});
