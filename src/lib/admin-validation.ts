import { z } from "zod";
export const propertySchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/),
  timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
});
export const invitationSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  full_name: z.string().trim().min(1).max(200),
  role: z.enum(["tenant-admin", "property-admin", "sales"]),
});
