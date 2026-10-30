import { getPropertyContext } from "@/lib/access";
import { isConfigured, isDemo } from "@/lib/supabase/server";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const notFound = () =>
  new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success || isDemo() || !isConfigured()) return notFound();
  const c = await getPropertyContext();
  const { data, error } = await c.db
    .from("sales_activities")
    .select("photo_path")
    .eq("id", parsed.data)
    .eq("tenant_id", c.tenant.id)
    .eq("property_id", c.property.id)
    .eq("status", "recorded")
    .maybeSingle();
  if (error || !data?.photo_path) return notFound();
  const photo = await c.db.storage
    .from("activity-selfies")
    .download(data.photo_path);
  if (photo.error || !photo.data) return notFound();
  return new Response(photo.data, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline; filename=visit-selfie.jpg",
    },
  });
}
