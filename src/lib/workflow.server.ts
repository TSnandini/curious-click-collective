import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { classify, decidePriority } from "@/lib/complaint/classify";
import { ACTIVE_STATUSES, canTransition, statusGroup, type Status } from "@/lib/complaint/constants";
import { dispatch, orderQueue, type HandlerState, type RoutingEntry } from "@/lib/complaint/dispatch";
import { generateReportId, validateReport, zoneFromCode, type ReportInput } from "@/lib/complaint/validate";

const db = supabaseAdmin;

const REPORT_COLUMNS =
  "id, reporter_name, restaurant_id, order_id, zone_code, zone, complaint_code, description, urgency, category, category_scores, classification_conflict, priority, priority_override, status, handler_id, assignment_type, routing_note, created_at, updated_at";

function fail(msg: string, err?: unknown): never {
  if (err) console.error(msg, err);
  throw new Error(msg);
}

function maskName(name: string) {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0]}.` : first;
}

async function loadRouting() {
  const [h, r, a] = await Promise.all([
    db.from("handlers").select("id, name, zone, available, capacity, is_escalation").order("id"),
    db.from("routing_table").select("zone, category, primary_handler, backup_handler").order("id"),
    db.from("reports").select("handler_id").in("status", ACTIVE_STATUSES),
  ]);
  if (h.error || r.error || a.error) fail("Could not load routing state", h.error ?? r.error ?? a.error);
  const loads: Record<string, number> = {};
  for (const row of a.data) if (row.handler_id) loads[row.handler_id] = (loads[row.handler_id] ?? 0) + 1;
  return { handlers: h.data as HandlerState[], table: r.data as RoutingEntry[], loads };
}

async function logEvent(reportId: string, from: string | null, to: string, note: string) {
  const { error } = await db.from("report_events").insert({ report_id: reportId, from_status: from, to_status: to, note });
  if (error) fail("Could not record status history", error);
}

/** Re-dispatch queued reports in priority/time order while capacity exists. */
export async function processQueue(): Promise<string[]> {
  const { data, error } = await db.from("reports").select("id, zone, category, priority, created_at").eq("status", "queued");
  if (error) fail("Could not read queue", error);
  if (!data.length) return [];
  const { handlers, table, loads } = await loadRouting();
  const moved: string[] = [];
  for (const r of orderQueue(data)) {
    const d = dispatch(r, table, handlers, loads);
    if (d.status === "queued" || !d.handlerId) continue;
    loads[d.handlerId] = (loads[d.handlerId] ?? 0) + 1;
    const { error: uErr } = await db
      .from("reports")
      .update({ status: d.status, handler_id: d.handlerId, assignment_type: d.assignment, routing_note: `From queue: ${d.note}`, updated_at: new Date().toISOString() })
      .eq("id", r.id)
      .eq("status", "queued");
    if (uErr) fail("Could not dispatch queued report", uErr);
    await logEvent(r.id, "queued", d.status, `Dequeued: ${d.note}`);
    moved.push(r.id);
  }
  return moved;
}

export async function submitReport(input: ReportInput) {
  const clean = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v).trim()])) as unknown as ReportInput;
  const errors = validateReport(clean);
  if (Object.keys(errors).length) return { ok: false as const, errors };

  const zone = zoneFromCode(clean.zoneCode);
  const cls = classify(clean.description, clean.complaintCode);
  const pr = decidePriority(clean.urgency, cls.category, clean.description);
  const { handlers, table, loads } = await loadRouting();
  const d = dispatch({ zone, category: cls.category, priority: pr.priority }, table, handlers, loads);

  let id = generateReportId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await db.from("reports").insert({
      id,
      reporter_name: clean.reporterName,
      reporter_email: clean.reporterEmail,
      reporter_phone: clean.reporterPhone,
      restaurant_id: clean.restaurantId,
      order_id: clean.orderId,
      zone_code: clean.zoneCode,
      zone,
      complaint_code: clean.complaintCode,
      description: clean.description,
      urgency: clean.urgency,
      category: cls.category,
      category_scores: cls.scores,
      classification_conflict: cls.conflict,
      priority: pr.priority,
      priority_override: pr.override,
      status: d.status,
      handler_id: d.handlerId,
      assignment_type: d.assignment,
      routing_note: d.note,
    });
    if (!error) break;
    if (error.code === "23505" && attempt < 4) {
      id = generateReportId();
      continue;
    }
    fail("Could not save the report", error);
  }
  await logEvent(id, null, d.status, d.note);
  const handler = handlers.find((h) => h.id === d.handlerId);

  return {
    ok: true as const,
    report: {
      id,
      zone,
      category: cls.category,
      scores: cls.scores,
      matched: cls.matched,
      conflict: cls.conflict,
      resolution: cls.resolution,
      priority: pr.priority,
      basePriority: pr.base,
      override: pr.override,
      status: d.status as Status,
      handlerId: d.handlerId,
      handlerName: handler?.name ?? null,
      assignment: d.assignment,
      note: d.note,
      steps: d.steps,
    },
  };
}

export async function updateReportStatus(reportId: string, to: Status, note: string) {
  const { data: rep, error } = await db.from("reports").select("id, status, handler_id").eq("id", reportId).maybeSingle();
  if (error) fail("Could not read report", error);
  if (!rep) fail("Report not found");
  const from = rep.status as Status;
  if (!canTransition(from, to)) fail(`Cannot move a report from ${from} to ${to}`);
  const { error: uErr } = await db.from("reports").update({ status: to, updated_at: new Date().toISOString() }).eq("id", reportId).eq("status", from);
  if (uErr) fail("Could not update status", uErr);
  await logEvent(reportId, from, to, note || (to === "resolved" ? "Resolved by handler" : "Handler started work"));
  const dequeued = to === "resolved" ? await processQueue() : [];
  return { ok: true, dequeued };
}

export async function updateHandler(handlerId: string, available: boolean, capacity: number) {
  const { error } = await db.from("handlers").update({ available, capacity }).eq("id", handlerId);
  if (error) fail("Could not update handler", error);
  const dequeued = await processQueue();
  return { ok: true, dequeued };
}

export async function getSystemState() {
  const [{ handlers, table, loads }, reps, events] = await Promise.all([
    loadRouting(),
    db.from("reports").select(REPORT_COLUMNS).order("created_at", { ascending: false }).limit(500),
    db.from("report_events").select("report_id, from_status, to_status, note, created_at").order("created_at", { ascending: false }).limit(40),
  ]);
  if (reps.error || events.error) fail("Could not load reports", reps.error ?? events.error);
  const reports = reps.data.map((r) => ({ ...r, reporter_name: maskName(r.reporter_name), status: r.status as Status }));
  const counts = { total: reports.length, pending: 0, assigned: 0, resolved: 0 };
  for (const r of reports) counts[statusGroup(r.status)]++;
  return {
    handlers: handlers.map((h) => ({ ...h, load: loads[h.id] ?? 0 })),
    routing: table,
    reports,
    counts,
    events: events.data,
  };
}

export async function lookupReport(reportId: string) {
  const { data: rep, error } = await db.from("reports").select(REPORT_COLUMNS).eq("id", reportId).maybeSingle();
  if (error) fail("Could not look up report", error);
  if (!rep) return null;
  const [{ data: evs }, { data: h }] = await Promise.all([
    db.from("report_events").select("from_status, to_status, note, created_at").eq("report_id", reportId).order("created_at"),
    rep.handler_id ? db.from("handlers").select("id, name, zone").eq("id", rep.handler_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    report: { ...rep, reporter_name: maskName(rep.reporter_name), status: rep.status as Status },
    handler: h ?? null,
    events: evs ?? [],
  };
}

/** Live end-to-end check: submit → read back → status updates → history → cleanup. */
export async function runPersistenceCheck() {
  const steps: { name: string; pass: boolean; detail: string }[] = [];
  const res = await submitReport({
    reporterName: "Integration Test",
    reporterEmail: "integration.test@mail.com",
    reporterPhone: "9000000000",
    restaurantId: "RST-9999",
    orderId: "ORD-999999",
    zoneCode: "CZ-99",
    complaintCode: "SV599",
    description: "Integration test: the waiter was rude and service was slow.",
    urgency: "low",
  });
  if (!res.ok) return { steps: [{ name: "Submit", pass: false, detail: JSON.stringify(res.errors) }] };
  const id = res.report.id;
  steps.push({ name: "Submit through full pipeline", pass: true, detail: `${id} → ${res.report.category}, ${res.report.status} (${res.report.handlerId ?? "no handler"})` });
  try {
    const back = await lookupReport(id);
    steps.push({ name: "Read back from database", pass: !!back && back.report.category === "Service", detail: back ? `Stored category ${back.report.category}, status ${back.report.status}` : "Not found" });
    if (back && (back.report.status === "assigned" || back.report.status === "escalated")) {
      await updateReportStatus(id, "in_progress", "Integration test");
      await updateReportStatus(id, "resolved", "Integration test");
      const after = await lookupReport(id);
      steps.push({ name: "Status updates persist", pass: after?.report.status === "resolved", detail: `Final status ${after?.report.status}` });
      steps.push({ name: "Status history recorded", pass: (after?.events.length ?? 0) >= 3, detail: (after?.events ?? []).map((e) => e.to_status).join(" → ") });
    } else {
      steps.push({ name: "Status updates persist", pass: back?.report.status === "queued", detail: "Report was queued (all handlers busy) — transitions not applicable" });
    }
  } finally {
    await db.from("reports").delete().eq("id", id);
    const { data } = await db.from("reports").select("id").eq("id", id).maybeSingle();
    steps.push({ name: "Test record cleaned up", pass: !data, detail: data ? "Still present" : "Removed" });
  }
  return { steps };
}
