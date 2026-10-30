import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenantA = id(100),
  tenantB = id(200),
  propertyA = id(101),
  propertyA2 = id(102),
  propertyB = id(201);
async function asUser(db: PGlite, n: number) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id(n),
  ]);
}
async function fixture() {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
    );
    for (const name of [
      "202610300001-foundation.sql",
      "202610300002-tenancy.sql",
      "202610300003-administration.sql",
    ])
      await db.exec(
        await readFile(new URL(`./${name}`, import.meta.url), "utf8"),
      );
    for (let n = 1; n <= 9; n++) {
      await db.query("insert into auth.users values($1,$2,$3)", [
        id(n),
        `user${n}@example.test`,
        n === 9 ? null : new Date().toISOString(),
      ]);
      if (![7, 9].includes(n))
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
      "insert into public.properties(id,tenant_id,name,code) values($1,$2,'Hotel A1','A1'),($3,$2,'Hotel A2','A2'),($4,$5,'Hotel B1','B1')",
      [propertyA, tenantA, propertyA2, propertyB, tenantB],
    );
    for (let n = 1; n <= 6; n++)
      await db.query(
        "insert into public.tenant_memberships(tenant_id,user_id,role) values($1,$2,$3)",
        [
          n === 6 ? tenantB : tenantA,
          id(n),
          [1, 2, 6].includes(n) ? "tenant-admin" : "member",
        ],
      );
    await db.query(
      "insert into public.property_memberships(tenant_id,property_id,user_id,role) values($1,$2,$3,'property-admin'),($1,$2,$4,'sales')",
      [tenantA, propertyA, id(3), id(4)],
    );
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
async function invite(db: PGlite, n: number, role = "sales") {
  return (
    await db.query<{ id: string }>(
      "select public.request_membership_invitation($1,$2,$3,$4) as id",
      [propertyA, `user${n}@example.test`, `User ${n}`, role],
    )
  ).rows[0].id;
}

