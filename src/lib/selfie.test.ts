import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeSelfie } from "./selfie";
import { MAX_SELFIE_BYTES } from "./activity-models";
test("selfie normalization bounds dimensions/size, removes EXIF and is deterministic for retries", async () => {
  const input = await sharp({
    create: { width: 1800, height: 1400, channels: 3, background: "#557799" },
  })
    .withMetadata({ exif: { IFD0: { Artist: "Fixture artist" } } })
    .jpeg()
    .toBuffer();
  const output = await normalizeSelfie(input);
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "jpeg");
  assert((meta.width ?? Infinity) <= 1280);
  assert(output.length <= MAX_SELFIE_BYTES);
  assert.equal(meta.exif, undefined);
  assert.deepEqual(await normalizeSelfie(input), output);
});
test("server rejects invalid image content and oversized input regardless of declared filename", async () => {
  await assert.rejects(
    normalizeSelfie(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")),
  );
  await assert.rejects(normalizeSelfie(Buffer.alloc(MAX_SELFIE_BYTES + 1)));
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(normalizeSelfie(png));
});
