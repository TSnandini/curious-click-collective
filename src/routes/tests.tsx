import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CheckCircle2, Database, FlaskConical, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Code, PageHeader } from "@/components/tracker/badges";
import { cn } from "@/lib/utils";
import { ALL_DFAS, classLabel, DEAD, simulate, transitionCount } from "@/lib/complaint/dfa";
import { runAllTests, TEST_CASES } from "@/lib/complaint/testcases";
import { persistenceCheckFn } from "@/lib/reports.functions";

export const Route = createFileRoute("/tests")({
  head: () => ({
    meta: [
      { title: "Test lab — Kitchen Ticket" },
      { name: "description", content: "Explore the validation automata and run the documented test cases live." },
      { property: "og:title", content: "Test lab — Kitchen Ticket" },
      { property: "og:description", content: "Explore the validation automata and run the documented test cases live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TestsPage,
});

type Ran = ReturnType<typeof runAllTests>;

function TestsPage() {
  const [results, setResults] = useState<Ran | null>(null);
  const persist = useServerFn(persistenceCheckFn);
  const e2e = useMutation({ mutationFn: () => persist() });
  const passed = results?.filter((r) => r.result.pass).length ?? 0;

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Test lab" title="Prove it works">
        Step through each validation automaton character by character, then run every documented test case against the real logic.
      </PageHeader>

      <DfaExplorer />

      <section className="ticket overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="eyebrow">Documented test cases</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {TEST_CASES.length} cases · {results ? <strong className={passed === results.length ? "text-success" : "text-destructive"}>{passed}/{results.length} passed</strong> : "not run yet"}
            </p>
          </div>
          <Button onClick={() => setResults(runAllTests())}><FlaskConical /> Run all tests</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Area</th>
                <th className="px-4 py-2 font-medium">Test</th>
                <th className="px-4 py-2 font-medium">Expected</th>
                <th className="px-4 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {TEST_CASES.map((t, i) => {
                const r = results?.[i]?.result;
                return (
                  <tr key={t.id} className="align-top">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{t.id}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{t.area}</td>
                    <td className="px-4 py-2.5 font-medium">{t.title}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.expected}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {r ? (
                        <div className="flex items-start gap-1.5">
                          {r.pass ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-destructive" />}
                          <span className="font-mono break-all">{r.detail}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ticket p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">TC-23 · End-to-end database persistence</p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Submits a real report through the full pipeline, reads it back, moves it to in-progress then resolved, checks the history, and deletes the test record.
            </p>
          </div>
          <Button variant="outline" onClick={() => e2e.mutate()} disabled={e2e.isPending}>
            {e2e.isPending ? <Loader2 className="animate-spin" /> : <Database />} Run live check
          </Button>
        </div>
        {e2e.error && <p className="mt-3 text-sm text-destructive">{(e2e.error as Error).message}</p>}
        {e2e.data && (
          <ol className="mt-4 space-y-2">
            {e2e.data.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {s.pass ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <XCircle className="mt-0.5 size-4 text-destructive" />}
                <span><strong>{s.name}</strong> <span className="font-mono text-xs text-muted-foreground">{s.detail}</span></span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DfaExplorer() {
  const [key, setKey] = useState(ALL_DFAS[0].key);
  const dfa = ALL_DFAS.find((d) => d.key === key)!;
  const [input, setInput] = useState(dfa.example);
  const sim = useMemo(() => simulate(dfa, input), [dfa, input]);
  const regexOk = dfa.regex.test(input);
  const chars = Array.from(input);

  return (
    <section className="ticket p-5 sm:p-6">
      <p className="eyebrow">Automata explorer</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {ALL_DFAS.map((d) => (
          <button
            key={d.key}
            onClick={() => { setKey(d.key); setInput(d.example); }}
            className={cn("rounded-full border px-3 py-1 text-xs font-semibold", d.key === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-paper hover:bg-secondary")}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Input value={input} onChange={(e) => setInput(e.target.value)} className="h-11 font-mono text-base" />
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={cn("stamp", sim.accepted ? "text-success" : "text-destructive")}>DFA {sim.accepted ? "accept" : "reject"}</span>
            <span className={cn("stamp", regexOk ? "text-success" : "text-destructive")}>Regex {regexOk ? "match" : "no match"}</span>
            <span className={cn("stamp", sim.accepted === regexOk ? "text-info" : "text-destructive")}>{sim.accepted === regexOk ? "agree" : "disagree"}</span>
          </div>
          <p className="text-sm text-muted-foreground">{sim.reason}</p>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">State trace</p>
            <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
              {sim.trace.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-muted-foreground">
                      —<span className="text-foreground">{chars[i - 1] === " " ? "␣" : chars[i - 1]}</span>→
                    </span>
                  )}
                  <span className={cn(
                    "rounded px-1.5 py-0.5",
                    s === DEAD ? "bg-destructive text-destructive-foreground" : dfa.accept.includes(s) ? "bg-success text-success-foreground" : "bg-secondary",
                  )}>{s}</span>
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Equivalent regex <Code>{dfa.regex.source}</Code>
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Transition table · {dfa.states.length} states, {transitionCount(dfa)} transitions, start {dfa.start}, accept {dfa.accept.join(", ")}
          </p>
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0 bg-secondary text-left">
                <tr><th className="px-3 py-1.5">State</th><th className="px-3 py-1.5">On</th><th className="px-3 py-1.5">Next</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dfa.states.flatMap((s) => {
                  const ts = dfa.transitions[s] ?? [];
                  const label = `${s === dfa.start ? "→" : ""}${s}${dfa.accept.includes(s) ? "*" : ""}`;
                  const current = sim.trace[sim.trace.length - 1] === s;
                  if (!ts.length) return [<tr key={s} className={cn(current && "bg-accent/30")}><td className="px-3 py-1">{label}</td><td className="px-3 py-1 text-muted-foreground" colSpan={2}>any → {DEAD}</td></tr>];
                  return ts.map((t, i) => (
                    <tr key={s + i} className={cn(current && "bg-accent/30")}>
                      <td className="px-3 py-1">{i === 0 ? label : ""}</td>
                      <td className="px-3 py-1">{classLabel(t.on)}</td>
                      <td className="px-3 py-1">{t.to}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">→ start · * accepting · any missing transition goes to the dead state {DEAD}</p>
        </div>
      </div>
    </section>
  );
}
