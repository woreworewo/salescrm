import assert from "node:assert/strict";
import test from "node:test";
import {
  appOrigin,
  authLink,
  authLinkSchema,
  passwordSchema,
} from "./auth-validation";
test("auth links accept only fixed flows and trusted configured origins", () => {
  assert.equal(appOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  for (const origin of [
    undefined,
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/redirect",
    "https://example.com?next=evil",
  ])
    assert.throws(() => appOrigin(origin));
  assert.equal(
    authLinkSchema.safeParse({ token_hash: "a".repeat(64), type: "magiclink" })
      .success,
    true,
  );
  assert.equal(
    authLinkSchema.safeParse({ token_hash: "a".repeat(64), type: "signup" })
      .success,
    false,
  );
  assert.match(
    authLink("https://crm.example.com", "a".repeat(64), "recovery"),
    /^https:\/\/crm.example.com\/auth\/confirm\?/,
  );
});
test("password update requires a long matching confirmation", () => {
  assert.equal(
    passwordSchema.safeParse({
      password: "a long passphrase",
      confirmation: "a long passphrase",
    }).success,
    true,
  );
  assert.equal(
    passwordSchema.safeParse({ password: "short", confirmation: "short" })
      .success,
    false,
  );
  assert.equal(
    passwordSchema.safeParse({
      password: "a long passphrase",
      confirmation: "different phrase",
    }).success,
    false,
  );
});
