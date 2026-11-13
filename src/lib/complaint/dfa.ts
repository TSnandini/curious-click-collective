/**
 * Deterministic finite automata for every structured field, each paired with
 * an equivalent regular expression. Validation runs the DFA; the regex is the
 * reference used to prove the two agree.
 */

export type CharClass =
  | { kind: "digit" }
  | { kind: "upper" }
  | { kind: "alnum" }
  | { kind: "lit"; ch: string }
  | { kind: "set"; chars: string; label: string };

export interface Transition {
  on: CharClass;
  to: string;
}

export interface DFA {
  key: string;
  label: string;
  regex: RegExp;
  example: string;
  states: string[];
  start: string;
  accept: string[];
  transitions: Record<string, Transition[]>;
}

export interface SimulationResult {
  accepted: boolean;
  trace: string[];
  failedAt: number | null;
  reason: string;
}

export const DEAD = "∅";

export function classLabel(c: CharClass): string {
  switch (c.kind) {
    case "digit":
      return "[0-9]";
    case "upper":
      return "[A-Z]";
    case "alnum":
      return "[A-Za-z0-9]";
    case "lit":
      return `'${c.ch}'`;
    case "set":
      return c.label;
  }
}

function matches(c: CharClass, ch: string): boolean {
  switch (c.kind) {
    case "digit":
      return ch >= "0" && ch <= "9";
    case "upper":
      return ch >= "A" && ch <= "Z";
    case "alnum":
      return /^[A-Za-z0-9]$/.test(ch);
    case "lit":
      return ch === c.ch;
    case "set":
      return c.chars.includes(ch);
  }
}

/** Run the automaton one character at a time. */
export function simulate(dfa: DFA, input: string): SimulationResult {
  let state = dfa.start;
  const trace = [state];
  const chars = Array.from(input);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const t = (dfa.transitions[state] ?? []).find((tr) => matches(tr.on, ch));
    if (!t) {
      trace.push(DEAD);
      return {
        accepted: false,
        trace,
        failedAt: i,
        reason: `No transition from ${state} on '${ch}' (position ${i + 1})`,
      };
    }
    state = t.to;
    trace.push(state);
  }
  const accepted = dfa.accept.includes(state);
  return {
    accepted,
    trace,
    failedAt: accepted ? null : chars.length,
    reason: accepted
      ? `Halted in accepting state ${state}`
      : input.length === 0
        ? "Input is empty"
        : `Input ended in non-accepting state ${state}`,
  };
}

/** Build a linear DFA q0 → q1 → … → qn for a fixed-length token sequence. */
function linear(key: string, label: string, regex: RegExp, example: string, tokens: CharClass[]): DFA {
  const states = tokens.map((_, i) => `q${i}`).concat(`q${tokens.length}`);
  const transitions: Record<string, Transition[]> = {};
  tokens.forEach((tok, i) => {
    transitions[`q${i}`] = [{ on: tok, to: `q${i + 1}` }];
  });
  transitions[`q${tokens.length}`] = [];
  return { key, label, regex, example, states, start: "q0", accept: [`q${tokens.length}`], transitions };
}

const lit = (s: string): CharClass[] => Array.from(s).map((ch) => ({ kind: "lit", ch }) as CharClass);
const rep = (c: CharClass, n: number): CharClass[] => Array.from({ length: n }, () => c);
const D: CharClass = { kind: "digit" };
const U: CharClass = { kind: "upper" };
const A: CharClass = { kind: "alnum" };
const UD: CharClass = { kind: "set", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", label: "[A-Z0-9]" };

export const restaurantIdDFA = linear(
  "restaurantId",
  "Restaurant ID",
  /^RST-\d{4}$/,
  "RST-1021",
  [...lit("RST-"), ...rep(D, 4)],
);

export const orderIdDFA = linear("orderId", "Order ID", /^ORD-\d{6}$/, "ORD-554201", [
  ...lit("ORD-"),
  ...rep(D, 6),
]);

export const zoneCodeDFA = linear("zoneCode", "Zone code", /^[A-Z]{2}-\d{2}$/, "NZ-01", [
  U,
  U,
  { kind: "lit", ch: "-" },
  D,
  D,
]);

export const complaintCodeDFA = linear(
  "complaintCode",
  "Complaint code",
  /^[A-Z]{2}\d{3}$/,
  "FQ101",
  [U, U, D, D, D],
);

export const phoneDFA = linear("phone", "Phone (10-digit mobile)", /^[6-9]\d{9}$/, "9876543210", [
  { kind: "set", chars: "6789", label: "[6-9]" },
  ...rep(D, 9),
]);

export const reportIdDFA = linear(
  "reportId",
  "Report ID",
  /^RCT-\d{6}-[A-Z0-9]{4}$/,
  "RCT-261108-A1K9",
  [...lit("RCT-"), ...rep(D, 6), { kind: "lit", ch: "-" }, ...rep(UD, 4)],
);

/** Email: local@domain(.label)+ with a loop-bearing hand-built DFA. */
const LOCAL: CharClass = {
  kind: "set",
  chars: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._",
  label: "[A-Za-z0-9._]",
};
export const emailDFA: DFA = {
  key: "email",
  label: "Email",
  regex: /^[A-Za-z0-9._]+@[A-Za-z0-9]+(\.[A-Za-z0-9]+)+$/,
  example: "aisha.khan@mail.com",
  states: ["q0", "q1", "q2", "q3", "q4", "q5"],
  start: "q0",
  accept: ["q5"],
  transitions: {
    q0: [{ on: LOCAL, to: "q1" }],
    q1: [
      { on: LOCAL, to: "q1" },
      { on: { kind: "lit", ch: "@" }, to: "q2" },
    ],
    q2: [{ on: A, to: "q3" }],
    q3: [
      { on: A, to: "q3" },
      { on: { kind: "lit", ch: "." }, to: "q4" },
    ],
    q4: [{ on: A, to: "q5" }],
    q5: [
      { on: A, to: "q5" },
      { on: { kind: "lit", ch: "." }, to: "q4" },
    ],
  },
};

export const ALL_DFAS: DFA[] = [
  restaurantIdDFA,
  orderIdDFA,
  zoneCodeDFA,
  complaintCodeDFA,
  phoneDFA,
  emailDFA,
  reportIdDFA,
];

/** True when the DFA and its regex give the same verdict for the input. */
export function dfaRegexAgree(dfa: DFA, input: string): boolean {
  return simulate(dfa, input).accepted === dfa.regex.test(input);
}

/** Total transition count, for display. */
export function transitionCount(dfa: DFA): number {
  return Object.values(dfa.transitions).reduce((n, t) => n + t.length, 0);
}
