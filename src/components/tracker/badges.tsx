import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_LABEL, type Status } from "@/lib/complaint/constants";

const statusStyle: Record<Status, string> = {
  assigned: "bg-info/12 text-info border-info/30",
  queued: "bg-warning/20 text-accent-foreground border-warning/50",
  escalated: "bg-primary/12 text-primary border-primary/35",
  in_progress: "bg-accent/40 text-accent-foreground border-accent",
  resolved: "bg-success/12 text-success border-success/30",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        statusStyle[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const priorityStyle: Record<number, string> = {
  1: "bg-destructive text-destructive-foreground",
  2: "bg-primary/15 text-primary",
  3: "bg-accent/45 text-accent-foreground",
  4: "bg-muted text-muted-foreground",
};

export function PriorityBadge({ priority, className }: { priority: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-bold whitespace-nowrap",
        priorityStyle[priority] ?? priorityStyle[4],
        className,
      )}
    >
      {PRIORITY_LABEL[priority] ?? `P${priority}`}
    </span>
  );
}

export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code className={cn("rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.8em] text-secondary-foreground", className)}>
      {children}
    </code>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 animate-rise">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-muted-foreground">{children}</p>}
    </header>
  );
}

export function StatCard({ label, value, tone = "default", hint }: { label: string; value: number | string; tone?: "default" | "primary" | "success" | "warning" | "info"; hint?: string }) {
  const toneCls = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-accent-foreground",
    info: "text-info",
  }[tone];
  return (
    <div className="ticket p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-1 font-display text-4xl font-semibold tabular-nums", toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LoadBar({ load, capacity, available = true }: { load: number; capacity: number; available?: boolean }) {
  const pct = capacity === 0 ? 100 : Math.min(100, (load / capacity) * 100);
  const full = load >= capacity;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", !available ? "bg-muted-foreground/40" : full ? "bg-primary" : "bg-success")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {load}/{capacity}
      </span>
    </div>
  );
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
