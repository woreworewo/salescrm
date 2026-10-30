import sharp from "sharp";
import { MAX_SELFIE_BYTES } from "./activity-models";

export async function normalizeSelfie(input: Uint8Array) {
  if (!input.byteLength || input.byteLength > MAX_SELFIE_BYTES)
    throw new Error("Selfie hasil kompresi maksimal 200 KB.");
  const options = {
    limitInputPixels: 24000000,
    failOn: "error" as const,
    animated: false,
  };
  const metadata = await sharp(input, options).metadata();
  if (
    metadata.format !== "jpeg" ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("Selfie harus JPEG yang valid.");
  for (const size of [1280, 960, 800]) {
    const bytes = await sharp(input, options)
      .rotate()
      .resize({
        width: size,
        height: size,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    if (bytes.byteLength <= MAX_SELFIE_BYTES) return bytes;
  }
  throw new Error(
    "Selfie masih terlalu besar. Ambil ulang dengan latar yang lebih sederhana.",
  );
}
