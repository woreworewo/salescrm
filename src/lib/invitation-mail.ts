import "server-only";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { z } from "zod";
import { appOrigin, authLink } from "./auth-validation";

export function invitationMailConfigured() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SMTP_HOST &&
    process.env.SMTP_FROM &&
    process.env.CRM_APP_URL,
  );
}

export async function deliverInvitation(
  email: string,
  tenantName: string,
  propertyName: string,
  onSending: () => void,
) {
  const origin = appOrigin(process.env.CRM_APP_URL);
  const recipient = z.email().parse(email);
  const sender = z.email().parse(process.env.SMTP_FROM);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: recipient,
    options: { redirectTo: `${origin}/auth/confirm` },
  });
  if (error || !data.properties?.hashed_token)
    throw new Error("Account link could not be generated");
  const link = authLink(origin, data.properties.hashed_token, "magiclink");
  const smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .parse(process.env.SMTP_PORT || "54325"),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  onSending();
  const result = await smtp.sendMail({
    from: { name: "Salesroom", address: sender },
    to: recipient,
    subject: `Undangan Salesroom · ${tenantName}`,
    text: `Anda diundang ke ${tenantName} / ${propertyName}.\n\nMasuk dengan tautan akun ini:\n${link}\n\nSetelah masuk, periksa rincian dan terima undangan. Tautan akun berlaku terbatas; minta email baru jika kedaluwarsa. Hak akses hanya diberikan setelah undangan diterima. Abaikan bila tidak mengenali undangan ini.`,
  });
  if (!result.accepted.length) throw new Error("SMTP did not accept recipient");
}
