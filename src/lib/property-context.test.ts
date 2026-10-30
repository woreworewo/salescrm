import assert from "node:assert/strict";
import test from "node:test";
import { matchesProperty, selectProperty } from "./property-context";
import { demoWorkspace } from "./demo";

test("property selection only accepts authorized options and rejects revoked cookie IDs", () => {
  const { propertyOptions } = demoWorkspace();
  assert.equal(selectProperty(propertyOptions)?.id, propertyOptions[0].id);
  assert.equal(
    selectProperty(propertyOptions, propertyOptions[1].id)?.id,
    propertyOptions[1].id,
  );
  assert.equal(selectProperty(propertyOptions, "unauthorized"), null);
  assert.equal(selectProperty([]), null);
  assert.equal(
    matchesProperty(propertyOptions[0].id, propertyOptions[1].id),
    false,
  );
  assert.equal(matchesProperty(propertyOptions[0].id, null), false);
  assert.equal(
    matchesProperty(propertyOptions[0].id, propertyOptions[0].id),
    true,
  );
});

test("demo shares clients within tenant but isolates opportunities and tasks per property", () => {
  const first = demoWorkspace();
  const second = demoWorkspace(first.propertyOptions[1].id);
  assert.deepEqual(
    first.companies,
    second.companies.map((c, i) => ({
      ...c,
      created_at: first.companies[i].created_at,
    })),
  );
  assert.notEqual(first.property.id, second.property.id);
  assert(first.opportunities.every((o) => o.property_id === first.property.id));
  assert(
    second.opportunities.every((o) => o.property_id === second.property.id),
  );
  assert(first.tasks.every((t) => t.property_id === first.property.id));
  assert(second.tasks.every((t) => t.property_id === second.property.id));
  assert(
    first.opportunities.every(
      (o) => !second.opportunities.some((other) => other.id === o.id),
    ),
  );
});
