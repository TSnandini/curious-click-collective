export const CATEGORIES = ["Food Quality", "Service", "Hygiene", "Billing", "Delivery"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Complaint-code prefix → category. A code like "FQ101" belongs to Food Quality. */
export const CODE_PREFIX: Record<string, Category> = {
  FQ: "Food Quality",
  SV: "Service",
  HY: "Hygiene",
  BL: "Billing",
  DL: "Delivery",
};

/** Zone-code prefix → routing zone. Unknown prefixes have no routing-table entry. */
export const ZONE_PREFIX: Record<string, string> = {
  NZ: "NORTH",
  SZ: "SOUTH",
  EZ: "EAST",
  WZ: "WEST",
  CZ: "CENTRAL",
};
export const ZONES = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;
export const UNKNOWN_ZONE = "UNKNOWN";

export const URGENCIES = ["low", "medium", "high", "critical"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const URGENCY_PRIORITY: Record<Urgency, number> = { critical: 1, high: 2, medium: 3, low: 4 };
export const PRIORITY_LABEL: Record<number, string> = {
  1: "P1 Critical",
  2: "P2 High",
  3: "P3 Medium",
  4: "P4 Low",
};

export const STATUSES = ["assigned", "queued", "escalated", "in_progress", "resolved"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  assigned: "Assigned",
  queued: "Queued",
  escalated: "Escalated",
  in_progress: "In progress",
  resolved: "Resolved",
};
/** Statuses that occupy a handler's capacity. */
export const ACTIVE_STATUSES: Status[] = ["assigned", "escalated", "in_progress"];

/** Allowed handler-driven status transitions. */
export const TRANSITIONS: Record<Status, Status[]> = {
  assigned: ["in_progress", "resolved"],
  escalated: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  queued: [],
  resolved: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Dashboard groupings. */
export function statusGroup(s: Status): "pending" | "assigned" | "resolved" {
  if (s === "resolved") return "resolved";
  if (s === "queued" || s === "escalated") return "pending";
  return "assigned";
}
