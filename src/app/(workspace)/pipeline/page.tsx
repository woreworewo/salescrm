import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeading } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { PipelineBoard } from "@/components/pipeline-board";
import { getWorkspace } from "@/lib/workspace";
export default async function PipelinePage() {
  const w = await getWorkspace();
  return (
    <>
      <PageHeading
        eyebrow="Every opportunity counts"
        title="Sales pipeline"
        description="Satu kartu untuk setiap peluang. Jaga langkah berikutnya tetap jelas."
        action={
          <Button asChild>
            <Link href="/pipeline/new">
              <Plus />
              Tambah peluang
            </Link>
          </Button>
        }
      />
      <PipelineBoard workspace={w} />
    </>
  );
}
