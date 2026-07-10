// Shared presets for the enriched Dossier UI.
import type { Dossier } from "./types";

export const SIGNAL_PRESETS: { key: string; label: string; tone: "hot" | "cold" | "warn" }[] = [
  { key: "urgent",             label: "Urgent",            tone: "hot"  },
  { key: "ready-to-pay",       label: "Ready to pay",      tone: "hot"  },
  { key: "price-issue",        label: "Price issue",       tone: "warn" },
  { key: "location-mismatch",  label: "Location mismatch", tone: "warn" },
  { key: "parents-involved",   label: "Parents involved",  tone: "warn" },
  { key: "budget-low",         label: "Budget low",        tone: "cold" },
  { key: "comparing",          label: "Comparing others",  tone: "warn" },
  { key: "walk-in-ready",      label: "Walk-in ready",     tone: "hot"  },
];

export const CLOSING_EXPECTATIONS: { key: NonNullable<Dossier["closingExpectation"]>; label: string; tone: string }[] = [
  { key: "very-high",   label: "Very high",     tone: "bg-success/15 text-success border-success/40" },
  { key: "hard",        label: "Hard close",    tone: "bg-warning/15 text-warning border-warning/40" },
  { key: "maybe",       label: "Maybe",         tone: "bg-muted text-muted-foreground border-border" },
  { key: "try-nearby",  label: "Try nearby",    tone: "bg-accent/15 text-accent border-accent/40" },
];

export const GOAL_OPTIONS: { key: NonNullable<Dossier["goal"]>; label: string }[] = [
  { key: "pb",      label: "Personal booking (PB)" },
  { key: "offline", label: "Offline visit" },
];

// Short codes make lead cards scannable — SF/SM/C/ST/WP/FAM/GI/GF.
export const LEAD_PERSONAS: {
  key: NonNullable<Dossier["leadPersona"]>;
  label: string;
  code: string;
  emoji: string;
}[] = [
  { key: "self",          label: "Self",            code: "S",   emoji: "🙋" },
  { key: "couple",        label: "Couple",          code: "C",   emoji: "💑" },
  { key: "student",       label: "Student",         code: "ST",  emoji: "🎓" },
  { key: "working-pro",   label: "Working pro",     code: "WP",  emoji: "💼" },
  { key: "family",        label: "Family",          code: "FAM", emoji: "👨‍👩‍👧" },
  { key: "group-interns", label: "Group · interns", code: "GI",  emoji: "🧑‍💻" },
  { key: "group-friends", label: "Group · friends", code: "GF",  emoji: "👯" },
  { key: "other",         label: "Other",           code: "•",   emoji: "•" },
];

/**
 * "SF" / "SM" gender-tagged short codes for the lead-card badge.
 * We derive them from persona + gender in one place so the UI stays in sync.
 */
export function personaShortCode(d: Dossier | undefined): string {
  if (!d?.leadPersona) return "—";
  const base = LEAD_PERSONAS.find((p) => p.key === d.leadPersona)?.code ?? "•";
  if (d.leadPersona === "self") {
    if (d.gender === "female") return "SF";
    if (d.gender === "male") return "SM";
  }
  if (d.groupSize && (d.leadPersona === "group-interns" || d.leadPersona === "group-friends" || d.leadPersona === "family")) {
    return `${base}×${d.groupSize}`;
  }
  return base;
}

export const DOSSIER_FIELD_LABELS: Record<string, string> = {
  moveDate: "Move date",
  budget: "Budget",
  area: "Preferred area",
  gender: "Gender",
  sharing: "Sharing",
  movingFeasibility: "Moving feasibility",
  decisionMaker: "Decision maker",
  competition: "Competition",
  objection: "Objection",
  closingExpectation: "Closing expectation",
  goal: "Goal",
  leadPersona: "Who is coming",
};

/* ─── Urgency buckets: derived from move-date, drive queue priority ─── */

