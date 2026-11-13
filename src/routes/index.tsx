import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, Tags, Route as RouteIcon, UserCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard, StatusBadge, formatTime, Code } from "@/components/tracker/badges";
import { systemQuery } from "@/lib/queries";
import type { Status } from "@/lib/complaint/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kitchen Ticket — Restaurant Complaint Tracker" },
      { name: "description", content: "Report a restaurant complaint and watch it get validated, classified, routed and resolved." },
      { property: "og:title", content: "Kitchen Ticket — Restaurant Complaint Tracker" },
      { property: "og:description", content: "Report a restaurant complaint and watch it get validated, classified, routed and resolved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(systemQuery),
  component: Home,
});

const STEPS = [
  { icon: ShieldCheck, title: "Validate", text: "Every ID and code is checked by a finite automaton and its matching regex." },
  { icon: Tags, title: "Classify", text: "One of exactly five categories, with priority overrides for health risks." },
  { icon: RouteIcon, title: "Route", text: "Zone × category lookup in an explicit routing table." },
  { icon: UserCheck, title: "Assign", text: "Primary handler, backup on overflow, queue when everyone is busy." },
  { icon: AlertTriangle, title: "Escalate", text: "Unknown zones and critical cases go to the escalation desk." },
  { icon: CheckCircle2, title: "Resolve", text: "Handlers update status; freed capacity pulls from the queue." },
];

function Home() {
  const { data } = useSuspenseQuery(systemQuery);
  return (
    <div className="space-y-14">
      <section className="grid items-end gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="animate-rise">
          <p className="eyebrow">Order up · complaints desk</p>
          <h1 className="mt-3 text-5xl leading-[1.02] font-semibold sm:text-6xl">
            Every complaint gets a ticket, a cook, and a <span className="text-primary italic">clear answer</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            File a restaurant complaint and follow it from the pass to the plate — validated, sorted, routed to the right
            person and tracked until it's resolved.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/submit">
                File a complaint <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/track">Track a report</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 animate-rise [animation-delay:120ms]">
          <StatCard label="Total" value={data.counts.total} />
          <StatCard label="Pending" value={data.counts.pending} tone="warning" hint="Queued or escalated" />
          <StatCard label="Assigned" value={data.counts.assigned} tone="info" hint="With a handler" />
          <StatCard label="Resolved" value={data.counts.resolved} tone="success" />
        </div>
      </section>

      <section>
        <p className="eyebrow mb-4">The full workflow</p>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {STEPS.map((s, i) => (
            <li key={s.title} className="ticket relative p-4 animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
              <s.icon className="mt-2 size-5 text-primary" />
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="ticket p-6">
          <p className="eyebrow">Dashboards</p>
          <ul className="mt-4 divide-y divide-border">
            {[
              { to: "/handler", t: "Handler dashboard", d: "Work your queue and set availability" },
              { to: "/routing", t: "Routing management", d: "Routing table, loads, queue, escalations" },
              { to: "/analytics", t: "Analytics", d: "Zone & category distributions" },
              { to: "/tests", t: "Test lab", d: "Automata explorer and 22 documented tests" },
            ].map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="group flex items-center justify-between py-3">
                  <span>
                    <span className="font-semibold">{l.t}</span>
                    <span className="block text-sm text-muted-foreground">{l.d}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="ticket p-6">
          <p className="eyebrow">Latest activity</p>
          <ul className="mt-4 space-y-3">
            {data.events.slice(0, 7).map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Code>{e.report_id}</Code>
                <StatusBadge status={e.to_status as Status} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.note}</span>
                <span className="font-mono text-xs text-muted-foreground">{formatTime(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
