import assert from "node:assert/strict";
import test from "node:test";
import {
  companySchema,
  opportunitySchema,
  transitionError,
  transitionSchema,
} from "./validation";

const company = {
  name: "Acme",
  address: "",
  city: "",
  phone: "",
  fax: "",
  account_type: "",
  title: "",
  first_name: "Rani",
  last_name: "",
  position: "",
  mobile: "",
  email: "pic@example.com",
};

test("company requires a contact channel and valid email", () => {
  assert.equal(companySchema.safeParse(company).success, true);
  assert.equal(
    companySchema.safeParse({ ...company, email: "" }).success,
    false,
  );
  assert.equal(
    companySchema.safeParse({ ...company, email: "invalid" }).success,
    false,
  );
  assert.equal(
    companySchema.safeParse({ ...company, name: "  " }).success,
    false,
  );
});

test("opportunity rejects invalid money and dates", () => {
  const value = {
    company_id: "00000000-0000-4000-8000-000000000001",
    name: "Meeting package",
    offering_type: "meeting",
    estimated_value: "12000000.50",
    target_close: "2026-11-01",
    next_action: "Call PIC",
    follow_up_date: "2026-10-31",
  };
  assert.equal(opportunitySchema.safeParse(value).success, true);
  for (const estimated_value of ["-1", "NaN", "1e20", "1.001", "1000000000000"])
    assert.equal(
      opportunitySchema.safeParse({ ...value, estimated_value }).success,
      false,
    );
  assert.equal(
    opportunitySchema.safeParse({ ...value, target_close: "2026-02-30" })
      .success,
    false,
  );
});

test("stage transitions require valid version, lost reason and commercial verification", () => {
  assert.match(transitionError("won", "")!, /LOA/);
  assert.match(transitionError("lost", " ")!, /alasan/);
  assert.equal(transitionError("lost", "Budget declined"), null);
  assert.equal(transitionError("negotiation", ""), null);
  assert.equal(
    transitionSchema.safeParse({
      id: "invalid",
      stage: "negotiation",
      version: 0,
      reason: "",
    }).success,
    false,
  );
});
