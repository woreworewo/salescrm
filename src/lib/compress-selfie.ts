import { MAX_SELFIE_BYTES } from "./activity-models";

export async function compressSelfie(file: File): Promise<File> {
  if (
    file.size > 10 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new Error("Pilih foto JPEG/PNG/WebP maksimal 10 MB.");
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 24000000)
      throw new Error(
        "Resolusi terlalu besar. Gunakan foto maksimal 24 megapixel.",
      );
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak mendukung kompresi foto.");
    for (const size of [1280, 960, 800]) {
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (blob && blob.size <= MAX_SELFIE_BYTES)
          return new File([blob], "selfie.jpg", { type: "image/jpeg" });
      }
    }
    throw new Error(
      "Foto belum dapat diperkecil. Ambil ulang selfie dengan resolusi lebih kecil.",
    );
  } finally {
    image.close();
  }
}
