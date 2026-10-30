import { Shell } from "@/components/shell";
import { getWorkspace } from "@/lib/workspace";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await getWorkspace();
  return <Shell workspace={workspace}>{children}</Shell>;
}