test("administration respects scoped roles, version conflicts and last-admin/property protections", async () => {
  const db = await fixture();
  try {
    await asUser(db, 4);
    await assert.rejects(
      db.query("select public.rename_tenant($1,1,'Hijacked')", [tenantA]),
    );
    await assert.rejects(
      db.query(
        "select public.save_property($1,null,0,'New hotel','NEW','Asia/Jakarta',true)",
        [tenantA],
      ),
    );
    await assert.rejects(
      db.query(
        "select public.set_tenant_membership($1,$2,1,'tenant-admin',true)",
        [tenantA, id(4)],
      ),
    );
    await asUser(db, 3);
    await db.query(
      "select public.set_property_membership($1,$2,0,'sales',true)",
      [propertyA, id(5)],
    );
    await assert.rejects(
      db.query(
        "select public.set_property_membership($1,$2,1,'property-admin',true)",
        [propertyA, id(5)],
      ),
    );
    await assert.rejects(
      db.query("select public.set_property_membership($1,$2,1,'sales',false)", [
        propertyA,
        id(3),
      ]),
    );
    await assert.rejects(
      db.query("select public.set_property_membership($1,$2,0,'sales',true)", [
        propertyA,
        id(1),
      ]),
    );
    await assert.rejects(
      db.query("select public.set_property_membership($1,$2,0,'sales',true)", [
        propertyB,
        id(4),
      ]),
    );
    await db.query(
      "select public.set_property_membership($1,$2,1,'sales',false)",
      [propertyA, id(5)],
    );
    await asUser(db, 1);
    await db.query("select public.rename_tenant($1,1,'Renamed Group')", [
      tenantA,
    ]);
    await assert.rejects(
      db.query("select public.rename_tenant($1,1,'Stale')", [tenantA]),
    );
    await assert.rejects(
      db.query("select public.rename_tenant($1,1,'Cross tenant')", [tenantB]),
    );
    const created = (
      await db.query<{ id: string }>(
        "select public.save_property($1,null,0,'New hotel','NEW','Asia/Makassar',true) as id",
        [tenantA],
      )
    ).rows[0].id;
    await db.query(
      "select public.save_property($1,$2,1,'New hotel','NEW','Asia/Makassar',false)",
      [tenantA, created],
    );
    await db.query(
      "select public.save_property($1,$2,1,'Hotel A2','A2','Asia/Jakarta',false)",
      [tenantA, propertyA2],
    );
    await assert.rejects(
      db.query(
        "select public.save_property($1,$2,1,'Hotel A1','A1','Asia/Jakarta',false)",
        [tenantA, propertyA],
      ),
    );
    await assert.rejects(
      db.query(
        "select public.save_property($1,$2,1,'Foreign','F','Asia/Jakarta',true)",
        [tenantA, propertyB],
      ),
    );
    await db.query(
      "select public.save_property($1,$2,2,'Hotel A2','A2','Asia/Jakarta',true)",
      [tenantA, propertyA2],
    );
    await db.query(
      "select public.set_tenant_membership($1,$2,1,'member',true)",
      [tenantA, id(2)],
    );
    await assert.rejects(
      db.query("select public.set_tenant_membership($1,$2,1,'member',true)", [
        tenantA,
        id(1),
      ]),
    );
    await assert.rejects(
      db.query(
        "select public.set_tenant_membership($1,$2,1,'tenant-admin',false)",
        [tenantA, id(1)],
      ),
    );
    await assert.rejects(
      db.query(
        "update public.tenant_memberships set role='tenant-admin' where user_id=$1",
        [id(4)],
      ),
    );
    assert(
      (await db.query("select * from public.administration_events")).rows
        .length >= 7,
    );
    await asUser(db, 6);
    assert.equal(
      (await db.query("select * from public.administration_events")).rows
        .length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("invitations require verified recipient consent and recheck issuer authority without granting cross-tenant rights", async () => {
  const db = await fixture();
  try {
    await asUser(db, 4);
    await assert.rejects(invite(db, 7));
    await asUser(db, 3);
    await assert.rejects(invite(db, 7, "tenant-admin"));
    await assert.rejects(invite(db, 7, "property-admin"));
    const invitation = await invite(db, 7);
    await assert.rejects(invite(db, 7));
    await asUser(db, 8);
    await assert.rejects(
      db.query("select public.accept_membership_invitation($1)", [invitation]),
    );
    await asUser(db, 7);
    assert.equal(
      (await db.query("select * from public.list_my_invitations()")).rows
        .length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.membership_invitations")).rows
        .length,
      0,
    );
    await db.query("select public.accept_membership_invitation($1)", [
      invitation,
    ]);
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from public.tenant_memberships where user_id=$1",
          [id(7)],
        )
      ).rows[0].role,
      "member",
    );
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from public.property_memberships where user_id=$1",
          [id(7)],
        )
      ).rows[0].role,
      "sales",
    );
    assert.equal(
      (await db.query("select * from public.tenants")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.profiles where id=$1", [id(7)]))
        .rows.length,
      1,
    );
    await assert.rejects(
      db.query("select public.accept_membership_invitation($1)", [invitation]),
    );
    await asUser(db, 3);
    const unverified = await invite(db, 9);
    const issuerRevoked = await invite(db, 8);
    const privileged = await invite(db, 2);
    await asUser(db, 9);
    assert.equal(
      (await db.query("select * from public.list_my_invitations()")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query("select public.accept_membership_invitation($1)", [unverified]),
    );
    await asUser(db, 2);
    await assert.rejects(
      db.query("select public.accept_membership_invitation($1)", [privileged]),
    );
    await asUser(db, 1);
    await db.query("select public.revoke_membership_invitation($1)", [
      privileged,
    ]);
    await db.query(
      "select public.set_tenant_membership($1,$2,1,'tenant-admin',false)",
      [tenantA, id(2)],
    );
    const downgradedAdmin = await invite(db, 2);
    await asUser(db, 2);
    await db.query("select public.accept_membership_invitation($1)", [
      downgradedAdmin,
    ]);
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from public.tenant_memberships where user_id=$1",
          [id(2)],
        )
      ).rows[0].role,
      "member",
    );
    await asUser(db, 1);
    await db.query(
      "select public.set_property_membership($1,$2,1,'property-admin',false)",
      [propertyA, id(3)],
    );
    await asUser(db, 8);
    await assert.rejects(
      db.query("select public.accept_membership_invitation($1)", [
        issuerRevoked,
      ]),
    );
    await asUser(db, 1);
    const restoredSales = await invite(db, 3);
    await asUser(db, 3);
    await db.query("select public.accept_membership_invitation($1)", [
      restoredSales,
    ]);
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from public.property_memberships where user_id=$1",
          [id(3)],
        )
      ).rows[0].role,
      "sales",
    );
    await asUser(db, 1);
    await db.query("select public.revoke_membership_invitation($1)", [
      issuerRevoked,
    ]);
    const tenantAdminInvitation = await invite(db, 8, "tenant-admin");
    await asUser(db, 8);
    await db.query("select public.accept_membership_invitation($1)", [
      tenantAdminInvitation,
    ]);
    assert.equal(
      (await db.query("select * from public.properties")).rows.length,
      2,
    );
    assert.equal(
      (await db.query("select * from public.tenants")).rows.length,
      1,
    );
    await asUser(db, 6);
    assert.equal(
      (await db.query("select * from public.membership_invitations")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query("select public.revoke_membership_invitation($1)", [unverified]),
    );
    await db.exec("reset role");
    await db.query(
      "update auth.users set email_confirmed_at=now() where id=$1",
      [id(9)],
    );
    await db.query(
      "update public.membership_invitations set expires_at=now()-interval '1 minute' where id=$1",
      [unverified],
    );
    await asUser(db, 9);
    await assert.rejects(
      db.query("select public.accept_membership_invitation($1)", [unverified]),
    );
  } finally {
    await db.close();
  }
});

