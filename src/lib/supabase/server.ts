import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isDemo() {
  return (
    process.env.CRM_DEMO_MODE === "true" &&
    process.env.VERCEL_ENV !== "production"
  );
}

export async function createClient() {
  if (!isConfigured()) throw new Error("Supabase belum dikonfigurasi.");
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Session refresh is handled by proxy during rendering. */
          }
        },
      },
    },
  );
}
