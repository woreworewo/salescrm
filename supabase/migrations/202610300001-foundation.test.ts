import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("database enforces ownership, atomic writes, stage history and version checks", async () => {
  const db = new PGlite();
  const sales = "00000000-0000-4000-8000-000000000001";
  const other = "00000000-0000-4000-8000-000000000002";
  const admin = "00000000-0000-4000-8000-000000000003";
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        new URL("./202610300001-foundation.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values ('${sales}'), ('${other}'), ('${admin}'); insert into public.profiles values ('${sales}', 'Sales One', 'sales'), ('${other}', 'Sales Two', 'sales'), ('${admin}', 'Admin', 'admin');`,
    );
    async function asUser(id: string) {
      await db.exec(
        `reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`,
      );
    }
    await asUser(sales);
    const companyResult = await db.query<{ id: string }>(
      `select public.create_company_with_contact($1::jsonb) as id`,
      [
        JSON.stringify({
          name: "Client One",
          first_name: "PIC",
          email: "pic@example.com",
        }),
      ],
    );
    const company = companyResult.rows[0].id;
    assert.equal(
      (await db.query("select * from public.contacts")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(`select public.create_company_with_contact($1::jsonb)`, [
        JSON.stringify({
          name: "Atomic rollback",
          first_name: "",
          email: "pic@example.com",
        }),
      ]),
    );
    assert.equal(
      (await db.query("select * from public.companies")).rows.length,
      1,
    );
    const created = await db.query<{ id: string }>(
      `insert into public.opportunities(company_id,owner_id,name,offering_type,estimated_value,target_close,next_action,follow_up_date) values ($1,$2,'Meeting offer','meeting',1000000,'2026-11-01','Call client','2026-10-31') returning id`,
      [company, sales],
    );
    const opportunity = created.rows[0].id;
    await assert.rejects(
      db.query("update public.opportunities set stage='won' where id=$1", [
        opportunity,
      ]),
    );
    await assert.rejects(
      db.query("select public.transition_opportunity($1,1,'won','')", [
        opportunity,
      ]),
    );
    await assert.rejects(
      db.query("select public.transition_opportunity($1,1,'lost',null)", [
        opportunity,
      ]),
    );
    await db.query(
      "select public.transition_opportunity($1,1,'negotiation','')",
      [opportunity],
    );
    assert.equal(
      (await db.query("select * from public.pipeline_stage_history")).rows
        .length,
      1,
    );
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,1,'lost','No budget')",
        [opportunity],
      ),
    );
    await assert.rejects(
      db.query("update public.profiles set role='admin' where id=$1", [sales]),
    );
    const task = (
      await db.query<{ id: string }>(
        "insert into public.tasks(company_id,owner_id,title,due_date) values ($1,$2,'Call PIC','2026-11-01') returning id",
        [company, sales],
      )
    ).rows[0].id;
    await db.query("select public.set_task_completed($1,1,true)", [task]);
    await assert.rejects(
      db.query("select public.set_task_completed($1,1,false)", [task]),
    );
    await asUser(other);
    assert.equal(
      (await db.query("select * from public.companies")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.contacts")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.opportunities")).rows.length,
      0,
    );
    assert.equal((await db.query("select * from public.tasks")).rows.length, 0);
    assert.equal(
      (await db.query("select * from public.pipeline_stage_history")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query(
        "select public.transition_opportunity($1,2,'lost','No budget')",
        [opportunity],
      ),
    );
    await assert.rejects(
      db.query("select public.set_task_completed($1,2,false)", [task]),
    );
    await assert.rejects(
      db.query(
        "insert into public.tasks(company_id,owner_id,title,due_date) values ($1,$2,'Unauthorized','2026-11-01')",
        [company, other],
      ),
    );
    await asUser(admin);
    assert.equal(
      (await db.query("select * from public.companies")).rows.length,
      1,
    );
    await db.query(
      "select public.transition_opportunity($1,2,'lost','No budget')",
      [opportunity],
    );
    assert.equal(
      (await db.query("select * from public.pipeline_stage_history")).rows
        .length,
      2,
    );
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select * from public.companies"));
    await assert.rejects(
      db.query("select public.transition_opportunity($1,3,'discovery','')", [
        opportunity,
      ]),
    );
  } finally {
    await db.close();
  }
});
