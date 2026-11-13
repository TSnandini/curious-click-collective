import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, Copy, Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, PriorityBadge, StatusBadge, Code } from "@/components/tracker/badges";
import { cn } from "@/lib/utils";
import { classify, decidePriority } from "@/lib/complaint/classify";
import { CATEGORIES, URGENCIES, type Urgency } from "@/lib/complaint/constants";
import { simulate } from "@/lib/complaint/dfa";
import { FIELD_DFA, validateField, validateReport, zoneFromCode, type ReportInput } from "@/lib/complaint/validate";
import { submitReportFn } from "@/lib/reports.functions";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "File a complaint — Kitchen Ticket" },
      { name: "description", content: "Report a restaurant issue. Get an instant category, priority and a unique report ID." },
      { property: "og:title", content: "File a complaint — Kitchen Ticket" },
      { property: "og:description", content: "Report a restaurant issue. Get an instant category, priority and a unique report ID." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmitPage,
});

const EMPTY: ReportInput = {
  reporterName: "", reporterEmail: "", reporterPhone: "", restaurantId: "", orderId: "",
  zoneCode: "", complaintCode: "", description: "", urgency: "medium",
};

const SAMPLE: ReportInput = {
  reporterName: "Meera Pillai", reporterEmail: "meera.p@mail.com", reporterPhone: "9845012345",
  restaurantId: "RST-2210", orderId: "ORD-781120", zoneCode: "NZ-03", complaintCode: "HY305",
  description: "Found a hair in my curry and the table was dirty. My friend felt sick afterwards.", urgency: "medium",
};

type Result = Extract<Awaited<ReturnType<typeof submitReportFn>>, { ok: true }>["report"];

