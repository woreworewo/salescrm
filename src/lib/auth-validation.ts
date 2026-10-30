import { z } from "zod";

export const authLinkSchema = z.object({
  token_hash: z.string().regex(/^[a-zA-Z0-9_-]{20,512}$/),
  type: z.enum(["magiclink", "recovery"]),
});
export const passwordSchema = z
  .object({
    password: z.string().min(12, "Gunakan minimal 12 karakter.").max(128),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Konfirmasi kata sandi tidak sama.",
    path: ["confirmation"],
  });

export function appOrigin(value: string | undefined) {
  if (!value) throw new Error("CRM_APP_URL belum dikonfigurasi.");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  )
    throw new Error("CRM_APP_URL harus berupa origin HTTPS atau localhost.");
  return url.origin;
}

export function authLink(
  origin: string,
  tokenHash: string,
  type: "magiclink" | "recovery",
) {
  const parsed = authLinkSchema.parse({ token_hash: tokenHash, type });
  const link = new URL("/auth/confirm", appOrigin(origin));
  link.searchParams.set("token_hash", parsed.token_hash);
  link.searchParams.set("type", parsed.type);
  return link.toString();
}
