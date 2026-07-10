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

export const LEAD_PERSONAS: { key: NonNullable<Dossier["leadPersona"]>; label: string; emoji: string }[] = [
  { key: "self",           label: "Self",             emoji: "🙋" },
  { key: "couple",         label: "Couple",           emoji: "💑" },
  { key: "student",        label: "Student",          emoji: "🎓" },
  { key: "working-pro",    label: "Working pro",      emoji: "💼" },
  { key: "family",         label: "Family",           emoji: "👨‍👩‍👧" },
  { key: "group-interns",  label: "Group · interns",  emoji: "🧑‍💻" },
  { key: "group-friends",  label: "Group · friends",  emoji: "👯" },
  { key: "other",          label: "Other",            emoji: "•" },
];

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