test("sales assignment and invitation delivery claims enforce property scope, ownership eligibility and retry identity", async () => {
  const db = await fixture();
  try {
    await asUser(db, 1);
    const company = (
      await db.query<{ id: string }>(
        "select public.create_company_with_contact($1,$2::jsonb) as id",
        [
          propertyA,
          JSON.stringify({
            name: "Assignment client",
            first_name: "PIC",
            email: "pic@example.test",
          }),
        ],
      )
    ).rows[0].id;
    const opportunity = (
      await db.query<{ id: string }>(
        "insert into public.opportunities(tenant_id,property_id,company_id,owner_id,name,offering_type,estimated_value,target_close,next_action,follow_up_date) values($1,$2,$3,$4,'Meeting offer','meeting',100,current_date,'Call PIC',current_date) returning id",
        [tenantA, propertyA, company, id(1)],
      )
    ).rows[0].id;
    const task = (
      await db.query<{ id: string }>(
        "insert into public.tasks(tenant_id,property_id,company_id,owner_id,title,due_date) values($1,$2,$3,$4,'Call PIC',current_date) returning id",
        [tenantA, propertyA, company, id(1)],
      )
    ).rows[0].id;
    const invitation = await invite(db, 7);
    const attempt = (
      await db.query<{ id: string }>(
        "select public.claim_invitation_delivery($1) as id",
        [invitation],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query("select public.claim_invitation_delivery($1)", [invitation]),
    );
    await assert.rejects(
      db.query(
        "select public.finish_invitation_delivery($1,$2,'provider-accepted')",
        [invitation, id(999)],
      ),
    );
    await assert.rejects(
      db.query("select public.finish_invitation_delivery($1,$2,'delivered')", [
        invitation,
        attempt,
      ]),
    );
    await db.query(
      "select public.finish_invitation_delivery($1,$2,'provider-accepted')",
      [invitation, attempt],
    );
    assert.equal(
      (
        await db.query<{ delivery_status: string }>(
          "select delivery_status from public.membership_invitations where id=$1",
          [invitation],
        )
      ).rows[0].delivery_status,
      "provider-accepted",
    );
    await asUser(db, 4);
    await assert.rejects(
      db.query("select public.claim_invitation_delivery($1)", [invitation]),
    );
    await assert.rejects(
      db.query("select public.assign_sales_record($1,'opportunity',$2,1,$3)", [
        propertyA,
        opportunity,
        id(4),
      ]),
    );
    await asUser(db, 3);
    await db.query(
      "select public.assign_sales_record($1,'opportunity',$2,1,$3)",
      [propertyA, opportunity, id(4)],
    );
    await db.query("select public.assign_sales_record($1,'task',$2,1,$3)", [
      propertyA,
      task,
      id(4),
    ]);
    const audit = (
      await db.query<{ details: { previous_owner: string; owner: string } }>(
        "select details from public.administration_events where subject_id=$1 and action='sales-owner-assigned'",
        [opportunity],
      )
    ).rows[0].details;
    assert.equal(audit.previous_owner, id(1));
    assert.equal(audit.owner, id(4));
    await assert.rejects(
      db.query("select public.assign_sales_record($1,'opportunity',$2,1,$3)", [
        propertyA,
        opportunity,
        id(4),
      ]),
    );
    await assert.rejects(
      db.query("select public.assign_sales_record($1,'opportunity',$2,2,$3)", [
        propertyA,
        opportunity,
        id(5),
      ]),
    );
    await assert.rejects(
      db.query("select public.assign_sales_record($1,'opportunity',$2,2,$3)", [
        propertyB,
        opportunity,
        id(6),
      ]),
    );
    await assert.rejects(
      db.query("update public.opportunities set owner_id=$1 where id=$2", [
        id(5),
        opportunity,
      ]),
    );
    await asUser(db, 4);
    assert.equal(
      (
        await db.query<{ owner_id: string }>(
          "select owner_id from public.opportunities",
        )
      ).rows[0].owner_id,
      id(4),
    );
    assert.equal(
      (await db.query("select * from public.administration_events")).rows
        .length,
      0,
    );
    await asUser(db, 6);
    await assert.rejects(
      db.query("select public.finish_invitation_delivery($1,$2,'failed')", [
        invitation,
        attempt,
      ]),
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select public.list_my_invitations()"));
    await assert.rejects(
      db.query(
        "select public.save_property($1,null,0,'New','X','Asia/Jakarta',true)",
        [tenantA],
      ),
    );
  } finally {
    await db.close();
  }
});
