import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Code, PageHeader, PriorityBadge, StatCard, StatusBadge, formatTime } from "@/components/tracker/badges";
import { cn } from "@/lib/utils";
import { statusGroup, type Status } from "@/lib/complaint/constants";
import { reportIdDFA, simulate } from "@/lib/complaint/dfa";
import { lookupReportFn } from "@/lib/reports.functions";
import { systemQuery } from "@/lib/queries";

export const Route = createFileRoute("/track")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s["id"] === "string" && s["id"] ? { id: s["id"].slice(0, 30) } : {},
  head: () => ({
    meta: [
      { title: "Track your report — Kitchen Ticket" },
      { name: "description", content: "See report totals and look up any complaint by its report ID." },
      { property: "og:title", content: "Track your report — Kitchen Ticket" },
      { property: "og:description", content: "See report totals and look up any complaint by its report ID." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(systemQuery),
  component: TrackPage,
});

const FILTERS = ["all", "pending", "assigned", "resolved"] as const;

function TrackPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/track" });
  const { data } = useSuspenseQuery(systemQuery);
  const [q, setQ] = useState(id ?? "");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [err, setErr] = useState<string | null>(null);

  const lookup = useQuery({
    queryKey: ["report", id],
    queryFn: () => lookupReportFn({ data: { id: id! } }),
    enabled: !!id,
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim().toUpperCase();
    const sim = simulate(reportIdDFA, v);
    if (!sim.accepted) {
      setErr(`Report IDs look like ${reportIdDFA.example}. ${sim.reason}.`);
      return;
    }
    setErr(null);
    navigate({ search: { id: v } });
  };

  const rows = data.reports.filter((r) => filter === "all" || statusGroup(r.status) === filter);
  const handlerName = (hid: string | null) => data.handlers.find((h) => h.id === hid)?.name ?? "—";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="User dashboard" title="Track a report">
        Look up any complaint by its report ID to see where it stands and who's handling it.
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total reports" value={data.counts.total} />
        <StatCard label="Pending" value={data.counts.pending} tone="warning" hint="Queued or escalated" />
        <StatCard label="Assigned" value={data.counts.assigned} tone="info" hint="Assigned or in progress" />
        <StatCard label="Resolved" value={data.counts.resolved} tone="success" />
      </div>

      <div className="ticket p-5 sm:p-6">
        <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value.toUpperCase())}
              placeholder="RCT-261108-A1K9"
              className="h-11 pl-9 font-mono"
              aria-invalid={!!err}
            />
          </div>
          <Button type="submit" size="lg">Find report</Button>
        </form>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}

        {id && (
          <div className="ticket-perf mt-6 pt-6">
            {lookup.isLoading ? (
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Looking up {id}…</p>
            ) : !lookup.data ? (
              <p className="text-muted-foreground">No report found with ID <Code>{id}</Code>.</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xl font-bold">{lookup.data.report.id}</span>
                    <StatusBadge status={lookup.data.report.status} />
                    <PriorityBadge priority={lookup.data.report.priority} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Info k="Category" v={lookup.data.report.category} />
                    <Info k="Handler" v={lookup.data.handler ? `${lookup.data.handler.name} (${lookup.data.handler.id})` : "Not yet assigned"} />
                    <Info k="Restaurant" v={lookup.data.report.restaurant_id} />
                    <Info k="Zone" v={`${lookup.data.report.zone} · ${lookup.data.report.zone_code}`} />
                    <Info k="Submitted" v={formatTime(lookup.data.report.created_at)} />
                    <Info k="Reporter" v={lookup.data.report.reporter_name} />
                  </dl>
                  <p className="rounded-md bg-secondary p-3 text-sm">{lookup.data.report.description}</p>
                </div>
                <div>
                  <p className="eyebrow mb-3">Timeline</p>
                  <ol className="relative space-y-4 border-l-2 border-dashed border-border pl-5">
                    {lookup.data.events.map((e, i) => (
                      <li key={i} className="relative">
                        <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-paper bg-primary" />
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={e.to_status as Status} />
                          <span className="font-mono text-xs text-muted-foreground">{formatTime(e.created_at)}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{e.note}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ticket overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="eyebrow">All reports</p>
          <div className="flex gap-1 rounded-md bg-secondary p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn("rounded px-3 py-1 text-xs font-semibold capitalize", filter === f ? "bg-paper shadow-sm" : "text-muted-foreground")}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Report ID</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Handler</th>
                <th className="px-4 py-2 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-secondary/40" onClick={() => { setQ(r.id); navigate({ search: { id: r.id } }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.id}</td>
                  <td className="px-4 py-2.5">{r.category}</td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={r.priority} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{handlerName(r.handler_id)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground">{formatTime(r.created_at)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No reports in this group.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
