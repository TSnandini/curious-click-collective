import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Minus, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Code, LoadBar, PageHeader, PriorityBadge, StatusBadge, formatTime } from "@/components/tracker/badges";
import { cn } from "@/lib/utils";
import { canTransition, CATEGORIES, type Status } from "@/lib/complaint/constants";
import { updateHandlerFn, updateStatusFn } from "@/lib/reports.functions";
import { systemQuery } from "@/lib/queries";

export const Route = createFileRoute("/handler")({
  head: () => ({
    meta: [
      { title: "Handler dashboard — Kitchen Ticket" },
      { name: "description", content: "Work assigned complaints, update status and set availability and capacity." },
      { property: "og:title", content: "Handler dashboard — Kitchen Ticket" },
      { property: "og:description", content: "Work assigned complaints, update status and set availability and capacity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(systemQuery),
  component: HandlerPage,
});

function HandlerPage() {
  const { data } = useSuspenseQuery(systemQuery);
  const qc = useQueryClient();
  const [selected, setSelected] = useState(data.handlers[0]?.id ?? "");
  const h = data.handlers.find((x) => x.id === selected) ?? data.handlers[0];
  const [capacity, setCapacity] = useState(h?.capacity ?? 0);
  useEffect(() => setCapacity(h?.capacity ?? 0), [h?.id, h?.capacity]);

  const updHandler = useServerFn(updateHandlerFn);
  const updStatus = useServerFn(updateStatusFn);

  const handlerMut = useMutation({
    mutationFn: (v: { available: boolean; capacity: number }) => updHandler({ data: { id: h.id, ...v } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["system"] });
      toast.success(r.dequeued.length ? `Saved — ${r.dequeued.length} queued report(s) dispatched` : "Handler updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: Status }) => updStatus({ data: { ...v, note: "" } }),
    onSuccess: (r, v) => {
      qc.invalidateQueries({ queryKey: ["system"] });
      qc.invalidateQueries({ queryKey: ["report", v.id] });
      toast.success(
        v.status === "resolved"
          ? r.dequeued.length ? `Resolved — ${r.dequeued.length} queued report(s) picked up` : "Marked resolved"
          : "Marked in progress",
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!h) return null;
  const mine = data.reports.filter((r) => r.handler_id === h.id);
  const active = mine.filter((r) => r.status !== "resolved").sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));
  const done = mine.filter((r) => r.status === "resolved");
  const cats = h.is_escalation ? ["Any (escalations)"] : CATEGORIES.filter((c) => data.routing.some((r) => r.category === c && (r.primary_handler === h.id || r.backup_handler === h.id)));
  const primaryFor = data.routing.filter((r) => r.primary_handler === h.id).map((r) => r.category);

  return (
    <div>
      <PageHeader eyebrow="Handler dashboard" title="Today's tickets">
        Pick a handler to see their assigned complaints, move them along, and set how many they can take on.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="ticket h-fit divide-y divide-border overflow-hidden">
          {data.handlers.map((x) => (
            <button
              key={x.id}
              onClick={() => setSelected(x.id)}
              className={cn("block w-full px-4 py-3 text-left transition-colors hover:bg-secondary/50", x.id === h.id && "bg-secondary")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{x.name}</span>
                <span className={cn("size-2 shrink-0 rounded-full", x.available ? "bg-success" : "bg-muted-foreground/40")} />
              </div>
              <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">{x.id} · {x.zone}</p>
              <LoadBar load={x.load} capacity={x.capacity} available={x.available} />
            </button>
          ))}
        </aside>

        <section className="space-y-6">
          <div className="ticket p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{h.id}</p>
                <h2 className="text-2xl font-semibold">{h.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Zone <strong className="text-foreground">{h.zone}</strong> · Categories: {cats.join(", ")}
                  {primaryFor.length > 0 && <> · Primary for {primaryFor.join(", ")}</>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <Switch
                    checked={h.available}
                    disabled={handlerMut.isPending}
                    onCheckedChange={(v) => handlerMut.mutate({ available: v, capacity: h.capacity })}
                  />
                  {h.available ? "Available" : "Unavailable"}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Capacity</span>
                  <Button size="icon" variant="outline" className="size-8" onClick={() => setCapacity((c) => Math.max(0, c - 1))}><Minus /></Button>
                  <span className="w-6 text-center font-mono font-bold">{capacity}</span>
                  <Button size="icon" variant="outline" className="size-8" onClick={() => setCapacity((c) => Math.min(50, c + 1))}><Plus /></Button>
                  <Button
                    size="sm"
                    disabled={capacity === h.capacity || handlerMut.isPending}
                    onClick={() => handlerMut.mutate({ available: h.available, capacity })}
                  >
                    {handlerMut.isPending && <Loader2 className="animate-spin" />} Save
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-5 max-w-md">
              <p className="mb-1 text-xs text-muted-foreground">Current load</p>
              <LoadBar load={h.load} capacity={h.capacity} available={h.available} />
            </div>
          </div>

          <div className="ticket overflow-hidden">
            <p className="eyebrow p-4">Assigned reports ({active.length})</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Report</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Zone</th>
                    <th className="px-4 py-2 font-medium">Priority</th>
                    <th className="px-4 py-2 font-medium">Submitted</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {active.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-4 py-3">
                        <Code>{r.id}</Code>
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                      </td>
                      <td className="px-4 py-3">{r.category}{r.classification_conflict && <span className="ml-1 text-primary" title="Mixed signals">⚠</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.zone}<br /><span className="text-muted-foreground">{r.zone_code}</span></td>
                      <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">{formatTime(r.created_at)}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canTransition(r.status, "in_progress") && (
                            <Button size="sm" variant="outline" disabled={statusMut.isPending} onClick={() => statusMut.mutate({ id: r.id, status: "in_progress" })}>
                              <Play /> Start
                            </Button>
                          )}
                          {canTransition(r.status, "resolved") && (
                            <Button size="sm" disabled={statusMut.isPending} onClick={() => statusMut.mutate({ id: r.id, status: "resolved" })}>
                              <CheckCircle2 /> Resolve
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!active.length && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No open tickets. Nice work.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {done.length > 0 && (
            <div className="ticket p-4">
              <p className="eyebrow mb-3">Resolved ({done.length})</p>
              <div className="flex flex-wrap gap-2">
                {done.map((r) => <Code key={r.id}>{r.id}</Code>)}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
