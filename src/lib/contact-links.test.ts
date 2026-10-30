import assert from "node:assert/strict";
import test from "node:test";
import { whatsappLink, mapsLink } from "./contact-links";

test("WhatsApp normalizes Indonesian mobile numbers and rejects unsafe or incomplete input", () => {
  assert.equal(whatsappLink("0812-3456-7890"), "https://wa.me/6281234567890");
  assert.equal(
    whatsappLink("+62 812 3456 7890"),
    "https://wa.me/6281234567890",
  );
  for (const value of ["", "123", "javascript:alert(1)", "+62812abc7890"])
    assert.equal(whatsappLink(value), null);
});

test("Maps handles empty addresses and encodes address content", () => {
  assert.equal(mapsLink("", ""), null);
  assert.equal(
    mapsLink("Jl. A & B", "Jakarta"),
    "https://www.google.com/maps/search/?api=1&query=Jl.%20A%20%26%20B%2C%20Jakarta",
  );
});
