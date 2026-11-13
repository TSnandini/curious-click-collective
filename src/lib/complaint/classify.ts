import { CATEGORIES, CODE_PREFIX, URGENCY_PRIORITY, type Category, type Urgency } from "./constants";

/** Keyword patterns per category. Phrases score 2, single words score 1. */
export const KEYWORDS: Record<Category, string[]> = {
  "Food Quality": [
    "cold", "stale", "undercooked", "raw", "burnt", "taste", "tasteless", "salty", "spoiled",
    "rotten", "overcooked", "bland", "quality", "portion", "soggy", "spicy", "uncooked",
  ],
  Service: [
    "rude", "waiter", "staff", "slow service", "ignored", "waited", "behaviour", "behavior",
    "attitude", "manager", "unprofessional", "reservation", "service", "impolite",
  ],
  Hygiene: [
    "dirty", "cockroach", "insect", "hair", "unclean", "smell", "sick", "food poisoning",
    "poisoning", "vomit", "vomiting", "rat", "mould", "mold", "washroom", "flies", "kitchen",
  ],
  Billing: [
    "bill", "overcharged", "charged", "double charged", "refund", "payment", "invoice", "price",
    "card", "tax", "discount", "receipt", "fraud",
  ],
  Delivery: [
    "delivery", "delivered", "late", "delayed", "rider", "driver", "missing item", "wrong order",
    "packaging", "spilled", "never arrived", "courier",
  ],
};

/** Tie-break order when two categories score equally — safety first. */
export const SEVERITY_ORDER: Category[] = ["Hygiene", "Food Quality", "Delivery", "Billing", "Service"];

export const CODE_WEIGHT = 3;

export interface Classification {
  category: Category;
  scores: Record<Category, number>;
  matched: Record<Category, string[]>;
  conflict: boolean;
  resolution: string;
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function classify(description: string, complaintCode: string): Classification {
  const text = description.toLowerCase();
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const matched = Object.fromEntries(CATEGORIES.map((c) => [c, [] as string[]])) as Record<Category, string[]>;

  for (const cat of CATEGORIES) {
    for (const kw of KEYWORDS[cat]) {
      const re = new RegExp(`\\b${escape(kw)}\\b`, "i");
      if (re.test(text)) {
        scores[cat] += kw.includes(" ") ? 2 : 1;
        matched[cat].push(kw);
      }
    }
  }

  const codeCat = CODE_PREFIX[complaintCode.slice(0, 2).toUpperCase()];
  if (codeCat) {
    scores[codeCat] += CODE_WEIGHT;
    matched[codeCat].push(`code ${complaintCode.slice(0, 2).toUpperCase()}`);
  }

  // Rank: score desc, then severity order.
  const ranked = [...CATEGORIES].sort(
    (a, b) => scores[b] - scores[a] || SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
  );
  const top = ranked[0]!;
  const second = ranked[1]!;
  const textOnly = (c: Category) => scores[c] - (c === codeCat ? CODE_WEIGHT : 0);

  // Conflict: the description points at a different category at least as strongly as the winner's own words.
  const conflict =
    scores[second] > 0 && (scores[top] - scores[second] <= 1 || textOnly(second) >= textOnly(top));

  let resolution: string;
  if (!conflict) resolution = `Clear match: ${top}`;
  else if (scores[top] === scores[second])
    resolution = `Tie between ${top} and ${second} — resolved by severity order`;
  else resolution = `Description also points to ${second} — complaint code and keyword weight favour ${top}`;

  return { category: top, scores, matched, conflict, resolution };
}

/** Priority rules: urgency sets the base, health and fraud rules can override upward. */
export interface PriorityDecision {
  priority: number;
  base: number;
  override: string | null;
}

const HEALTH = /\b(food poisoning|poisoning|vomit|vomiting|allergic|allergy|hospital|sick)\b/i;
const FRAUD = /\b(fraud|double charged|scam)\b/i;

export function decidePriority(urgency: Urgency, category: Category, description: string): PriorityDecision {
  const base = URGENCY_PRIORITY[urgency];
  if (HEALTH.test(description) && (category === "Hygiene" || category === "Food Quality") && base > 1) {
    return { priority: 1, base, override: `Health-risk override: ${urgency} → P1 Critical` };
  }
  if (FRAUD.test(description) && category === "Billing" && base > 2) {
    return { priority: 2, base, override: `Billing-fraud override: ${urgency} → P2 High` };
  }
  return { priority: base, base, override: null };
}
