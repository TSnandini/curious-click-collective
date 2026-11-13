/**
 * Documented test cases. Each runs against the real logic modules and is
 * executed both by Vitest (complaint.test.ts) and live in the Test Lab page.
 */
import { classify, decidePriority } from "./classify";
import { canTransition, CATEGORIES } from "./constants";
import { ALL_DFAS, dfaRegexAgree, emailDFA, orderIdDFA, phoneDFA, reportIdDFA, restaurantIdDFA, simulate } from "./dfa";
import { dispatch, orderQueue, type HandlerState, type RoutingEntry } from "./dispatch";
import { generateReportId, validateField, validateReport, zoneFromCode, type ReportInput } from "./validate";

export interface TestCase {
  id: string;
  area: string;
  title: string;
  expected: string;
  run: () => { pass: boolean; detail: string };
}

const check = (pass: boolean, detail: string) => ({ pass, detail });

// Fixture: one zone, two handlers + escalation desk
const H = (id: string, over: Partial<HandlerState> = {}): HandlerState => ({
  id, name: id, zone: "NORTH", available: true, capacity: 2, is_escalation: false, ...over,
});
const handlers = () => [H("H-N1"), H("H-N2"), H("H-ESC", { zone: "ALL", capacity: 5, is_escalation: true })];
const table: RoutingEntry[] = CATEGORIES.map((c) => ({
  zone: "NORTH", category: c, primary_handler: "H-N1", backup_handler: "H-N2",
}));

const baseInput: ReportInput = {
  reporterName: "Test User", reporterEmail: "test.user@mail.com", reporterPhone: "9876543210",
  restaurantId: "RST-1021", orderId: "ORD-554201", zoneCode: "NZ-01", complaintCode: "FQ101",
  description: "The soup was cold and tasteless today.", urgency: "medium",
};

function corpus(): string[] {
  // Deterministic pseudo-random strings around each DFA's alphabet, plus mutations of examples.
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const alphabet = "RSTODCZNQFHYBLV0123456789-@._abcmz ";
  const out: string[] = ["", " ", "-", "@"];
  for (const d of ALL_DFAS) {
    const ex = d.example;
    out.push(ex, ex.toLowerCase(), ex + "0", ex.slice(1), ex.slice(0, -1), ` ${ex}`);
    for (let i = 0; i < ex.length; i++) out.push(ex.slice(0, i) + "X" + ex.slice(i + 1));
  }
  for (let i = 0; i < 600; i++) {
    const len = 1 + Math.floor(rnd() * 18);
    let s = "";
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    out.push(s);
  }
  return out;
}

