import assert from "node:assert/strict";
import test from "node:test";
import {
  activitySchema,
  activityFiltersSchema,
  localActivityTime,
} from "./activity-validation";
const base = {
  id: "00000000-0000-4000-8000-000000000001",
  company_id: "00000000-0000-4000-8000-000000000002",
  contact_id: null,
  opportunity_id: null,
  communication_type: "whatsapp",
  occurred_at: "2026-10-30T04:00:00.000Z",
  summary: "Call PIC",
  outcome: "Discuss package",
  notes: "",
  next_action: null,
  follow_up_date: null,
  latitude: null,
  longitude: null,
  accuracy_m: null,
  gps_captured_at: null,
  photo_sha256: null,
};
test("visits require selfie and complete GPS; other communication types reject location proof", () => {
  assert.equal(activitySchema.safeParse(base).success, true);
  assert.equal(
    activitySchema.safeParse({ ...base, communication_type: "visit" }).success,
    false,
  );
  const visit = {
    ...base,
    communication_type: "visit",
    latitude: 0,
    longitude: 0,
    accuracy_m: 12,
    gps_captured_at: base.occurred_at,
    photo_sha256: "a".repeat(64),
  };
  assert.equal(activitySchema.safeParse(visit).success, true);
  for (const override of [
    { photo_sha256: null },
    { latitude: null },
    { longitude: 181 },
    { accuracy_m: -1 },
    { latitude: NaN },
  ])
    assert.equal(
      activitySchema.safeParse({ ...visit, ...override }).success,
      false,
    );
  assert.equal(
    activitySchema.safeParse({ ...visit, communication_type: "email" }).success,
    false,
  );
});
test("follow-up is all-or-nothing and client scope identifiers must be UUIDs", () => {
  assert.equal(
    activitySchema.safeParse({ ...base, next_action: "Follow up" }).success,
    false,
  );
  assert.equal(
    activitySchema.safeParse({
      ...base,
      next_action: "Follow up",
      follow_up_date: "2026-11-01",
    }).success,
    true,
  );
  assert.equal(
    activitySchema.safeParse({ ...base, contact_id: "invalid" }).success,
    false,
  );
});
test("local activity timestamps use property zone rather than browser timezone", () => {
  assert.equal(
    localActivityTime("2026-10-30T10:00", "Asia/Jakarta"),
    "2026-10-30T03:00:00.000Z",
  );
  assert.equal(
    localActivityTime("2026-10-30T10:00", "Asia/Makassar"),
    "2026-10-30T02:00:00.000Z",
  );
  assert.throws(() => localActivityTime("2026-02-30T10:00", "Asia/Jakarta"));
  assert.throws(() => localActivityTime("2026-10-30T10:00", "Unknown"));
  assert.equal(
    activityFiltersSchema.safeParse({ from: "2026-11-02", until: "2026-11-01" })
      .success,
    false,
  );
});
