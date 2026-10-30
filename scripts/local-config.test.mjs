import assert from "node:assert/strict";
import test from "node:test";
import { assertLocalService, localEnvironment } from "./local-config.mjs";
test("local setup refuses hosted and alternate database targets", () => {
  for (const url of [
    "https://project.supabase.co",
    "http://localhost:54321",
    "http://127.0.0.1:9000",
  ])
    assert.throws(() => assertLocalService(url, 54321));
  assert.equal(
    assertLocalService("http://127.0.0.1:54321", 54321).hostname,
    "127.0.0.1",
  );
});
test("generated environment isolates local services and rejects multiline credential injection", () => {
  const status = {
    API_URL: "http://127.0.0.1:54321",
    DB_URL: "postgresql://postgres:local@127.0.0.1:54322/postgres",
    ANON_KEY: "test-public-key",
    SERVICE_ROLE_KEY: "test-server-key",
  };
  const result = localEnvironment(status, "local-test-password");
  assert.match(result, /CRM_DEMO_MODE=false/);
  assert.match(result, /CRM_LOCAL_ONLY=true/);
  assert.doesNotMatch(result, /NEXT_PUBLIC_.*SERVICE_ROLE/);
  assert.throws(() =>
    localEnvironment(
      { ...status, SERVICE_ROLE_KEY: "bad\nNEXT_PUBLIC_SECRET=bad" },
      "password",
    ),
  );
});
