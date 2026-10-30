import { PageHeading } from "@/components/shell";
import { TaskForm } from "@/components/forms";
import { TaskList } from "@/components/task-list";
import { getWorkspace } from "@/lib/workspace";
export default async function TasksPage() {
  const w = await getWorkspace();
  return (
    <>
      <PageHeading
        eyebrow="Keep the conversation going"
        title="Follow-up tasks"
        description="Tindak lanjut terjadwal, dengan satu penanggung jawab yang jelas."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <TaskList workspace={w} />
        <TaskForm
          companies={w.companies}
          demo={w.demo}
          propertyId={w.property.id}
        />
      </div>
    </>
  );
}