export type UrgencyBucket = "today" | "tomorrow" | "this-week" | "this-month" | "next-month" | "future" | "unknown";

export const URGENCY_META: Record<UrgencyBucket, { label: string; tone: string; rank: number }> = {
  "today":      { label: "TODAY",      tone: "bg-destructive text-destructive-foreground border-destructive", rank: 0 },
  "tomorrow":   { label: "TOMORROW",   tone: "bg-destructive/20 text-destructive border-destructive/40",       rank: 1 },
  "this-week":  { label: "THIS WEEK",  tone: "bg-warning/20 text-warning border-warning/40",                    rank: 2 },
  "this-month": { label: "THIS MONTH", tone: "bg-accent/20 text-accent border-accent/40",                       rank: 3 },
  "next-month": { label: "NEXT MONTH", tone: "bg-primary/15 text-primary border-primary/30",                    rank: 4 },
  "future":     { label: "FUTURE",     tone: "bg-muted text-muted-foreground border-border",                    rank: 5 },
  "unknown":    { label: "NO DATE",    tone: "bg-muted text-muted-foreground border-border",                    rank: 6 },
};

export function computeUrgencyBucket(moveDate: string | undefined, now = new Date()): UrgencyBucket {
  if (!moveDate) return "unknown";
  const t = Date.parse(moveDate);
  if (Number.isNaN(t)) return "unknown";
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const ms = t - midnight.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "this-week";
  const sameMonth = new Date(t).getMonth() === now.getMonth() && new Date(t).getFullYear() === now.getFullYear();
  if (sameMonth) return "this-month";
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd  = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
  if (t >= nextMonth.getTime() && t <= monthEnd.getTime()) return "next-month";
  return "future";
}

/* ─── Quick-fill presets: one tap to stamp common combos ─── */

export interface QuickPreset {
  id: string;
  label: string;
  emoji: string;
  patch: Partial<Dossier>;
}

const daysFromNow = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "sf-hot-today", label: "SF · Hot · Today", emoji: "🔥",
    patch: {
      leadPersona: "self", gender: "female",
      closingExpectation: "very-high", goal: "offline",
      moveDate: daysFromNow(0), signals: ["urgent", "ready-to-pay"],
    },
  },
  {
    id: "sm-hot-tomorrow", label: "SM · Hot · Tomorrow", emoji: "🔥",
    patch: {
      leadPersona: "self", gender: "male",
      closingExpectation: "very-high", goal: "offline",
      moveDate: daysFromNow(1), signals: ["urgent"],
    },
  },
  {
    id: "wp-week", label: "Working pro · This week", emoji: "💼",
    patch: {
      leadPersona: "working-pro",
      closingExpectation: "hard", goal: "offline",
      moveDate: daysFromNow(5), decisionMaker: "self",
    },
  },
  {
    id: "student-parents", label: "Student · Parents involved", emoji: "🎓",
    patch: {
      leadPersona: "student",
      closingExpectation: "hard", goal: "offline",
      decisionMaker: "parents", signals: ["parents-involved"],
    },
  },
  {
    id: "family-next-month", label: "Family · Next month", emoji: "👨‍👩‍👧",
    patch: {
      leadPersona: "family",
      closingExpectation: "maybe", goal: "offline",
      moveDate: daysFromNow(35), decisionMaker: "self",
    },
  },
  {
    id: "interns-group", label: "Interns × group", emoji: "🧑‍💻",
    patch: {
      leadPersona: "group-interns", groupSize: 4,
      closingExpectation: "hard", goal: "pb",
      sharing: "double",
    },
  },
  {
    id: "future-nurture", label: "Future lead (nurture)", emoji: "⏳",
    patch: {
      closingExpectation: "try-nearby",
      signals: ["comparing"],
    },
  },
  {
    id: "budget-low", label: "Budget low · Try nearby", emoji: "💸",
    patch: {
      closingExpectation: "try-nearby",
      signals: ["budget-low", "price-issue"],
    },
  },
];
