"use client";
import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { completeTask } from "@/app/actions";
import { type Workspace, type ActionState, INITIAL_STATE } from "@/lib/models";
import { dateLabel, today } from "@/lib/utils";
import { Feedback } from "./forms";
export function TaskList({ workspace: w }: { workspace: Workspace }) {
  const [feedback, setFeedback] = useState<ActionState>(INITIAL_STATE);
  const [pending, startTransition] = useTransition();
  const [tasks, setOptimistic] = useOptimistic(
    w.tasks,
    (items, changed: { id: string; completed: boolean }) =>
      items.map((t) =>
        t.id === changed.id ? { ...t, completed: changed.completed } : t,
      ),
  );
  return (
    <div className="space-y-4">
      <Feedback state={feedback} />
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {tasks.map((task) => (
          <article key={task.id} className="flex items-start gap-4 p-5">
            <input
              type="checkbox"
              checked={task.completed}
              disabled={w.demo || pending}
              aria-label={`Selesaikan ${task.title}`}
              className="mt-1 shrink-0"
              onChange={(e) => {
                const completed = e.target.checked;
                startTransition(async () => {
                  setOptimistic({ id: task.id, completed });
                  try {
                    setFeedback(
                      await completeTask({
                        property_id: w.property.id,
                        id: task.id,
                        version: task.version,
                        completed,
                      }),
                    );
                  } catch {
                    setFeedback({
                      status: "error",
                      message:
                        "Koneksi terputus. Muat ulang sebelum mencoba lagi.",
                    });
                  }
                });
              }}
            />
            <div className="min-w-0 flex-1">
              <h2
                className={`font-medium ${task.completed ? "text-slate-400 line-through" : ""}`}
              >
                {task.title}
              </h2>
              <Link
                href={`/clients/${task.company_id}`}
                className="mt-1 inline-block text-xs text-slate-400 hover:text-emerald-800"
              >
                {w.companies.find((c) => c.id === task.company_id)?.name}
              </Link>
              <p
                className={`mt-3 text-xs ${!task.completed && task.due_date < today(w.property.timezone) ? "text-rose-700" : "text-slate-400"}`}
              >
                {task.completed
                  ? "Selesai · "
                  : task.due_date < today(w.property.timezone)
                    ? "Overdue · "
                    : "Tenggat · "}
                {dateLabel(task.due_date)}
              </p>
            </div>
          </article>
        ))}
        {!tasks.length && (
          <p className="p-12 text-center text-sm text-slate-400">
            Belum ada task. Jadwalkan tindak lanjut pertama.
          </p>
        )}
      </div>
    </div>
  );
}
