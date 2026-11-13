import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Code, LoadBar, PageHeader, PriorityBadge, StatusBadge, formatTime } from "@/components/tracker/badges";
import { cn } from "@/lib/utils";
import { CATEGORIES, ZONES } from "@/lib/complaint/constants";
import { orderQueue } from "@/lib/complaint/dispatch";
import { systemQuery, type HandlerRow } from "@/lib/queries";

export const Route = createFileRoute("/routing")({
  head: () => ({
    meta: [
      { title: "Routing management — Kitchen Ticket" },
      { name: "description", content: "Routing table, handler loads, backup assignments, queue and escalation decisions." },
      { property: "og:title", content: "Routing management — Kitchen Ticket" },
      { property: "og:description", content: "Routing table, handler loads, backup assignments, queue and escalation decisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(systemQuery),
  component: RoutingPage,
});

function HandlerChip({ h, role }: { h?: HandlerRow; role: "P" | "B" }) {
  if (!h) return null;
  const full = h.load >= h.capacity;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn("grid size-4 place-items-center rounded font-mono text-[9px] font-bold", role === "P" ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground")}>{role}</span>
      <span className={cn("font-mono", !h.available && "line-through text-muted-foreground", h.available && full && "text-primary")}>{h.id}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{h.load}/{h.capacity}</span>
    </div>
  );
}

function RoutingPage() {
  const { data } = useSuspenseQuery(systemQuery);
  const byId = new Map(data.handlers.map((h) => [h.id, h]));
  const queue = orderQueue(data.reports.filter((r) => r.status === "queued"));
  const escalations = data.reports.filter((r) => r.assignment_type === "escalation");
  const overrides = data.reports.filter((r) => r.priority_override);
  const backups = data.reports.filter((r) => r.assignment_type === "backup" && r.status !== "resolved");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Routing management" title="Who gets which ticket">
        Each zone and category maps to a primary handler and a backup. Struck-through handlers are unavailable; red means at capacity.
      </PageHeader>

      <div className="ticket overflow-hidden">
        <p className="eyebrow p-4">Routing table</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Zone</th>
                {CATEGORIES.map((c) => <th key={c} className="px-4 py-2 font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ZONES.map((z) => (
                <tr key={z}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{z}</td>
                  {CATEGORIES.map((c) => {
                    const e = data.routing.find((r) => r.zone === z && r.category === c);
                    return (
                      <td key={c} className="space-y-1 px-4 py-3">
                        {e ? <><HandlerChip h={byId.get(e.primary_handler)} role="P" /><HandlerChip h={byId.get(e.backup_handler)} role="B" /></> : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-primary/5">
                <td className="px-4 py-3 font-mono text-xs font-bold text-primary">UNKNOWN</td>
                <td colSpan={5} className="px-4 py-3 text-xs text-primary">No entry → escalation desk (H-ESC)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ticket p-5">
          <p className="eyebrow mb-4">Current handler loads</p>
          <ul className="space-y-3">
            {data.handlers.map((h) => (
              <li key={h.id} className="grid grid-cols-[1fr_1.2fr] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{h.id} · {h.zone} · {h.available ? "available" : "unavailable"}</p>
                </div>
                <LoadBar load={h.load} capacity={h.capacity} available={h.available} />
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="ticket p-5">
            <p className="eyebrow mb-3">Queued reports ({queue.length}) — priority, then oldest first</p>
            {queue.length ? (
              <ol className="space-y-2">
                {queue.map((r, i) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                    <Code>{r.id}</Code>
                    <PriorityBadge priority={r.priority} />
                    <span className="text-muted-foreground">{r.zone} / {r.category}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{formatTime(r.created_at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Queue is empty — every report has a handler. Make a primary and backup unavailable on the Handlers page to see queueing.</p>
            )}
          </div>

          <div className="ticket p-5">
            <p className="eyebrow mb-3">Backup assignments ({backups.length})</p>
            {backups.length ? (
              <ul className="space-y-2 text-sm">
                {backups.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <Code>{r.id}</Code><span className="text-muted-foreground">{r.routing_note}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No open fallback assignments.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DecisionList title={`Escalation decisions (${escalations.length})`} items={escalations.map((r) => ({ r, why: r.routing_note }))} />
        <DecisionList title={`Priority overrides (${overrides.length})`} items={overrides.map((r) => ({ r, why: r.priority_override! }))} />
      </div>
    </div>
  );
}

function DecisionList({ title, items }: { title: string; items: { r: { id: string; priority: number; status: import("@/lib/complaint/constants").Status }; why: string }[] }) {
  return (
    <div className="ticket p-5">
      <p className="eyebrow mb-3">{title}</p>
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map(({ r, why }) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <Code>{r.id}</Code>
              <PriorityBadge priority={r.priority} />
              <StatusBadge status={r.status} />
              <span className="w-full text-muted-foreground">{why}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">None yet.</p>}
    </div>
  );
}
