import { z } from "zod";
import { CODE_PREFIX, URGENCIES, ZONE_PREFIX, UNKNOWN_ZONE, type Urgency } from "./constants";
import {
  complaintCodeDFA, emailDFA, orderIdDFA, phoneDFA, restaurantIdDFA, simulate, zoneCodeDFA, type DFA,
} from "./dfa";

export interface ReportInput {
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string;
  restaurantId: string;
  orderId: string;
  zoneCode: string;
  complaintCode: string;
  description: string;
  urgency: Urgency;
}

export type FieldErrors = Partial<Record<keyof ReportInput, string>>;

export const FIELD_DFA: Partial<Record<keyof ReportInput, DFA>> = {
  reporterEmail: emailDFA,
  reporterPhone: phoneDFA,
  restaurantId: restaurantIdDFA,
  orderId: orderIdDFA,
  zoneCode: zoneCodeDFA,
  complaintCode: complaintCodeDFA,
};

export const reportInputSchema = z.object({
  reporterName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  reporterEmail: z.string().trim().max(120),
  reporterPhone: z.string().trim().max(15),
  restaurantId: z.string().trim().max(20),
  orderId: z.string().trim().max(20),
  zoneCode: z.string().trim().max(10),
  complaintCode: z.string().trim().max(10),
  description: z.string().trim().min(15, "Describe the issue in at least 15 characters").max(1000),
  urgency: z.enum(URGENCIES),
});

/** Validate a single field. Structured fields go through their DFA. */
export function validateField(field: keyof ReportInput, raw: string): string | null {
  const value = raw.trim();
  const dfa = FIELD_DFA[field];
  if (dfa) {
    if (!value) return `${dfa.label} is required`;
    const res = simulate(dfa, value);
    if (!res.accepted) return `${dfa.label} must look like ${dfa.example} — ${res.reason}`;
    if (field === "complaintCode" && !CODE_PREFIX[value.slice(0, 2)])
      return `Unknown code prefix "${value.slice(0, 2)}" — use FQ, SV, HY, BL or DL`;
    return null;
  }
  if (field === "reporterName") {
    if (value.length < 2) return "Name must be at least 2 characters";
    if (value.length > 80) return "Name is too long";
    return null;
  }
  if (field === "description") {
    if (value.length < 15) return "Describe the issue in at least 15 characters";
    if (value.length > 1000) return "Keep it under 1000 characters";
    return null;
  }
  if (field === "urgency") return (URGENCIES as readonly string[]).includes(value) ? null : "Pick an urgency";
  return null;
}

export function validateReport(input: ReportInput): FieldErrors {
  const errors: FieldErrors = {};
  (Object.keys(input) as (keyof ReportInput)[]).forEach((k) => {
    const e = validateField(k, String(input[k] ?? ""));
    if (e) errors[k] = e;
  });
  return errors;
}

export function zoneFromCode(zoneCode: string): string {
  return ZONE_PREFIX[zoneCode.slice(0, 2).toUpperCase()] ?? UNKNOWN_ZONE;
}

/** Report ID: RCT-YYMMDD-XXXX */
export function generateReportId(now = new Date(), rand = Math.random): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += alphabet[Math.floor(rand() * alphabet.length)];
  return `RCT-${yy}${mm}${dd}-${suffix}`;
}

/** Generate an ID not already taken, retrying on collision (the database enforces the same rule). */
export function generateUniqueReportId(taken: Set<string>, now = new Date(), rand = Math.random): string {
  for (let i = 0; i < 50; i++) {
    const id = generateReportId(now, rand);
    if (!taken.has(id)) return id;
  }
  throw new Error("Could not generate a unique report ID");
}
