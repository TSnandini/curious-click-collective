import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, StatCard } from "@/components/tracker/badges";
import { CATEGORIES, PRIORITY_LABEL, ZONES } from "@/lib/complaint/constants";
import { systemQuery } from "@/lib/queries";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Kitchen Ticket" },
      { name: "description", content: "Complaint distribution by zone and category, with resolved and unresolved counts." },
      { property: "og:title", content: "Analytics — Kitchen Ticket" },
      { property: "og:description", content: "Complaint distribution by zone and category, with resolved and unresolved counts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(systemQuery),
  component: AnalyticsPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

function AnalyticsPage() {
  const { data } = useSuspenseQuery(systemQuery);
  const reps = data.reports;
  const resolved = reps.filter((r) => r.status === "resolved").length;
  const unresolved = reps.length - resolved;

  const byZone = [...ZONES, "UNKNOWN"].map((z) => {
    const rs = reps.filter((r) => r.zone === z);
    return { zone: z, Resolved: rs.filter((r) => r.status === "resolved").length, Unresolved: rs.filter((r) => r.status !== "resolved").length };
  });
  const byCat = CATEGORIES.map((c) => ({ name: c, value: reps.filter((r) => r.category === c).length }));
  const byCatStatus = CATEGORIES.map((c) => {
    const rs = reps.filter((r) => r.category === c);
    return { category: c, Resolved: rs.filter((r) => r.status === "resolved").length, Unresolved: rs.filter((r) => r.status !== "resolved").length };
  });
  const byPriority = [1, 2, 3, 4].map((p) => ({ name: PRIORITY_LABEL[p], value: reps.filter((r) => r.priority === p).length }));
  const rate = reps.length ? Math.round((resolved / reps.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Analytics dashboard" title="Where complaints come from">
        Distribution of every report by zone and category, and how many are closed.
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Reports" value={reps.length} />
        <StatCard label="Resolved" value={resolved} tone="success" />
        <StatCard label="Unresolved" value={unresolved} tone="primary" />
        <StatCard label="Resolution rate" value={`${rate}%`} tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Zone-wise distribution">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byZone}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="zone" tick={axis} />
              <YAxis allowDecimals={false} tick={axis} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Resolved" stackId="a" fill="var(--chart-2)" />
              <Bar dataKey="Unresolved" stackId="a" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Category-wise distribution">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {byCat.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="var(--card)" />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Resolved vs unresolved by category">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byCatStatus} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axis} />
              <YAxis type="category" dataKey="category" tick={axis} width={90} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Resolved" stackId="a" fill="var(--chart-2)" />
              <Bar dataKey="Unresolved" stackId="a" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Priority mix">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byPriority}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={axis} />
              <YAxis allowDecimals={false} tick={axis} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
              <Bar dataKey="value" name="Reports" radius={[4, 4, 0, 0]}>
                {byPriority.map((_, i) => <Cell key={i} fill={["var(--destructive)", "var(--chart-1)", "var(--chart-3)", "var(--muted-foreground)"][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ticket p-5">
      <p className="eyebrow mb-4">{title}</p>
      {children}
    </div>
  );
}