function SubmitPage() {
  const [form, setForm] = useState<ReportInput>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof ReportInput, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof ReportInput, string>>>({});
  const [result, setResult] = useState<Result | null>(null);
  const qc = useQueryClient();
  const submit = useServerFn(submitReportFn);

  const errors = useMemo(() => validateReport(form), [form]);
  const set = (k: keyof ReportInput, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((e) => ({ ...e, [k]: undefined }));
  };
  const touch = (k: keyof ReportInput) => setTouched((t) => ({ ...t, [k]: true }));

  const preview = useMemo(() => {
    if (validateField("complaintCode", form.complaintCode) || form.description.trim().length < 5) return null;
    const c = classify(form.description, form.complaintCode);
    const p = decidePriority(form.urgency, c.category, form.description);
    return { ...c, ...p };
  }, [form.description, form.complaintCode, form.urgency]);

  const mutation = useMutation({
    mutationFn: (data: ReportInput) => submit({ data }),
    onSuccess: (res) => {
      if (!res.ok) {
        setServerErrors(res.errors);
        toast.error("Please fix the highlighted fields");
        return;
      }
      setResult(res.report);
      qc.invalidateQueries({ queryKey: ["system"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: () => toast.error("Couldn't submit right now. Please try again."),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])));
    if (Object.keys(errors).length) {
      toast.error("Some fields need attention");
      return;
    }
    mutation.mutate(form);
  };

  if (result) return <ResultTicket r={result} onReset={() => { setResult(null); setForm(EMPTY); setTouched({}); }} />;

  const field = (k: keyof ReportInput, label: string, placeholder: string, opts: { mono?: boolean; upper?: boolean; type?: string } = {}) => {
    const err = serverErrors[k] ?? (touched[k] ? errors[k] : undefined);
    const dfa = FIELD_DFA[k];
    const val = form[k];
    const sim = dfa && val ? simulate(dfa, val.trim()) : null;
    const ok = touched[k] && !errors[k] && val;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={k} className="flex items-center justify-between">
          <span>{label}</span>
          {ok && <Check className="size-3.5 text-success" />}
        </Label>
        <Input
          id={k}
          type={opts.type ?? "text"}
          value={val}
          placeholder={placeholder}
          aria-invalid={!!err}
          onChange={(e) => set(k, opts.upper ? e.target.value.toUpperCase() : e.target.value)}
          onBlur={() => touch(k)}
          className={cn(opts.mono && "font-mono", err && "border-destructive focus-visible:ring-destructive/30")}
        />
        {err ? (
          <p className="text-xs text-destructive">{err}</p>
        ) : sim && sim.accepted ? (
          <p className="truncate font-mono text-[10px] text-muted-foreground" title={sim.trace.join(" → ")}>
            DFA {sim.trace[0]} → … → {sim.trace[sim.trace.length - 1]} · accepted
          </p>
        ) : null}
      </div>
    );
  };

  const descErr = serverErrors.description ?? (touched.description ? errors.description : undefined);
  const zone = !errors.zoneCode && form.zoneCode ? zoneFromCode(form.zoneCode) : null;

  return (
    <div>
      <PageHeader eyebrow="Report submission" title="Tell us what went wrong">
        Every field is checked as you type. Your complaint is sorted into a category and priority before you send it.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <form onSubmit={onSubmit} className="ticket space-y-8 p-5 sm:p-7" noValidate>
          <fieldset className="space-y-4">
            <legend className="eyebrow mb-3">01 · Your details</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {field("reporterName", "Full name", "Aisha Khan")}
              {field("reporterEmail", "Email", "you@mail.com", { type: "email" })}
              {field("reporterPhone", "Mobile", "9876543210", { mono: true })}
            </div>
          </fieldset>

          <fieldset className="ticket-perf space-y-4 pt-6">
            <legend className="eyebrow mb-3">02 · Identifiers & codes</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("restaurantId", "Restaurant ID", "RST-1021", { mono: true, upper: true })}
              {field("orderId", "Order / bill ID", "ORD-554201", { mono: true, upper: true })}
              <div>
                {field("zoneCode", "Zone code", "NZ-01", { mono: true, upper: true })}
                {zone && (
                  <p className={cn("mt-1 text-xs", zone === "UNKNOWN" ? "text-primary" : "text-muted-foreground")}>
                    {zone === "UNKNOWN" ? "Zone not in routing table — will go to the escalation desk" : `Zone: ${zone}`}
                  </p>
                )}
              </div>
              <div>
                {field("complaintCode", "Complaint code", "FQ101", { mono: true, upper: true })}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <Code>FQ</Code> food · <Code>SV</Code> service · <Code>HY</Code> hygiene · <Code>BL</Code> billing · <Code>DL</Code> delivery
                </p>
              </div>
            </div>
          </fieldset>

          <fieldset className="ticket-perf space-y-4 pt-6">
            <legend className="eyebrow mb-3">03 · What happened</legend>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                value={form.description}
                placeholder="The biryani was cold and the chicken was undercooked…"
                onChange={(e) => set("description", e.target.value)}
                onBlur={() => touch("description")}
                aria-invalid={!!descErr}
                className={cn(descErr && "border-destructive")}
              />
              <div className="flex justify-between text-xs">
                <span className="text-destructive">{descErr}</span>
                <span className="font-mono text-muted-foreground">{form.description.length}/1000</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {URGENCIES.map((u) => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => set("urgency", u as Urgency)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
                      form.urgency === u ? "border-primary bg-primary text-primary-foreground" : "border-input bg-paper hover:bg-secondary",
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="ticket-perf flex flex-wrap items-center justify-between gap-3 pt-6">
            <Button type="button" variant="ghost" onClick={() => { setForm(SAMPLE); setTouched({}); }}>
              Fill with sample
            </Button>
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <Send />} Submit report
            </Button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="ticket p-5">
            <p className="eyebrow">Live detection</p>
            {preview ? (
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-display text-2xl font-semibold">{preview.category}</p>
                  {preview.conflict && <p className="mt-1 text-xs text-primary">⚠ {preview.resolution}</p>}
                </div>
                <div className="space-y-1.5">
                  {CATEGORIES.map((c) => {
                    const max = Math.max(...Object.values(preview.scores), 1);
                    return (
                      <div key={c} className="grid grid-cols-[90px_1fr_24px] items-center gap-2 text-xs">
                        <span className={cn(c === preview.category && "font-semibold")}>{c}</span>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", c === preview.category ? "bg-primary" : "bg-muted-foreground/40")} style={{ width: `${(preview.scores[c] / max) * 100}%` }} />
                        </div>
                        <span className="text-right font-mono">{preview.scores[c]}</span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <div className="mt-1 flex items-center gap-2">
                    <PriorityBadge priority={preview.priority} />
                    {preview.override && <span className="text-xs text-primary">{preview.override}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Enter a valid complaint code and a few words of description to see the detected category and priority.</p>
            )}
          </div>
          <div className="ticket p-5 text-sm">
            <p className="eyebrow">Format guide</p>
            <ul className="mt-3 space-y-2">
              {Object.entries(FIELD_DFA).map(([k, d]) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{d!.label}</span>
                  <Code>{d!.example}</Code>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ResultTicket({ r, onReset }: { r: Result; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <div className="ticket overflow-hidden">
        <div className="bg-ink p-6 text-ink-foreground">
          <p className="eyebrow !text-ink-foreground/60">Report received</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-bold tracking-wider sm:text-3xl">{r.id}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { navigator.clipboard.writeText(r.id); setCopied(true); }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-sm text-ink-foreground/70">Keep this ID to track your complaint.</p>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Category</p>
            <p className="mt-1 font-display text-2xl font-semibold">{r.category}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.resolution}</p>
          </div>
          <div>
            <p className="eyebrow">Priority</p>
            <div className="mt-2"><PriorityBadge priority={r.priority} /></div>
            {r.override && <p className="mt-1 text-xs text-primary">{r.override}</p>}
          </div>
          <div>
            <p className="eyebrow">Status</p>
            <div className="mt-2"><StatusBadge status={r.status} /></div>
          </div>
          <div>
            <p className="eyebrow">Handler</p>
            <p className="mt-1 font-semibold">{r.handlerName ?? "Waiting in queue"}</p>
            {r.handlerId && <p className="font-mono text-xs text-muted-foreground">{r.handlerId} · {r.assignment}</p>}
          </div>
        </div>
        <div className="ticket-perf p-6">
          <p className="eyebrow">How it was routed</p>
          <ol className="mt-3 space-y-1.5 font-mono text-xs">
            {r.steps.map((s, i) => (
              <li key={i} className="flex gap-2"><span className="text-muted-foreground">{i + 1}.</span>{s}</li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/track" search={{ id: r.id }}>Track this report</Link></Button>
        <Button variant="outline" onClick={onReset}><RotateCcw /> File another</Button>
      </div>
    </div>
  );
}