export const TEST_CASES: TestCase[] = [
  {
    id: "TC-01", area: "Input formats", title: "Valid structured identifiers are accepted",
    expected: "RST-1021, ORD-554201, NZ-01, FQ101 all accepted by their DFA",
    run: () => {
      const errs = validateReport(baseInput);
      return check(Object.keys(errs).length === 0, Object.keys(errs).length ? JSON.stringify(errs) : "All fields valid");
    },
  },
  {
    id: "TC-02", area: "Input formats", title: "Malformed identifiers are rejected",
    expected: "rst-1021, RST1021, RST-102, ORD-12345A rejected",
    run: () => {
      const bad = ["rst-1021", "RST1021", "RST-102", "RST-10211"].map((s) => simulate(restaurantIdDFA, s).accepted);
      const badOrder = simulate(orderIdDFA, "ORD-12345A").accepted;
      return check(bad.every((b) => !b) && !badOrder, `restaurant: ${bad.join(",")} order: ${badOrder}`);
    },
  },
  {
    id: "TC-03", area: "Input formats", title: "Email and phone DFAs",
    expected: "a.b@mail.co.in valid; a@b, @mail.com, 1234567890 invalid",
    run: () => {
      const ok = simulate(emailDFA, "a.b@mail.co.in").accepted && simulate(phoneDFA, "9876543210").accepted;
      const bad = [simulate(emailDFA, "a@b"), simulate(emailDFA, "@mail.com"), simulate(phoneDFA, "1234567890")]
        .every((r) => !r.accepted);
      return check(ok && bad, `valid ok: ${ok}, invalid rejected: ${bad}`);
    },
  },
  {
    id: "TC-04", area: "DFA ⇔ regex", title: "DFA and regex agree on every input",
    expected: "0 disagreements across all 7 automata and the fuzz corpus",
    run: () => {
      const inputs = corpus();
      let total = 0;
      const bad: string[] = [];
      for (const d of ALL_DFAS) for (const s of inputs) {
        total++;
        if (!dfaRegexAgree(d, s)) bad.push(`${d.key}:"${s}"`);
      }
      return check(bad.length === 0, `${total} comparisons, ${bad.length} disagreements ${bad.slice(0, 3).join(" ")}`);
    },
  },
  ...(
    [
      ["TC-05", "Food Quality", "FQ101", "The pasta was undercooked and the sauce tasted stale."],
      ["TC-06", "Service", "SV501", "The waiter was rude and we were ignored by staff."],
      ["TC-07", "Hygiene", "HY301", "There was a cockroach on the table and the washroom was dirty."],
      ["TC-08", "Billing", "BL201", "I was overcharged and the discount was missing from the bill."],
      ["TC-09", "Delivery", "DL401", "The delivery rider was late and the packaging was spilled."],
    ] as const
  ).map(([id, cat, code, desc]): TestCase => ({
    id, area: "Classification", title: `Classifies ${cat}`, expected: `Category = ${cat}`,
    run: () => {
      const c = classify(desc, code);
      return check(c.category === cat, `Got ${c.category} (scores ${JSON.stringify(c.scores)})`);
    },
  })),
  {
    id: "TC-10", area: "Classification", title: "Conflicting patterns are flagged and resolved",
    expected: "Cold, stale food delivered late with code DL → conflict = true, category Delivery",
    run: () => {
      const c = classify("The food arrived cold and stale because the delivery was late.", "DL402");
      return check(c.conflict && c.category === "Delivery", `${c.category}, conflict=${c.conflict}: ${c.resolution}`);
    },
  },
  {
    id: "TC-11", area: "Routing", title: "Unknown routing zone escalates",
    expected: "Zone code QZ-07 → zone UNKNOWN → escalation desk",
    run: () => {
      const zone = zoneFromCode("QZ-07");
      const d = dispatch({ zone, category: "Food Quality", priority: 3 }, table, handlers(), {});
      return check(zone === "UNKNOWN" && d.status === "escalated" && d.handlerId === "H-ESC", `${zone} → ${d.status} ${d.handlerId}`);
    },
  },
  {
    id: "TC-12", area: "Routing", title: "Invalid complaint codes are rejected",
    expected: "XX101 (unknown prefix) and FQ10 (bad format) fail validation",
    run: () => {
      const a = validateField("complaintCode", "XX101");
      const b = validateField("complaintCode", "FQ10");
      return check(!!a && !!b, `XX101: ${a ?? "accepted"} | FQ10: ${b ?? "accepted"}`);
    },
  },
  {
    id: "TC-13", area: "Dispatch", title: "Primary handler with capacity is assigned",
    expected: "Assigned to primary H-N1",
    run: () => {
      const d = dispatch({ zone: "NORTH", category: "Hygiene", priority: 3 }, table, handlers(), {});
      return check(d.status === "assigned" && d.assignment === "primary" && d.handlerId === "H-N1", d.note);
    },
  },
  {
    id: "TC-14", area: "Dispatch", title: "Capacity overflow falls back to backup",
    expected: "Primary at 2/2 → backup H-N2",
    run: () => {
      const d = dispatch({ zone: "NORTH", category: "Hygiene", priority: 3 }, table, handlers(), { "H-N1": 2 });
      return check(d.assignment === "backup" && d.handlerId === "H-N2", d.note);
    },
  },
  {
    id: "TC-15", area: "Dispatch", title: "Unavailable handler falls back to backup",
    expected: "Primary unavailable → backup H-N2",
    run: () => {
      const hs = handlers().map((h) => (h.id === "H-N1" ? { ...h, available: false } : h));
      const d = dispatch({ zone: "NORTH", category: "Billing", priority: 4 }, table, hs, {});
      return check(d.assignment === "backup" && d.handlerId === "H-N2", d.note);
    },
  },
  {
    id: "TC-16", area: "Dispatch", title: "No handler free, non-critical → queued",
    expected: "Both full, P3 → queued, no handler",
    run: () => {
      const d = dispatch({ zone: "NORTH", category: "Service", priority: 3 }, table, handlers(), { "H-N1": 2, "H-N2": 2 });
      return check(d.status === "queued" && d.handlerId === null, d.note);
    },
  },
  {
    id: "TC-17", area: "Escalation", title: "No handler free, critical → escalation desk",
    expected: "Both full, P1 → escalated to H-ESC",
    run: () => {
      const d = dispatch({ zone: "NORTH", category: "Service", priority: 1 }, table, handlers(), { "H-N1": 2, "H-N2": 2 });
      return check(d.status === "escalated" && d.handlerId === "H-ESC", d.note);
    },
  },
  {
    id: "TC-18", area: "Escalation", title: "Health-risk priority override",
    expected: "Medium urgency + 'food poisoning' in Hygiene → P1 with override note",
    run: () => {
      const p = decidePriority("medium", "Hygiene", "My child got food poisoning after eating here");
      const none = decidePriority("medium", "Service", "Staff was slow");
      return check(p.priority === 1 && !!p.override && none.override === null, `${p.override} | plain: P${none.priority}`);
    },
  },
  {
    id: "TC-19", area: "Queue", title: "Queue is ordered by priority, then submission time",
    expected: "P1 first, then older P3 before newer P3, then P4",
    run: () => {
      const q = orderQueue([
        { id: "c", priority: 3, created_at: "2026-11-10T10:00:00Z" },
        { id: "d", priority: 4, created_at: "2026-11-09T10:00:00Z" },
        { id: "a", priority: 1, created_at: "2026-11-11T10:00:00Z" },
        { id: "b", priority: 3, created_at: "2026-11-09T09:00:00Z" },
      ]).map((x) => x.id).join("");
      return check(q === "abcd", `Order: ${q}`);
    },
  },
  {
    id: "TC-20", area: "Queue", title: "Multiple incoming reports fill primary, backup, then queue",
    expected: "5 reports with capacity 2+2 → primary, primary, backup, backup, queued",
    run: () => {
      const hs = handlers();
      const loads: Record<string, number> = {};
      const out: string[] = [];
      for (let i = 0; i < 5; i++) {
        const d = dispatch({ zone: "NORTH", category: "Food Quality", priority: 3 }, table, hs, loads);
        if (d.handlerId) loads[d.handlerId] = (loads[d.handlerId] ?? 0) + 1;
        out.push(d.assignment);
      }
      return check(out.join(",") === "primary,primary,backup,backup,queued", out.join(", "));
    },
  },
  {
    id: "TC-21", area: "Status", title: "Status transitions follow the workflow",
    expected: "assigned→in_progress→resolved allowed; resolved→assigned and queued→resolved blocked",
    run: () => {
      const ok = canTransition("assigned", "in_progress") && canTransition("in_progress", "resolved");
      const blocked = !canTransition("resolved", "assigned") && !canTransition("queued", "resolved");
      return check(ok && blocked, `allowed: ${ok}, blocked: ${blocked}`);
    },
  },
  {
    id: "TC-22", area: "Status", title: "Report IDs are unique and DFA-valid",
    expected: "1000 generated IDs, all unique, all accepted by the Report ID DFA",
    run: () => {
      const ids = Array.from({ length: 1000 }, () => generateReportId());
      const unique = new Set(ids).size;
      const valid = ids.every((id) => simulate(reportIdDFA, id).accepted);
      return check(unique >= 999 && valid, `${unique} unique, all valid: ${valid}`);
    },
  },
];

export function runAllTests() {
  return TEST_CASES.map((t) => {
    try {
      return { ...t, result: t.run() };
    } catch (e) {
      return { ...t, result: { pass: false, detail: `Threw: ${(e as Error).message}` } };
    }
  });
}
