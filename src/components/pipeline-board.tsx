"use client";
import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Columns3, List, CalendarDays, X } from "lucide-react";
import { moveOpportunity } from "@/app/actions";
import {
  STAGES,
  STAGE_LABELS,
  type Opportunity,
  type Stage,
  type Workspace,
  type ActionState,
  INITIAL_STATE,
} from "@/lib/models";
import { cn, dateLabel, money, today } from "@/lib/utils";
import { Feedback } from "./forms";
import { Button } from "./ui/button";

export function PipelineBoard({ workspace: w }: { workspace: Workspace }) {
  const [view, setView] = useState<"board" | "table">("board");
  const [owner, setOwner] = useState("");
  const [offering, setOffering] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [feedback, setFeedback] = useState<ActionState>(INITIAL_STATE);
  const [lost, setLost] = useState<Opportunity | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [opportunities, optimisticMove] = useOptimistic(
    w.opportunities,
    (items, change: { id: string; stage: Stage }) =>
      items.map((o) =>
        o.id === change.id ? { ...o, stage: change.stage } : o,
      ),
  );
  const filtered = opportunities.filter(
    (o) =>
      (!owner || o.owner_id === owner) &&
      (!offering || o.offering_type === offering) &&
      (!from || o.target_close >= from) &&
      (!until || o.target_close <= until),
  );

  function move(opportunity: Opportunity, stage: Stage, lostReason = "") {
    if (pending || opportunity.stage === stage) return;
    if (w.demo) {
      setFeedback({
        status: "error",
        message: "Demo hanya-baca. Perubahan tahap dinonaktifkan.",
      });
      return;
    }
    if (stage === "lost" && !lostReason) {
      setLost(opportunity);
      setReason("");
      return;
    }
    startTransition(async () => {
      optimisticMove({ id: opportunity.id, stage });
      try {
        const result = await moveOpportunity({
          id: opportunity.id,
          stage,
          version: opportunity.version,
          reason: lostReason,
        });
        setFeedback(result);
        if (result.status === "success") setLost(null);
      } catch {
        setFeedback({
          status: "error",
          message:
            "Koneksi terputus. Perubahan belum dikonfirmasi; muat ulang sebelum mencoba lagi.",
        });
      }
    });
  }

  function StageSelect({ opportunity }: { opportunity: Opportunity }) {
    return (
      <label className="mt-4 text-[10px] text-slate-400">
        Pindahkan tahap
        <select
          aria-label={`Tahap ${opportunity.name}`}
          value={opportunity.stage}
          disabled={w.demo || pending}
          className="!py-1.5 !text-xs"
          onChange={(e) => move(opportunity, e.target.value as Stage)}
        >
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="space-y-5">
      <Feedback state={feedback} />
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="min-w-32 flex-1">
          Sales
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Semua sales</option>
            {w.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-32 flex-1">
          Offering
          <select
            value={offering}
            onChange={(e) => setOffering(e.target.value)}
          >
            <option value="">Semua offering</option>
            <option value="room">Kamar</option>
            <option value="meeting">Meeting</option>
            <option value="package">Paket</option>
          </select>
        </label>
        <label className="min-w-36 flex-1">
          Closing dari
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="min-w-36 flex-1">
          Closing sampai
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <div
          className="flex rounded-lg border border-slate-200 p-1"
          aria-label="Tampilan pipeline"
        >
          <Button
            size="sm"
            variant={view === "board" ? "default" : "ghost"}
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <Columns3 />
            Board
          </Button>
          <Button
            size="sm"
            variant={view === "table" ? "default" : "ghost"}
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <List />
            Table
          </Button>
        </div>
      </div>
      {view === "board" ? (
        <div
          className="overflow-x-auto pb-4"
          tabIndex={0}
          aria-label="Board pipeline, gulir horizontal untuk melihat semua tahap"
        >
          <div className="grid min-w-[1350px] grid-cols-5 gap-4">
            {STAGES.map((stage, i) => {
              const items = filtered.filter((o) => o.stage === stage);
              return (
                <section
                  key={stage}
                  aria-label={STAGE_LABELS[stage]}
                  onDragOver={(e) => {
                    if (!w.demo && !pending) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const item = opportunities.find(
                      (o) => o.id === e.dataTransfer.getData("text/plain"),
                    );
                    if (item) move(item, stage);
                  }}
                  className="min-h-[460px] rounded-xl bg-slate-100/80 p-3"
                >
                  <div className="mb-4 px-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          [
                            "bg-slate-400",
                            "bg-blue-500",
                            "bg-amber-500",
                            "bg-emerald-600",
                            "bg-rose-400",
                          ][i],
                        )}
                      />
                      <h2 className="text-xs font-semibold">
                        {STAGE_LABELS[stage]}
                      </h2>
                      <span className="ml-auto rounded bg-white px-2 py-0.5 text-[10px] text-slate-500">
                        {items.length}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {money(
                        items.reduce(
                          (sum, o) => sum + Number(o.estimated_value),
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {items.map((o) => {
                      const company = w.companies.find(
                        (c) => c.id === o.company_id,
                      );
                      const active = !["won", "lost"].includes(o.stage);
                      const overdue = active && o.follow_up_date < today();
                      const aging =
                        active &&
                        Date.now() - new Date(o.stage_entered_at).getTime() >
                          14 * 86400000;
                      return (
                        <article
                          key={o.id}
                          draggable={!w.demo && !pending}
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", o.id)
                          }
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">
                            {o.offering_type === "room"
                              ? "Kamar"
                              : o.offering_type === "meeting"
                                ? "Meeting"
                                : "Paket"}
                          </p>
                          <h3 className="mt-2 text-sm leading-5 font-semibold">
                            <Link
                              href={`/clients/${o.company_id}`}
                              className="hover:text-emerald-800"
                            >
                              {o.name}
                            </Link>
                          </h3>
                          <p className="mt-2 text-xs text-slate-400">
                            {company?.name}
                          </p>
                          <p className="mt-4 text-base font-semibold">
                            {money(o.estimated_value)}
                          </p>
                          <p className="mt-3 text-xs leading-5 text-slate-500">
                            {o.next_action}
                          </p>
                          <div className="mt-4 border-t border-slate-100 pt-3">
                            <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <CalendarDays size={12} />
                              Closing {dateLabel(o.target_close)}
                            </p>
                            <p
                              className={cn(
                                "mt-2 text-[10px]",
                                overdue
                                  ? "font-semibold text-rose-700"
                                  : "text-slate-400",
                              )}
                            >
                              {overdue ? "Overdue · " : "Follow-up · "}
                              {dateLabel(o.follow_up_date)}
                            </p>
                            {aging && (
                              <p className="mt-2 text-[10px] font-medium text-amber-700">
                                Lebih dari 14 hari pada tahap ini
                              </p>
                            )}
                            <p className="mt-3 text-[10px] text-slate-500">
                              {w.profiles.find((p) => p.id === o.owner_id)
                                ?.full_name || "Sales"}
                            </p>
                          </div>
                          <StageSelect opportunity={o} />
                        </article>
                      );
                    })}
                    {!items.length && (
                      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-9 text-center text-xs text-slate-400">
                        Belum ada peluang
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table>
            <thead>
              <tr>
                <th>Peluang</th>
                <th>Client</th>
                <th>Nilai</th>
                <th>Target closing</th>
                <th>Tahap</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{o.name}</td>
                  <td>
                    <Link
                      href={`/clients/${o.company_id}`}
                      className="text-slate-500 hover:underline"
                    >
                      {w.companies.find((c) => c.id === o.company_id)?.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    {money(o.estimated_value)}
                  </td>
                  <td className="whitespace-nowrap">
                    {dateLabel(o.target_close)}
                  </td>
                  <td className="min-w-44">
                    <StageSelect opportunity={o} />
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Tidak ada peluang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">
        {filtered.length} peluang · Aging awal: 14 hari · Nilai dalam IDR ·
        Gunakan menu pada kartu sebagai alternatif drag-and-drop.
      </p>
      <Dialog.Root
        open={Boolean(lost)}
        onOpenChange={(open) => {
          if (!open && !pending) setLost(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/35" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
            <Dialog.Title className="pr-8 text-lg font-semibold">
              Tandai peluang sebagai Lost
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-500">
              Catat alasan untuk {lost?.name}. Riwayat perubahan tetap
              tersimpan.
            </Dialog.Description>
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (lost) move(lost, "lost", reason);
              }}
            >
              <label>
                Alasan Lost
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </label>
              <Feedback state={feedback} />
              <Button disabled={pending} type="submit">
                {pending ? "Menyimpan…" : "Simpan alasan"}
              </Button>
            </form>
            <Dialog.Close
              className="absolute top-5 right-5 rounded p-1 text-slate-400"
              aria-label="Tutup"
              disabled={pending}
            >
              <X size={18} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
