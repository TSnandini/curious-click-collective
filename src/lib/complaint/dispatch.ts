import type { Category, Status } from "./constants";
import { UNKNOWN_ZONE } from "./constants";

export interface HandlerState {
  id: string;
  name: string;
  zone: string;
  available: boolean;
  capacity: number;
  is_escalation: boolean;
}

export interface RoutingEntry {
  zone: string;
  category: string;
  primary_handler: string;
  backup_handler: string;
}

export type AssignmentType = "primary" | "backup" | "escalation" | "queued";

export interface DispatchDecision {
  status: Extract<Status, "assigned" | "queued" | "escalated">;
  handlerId: string | null;
  assignment: AssignmentType;
  note: string;
  steps: string[];
}

export function hasRoom(h: HandlerState | undefined, loads: Record<string, number>): h is HandlerState {
  return !!h && h.available && (loads[h.id] ?? 0) < h.capacity;
}

function describe(h: HandlerState | undefined, loads: Record<string, number>) {
  if (!h) return "missing";
  if (!h.available) return "unavailable";
  return `load ${loads[h.id] ?? 0}/${h.capacity}`;
}

/**
 * Dispatch algorithm:
 * 1. Look up (zone, category) in the routing table. No entry → escalation desk.
 * 2. Primary handler available with spare capacity → assign.
 * 3. Otherwise backup handler available with spare capacity → fallback assign.
 * 4. Otherwise P1 Critical → escalation desk.
 * 5. Otherwise → queue (ordered by priority, then submission time).
 */
export function dispatch(
  report: { zone: string; category: Category | string; priority: number },
  table: RoutingEntry[],
  handlers: HandlerState[],
  loads: Record<string, number>,
): DispatchDecision {
  const byId = new Map(handlers.map((h) => [h.id, h]));
  const desk = handlers.find((h) => h.is_escalation);
  const steps: string[] = [];
  const entry = table.find((r) => r.zone === report.zone && r.category === report.category);

  const escalate = (why: string): DispatchDecision => {
    if (hasRoom(desk, loads)) {
      steps.push(`Escalation desk ${desk.id} (${describe(desk, loads)}) → escalated`);
      return { status: "escalated", handlerId: desk.id, assignment: "escalation", note: why, steps };
    }
    steps.push(`Escalation desk ${describe(desk, loads)} → queued`);
    return { status: "queued", handlerId: null, assignment: "queued", note: `${why}; escalation desk full — queued`, steps };
  };

  if (!entry || report.zone === UNKNOWN_ZONE) {
    steps.push(`Routing lookup ${report.zone}/${report.category}: no entry`);
    return escalate(`Unknown routing zone ${report.zone} — escalated`);
  }
  steps.push(`Routing lookup ${report.zone}/${report.category}: primary ${entry.primary_handler}, backup ${entry.backup_handler}`);

  const primary = byId.get(entry.primary_handler);
  steps.push(`Primary ${entry.primary_handler}: ${describe(primary, loads)}`);
  if (hasRoom(primary, loads)) {
    return {
      status: "assigned",
      handlerId: primary.id,
      assignment: "primary",
      note: `Routed ${report.zone}/${report.category} to primary ${primary.id}`,
      steps,
    };
  }

  const backup = byId.get(entry.backup_handler);
  steps.push(`Backup ${entry.backup_handler}: ${describe(backup, loads)}`);
  if (hasRoom(backup, loads)) {
    return {
      status: "assigned",
      handlerId: backup.id,
      assignment: "backup",
      note: `Primary ${entry.primary_handler} ${describe(primary, loads)} — fallback to backup ${backup.id}`,
      steps,
    };
  }

  if (report.priority === 1) return escalate("Primary and backup unavailable; P1 Critical escalated");

  steps.push("Non-critical → queued");
  return {
    status: "queued",
    handlerId: null,
    assignment: "queued",
    note: `Primary and backup unavailable — queued`,
    steps,
  };
}

/** Queue ordering: priority ascending (P1 first), then oldest first. */
export function orderQueue<T extends { priority: number; created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));
}
