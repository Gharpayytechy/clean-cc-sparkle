import { usePipeline } from "@/lib/pipeline/store";
import {
  SIGNAL_PRESETS, CLOSING_EXPECTATIONS, GOAL_OPTIONS, LEAD_PERSONAS,
} from "@/lib/pipeline/dossier-presets";
import { cn } from "@/lib/utils";

interface Props { leadId: string; }

/**
 * Compact chip strip that mirrors the most-important dossier fields
 * into the header — so the TCM can scan without scrolling into the form.
 */
export function DossierHeaderStrip({ leadId }: Props) {
  const d = usePipeline((s) => s.states[leadId]?.dossier);
  if (!d) return null;

  const chips: { label: string; tone: string }[] = [];

  if (d.closingExpectation) {
    const opt = CLOSING_EXPECTATIONS.find((o) => o.key === d.closingExpectation);
    if (opt) chips.push({ label: `close · ${opt.label}`, tone: opt.tone });
  }
  if (d.goal) {
    const opt = GOAL_OPTIONS.find((o) => o.key === d.goal);
    if (opt) chips.push({
      label: `goal · ${opt.label.split(" ")[0]}`,
      tone: "bg-accent/10 text-accent border-accent/40",
    });
  }
  if (d.leadPersona) {
    const opt = LEAD_PERSONAS.find((o) => o.key === d.leadPersona);
    if (opt) chips.push({
      label: `${opt.emoji} ${opt.label}${d.groupSize ? ` × ${d.groupSize}` : ""}`,
      tone: "bg-muted text-foreground border-border",
    });
  }
  if (d.budget) chips.push({
    label: `₹${d.budget.toLocaleString("en-IN")}`,
    tone: "bg-muted text-foreground border-border",
  });
  if (d.area) chips.push({
    label: d.area, tone: "bg-muted text-foreground border-border",
  });
  if (d.moveDate) chips.push({
    label: `move · ${d.moveDate}`, tone: "bg-muted text-foreground border-border",
  });
  if (d.decisionMaker) chips.push({
    label: `DM · ${d.decisionMaker}`, tone: "bg-muted text-foreground border-border",
  });

  for (const s of d.signals ?? []) {
    const opt = SIGNAL_PRESETS.find((p) => p.key === s);
    const label = opt?.label ?? s;
    const tone = opt?.tone === "hot"
      ? "bg-destructive/10 text-destructive border-destructive/40"
      : opt?.tone === "warn"
      ? "bg-warning/10 text-warning border-warning/40"
      : "bg-muted text-muted-foreground border-border";
    chips.push({ label, tone });
  }

  if (chips.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground italic">
        No dossier data yet — fill the form below so the header can help you at a glance.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span key={i} className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full border",
          c.tone,
        )}>{c.label}</span>
      ))}
    </div>
  );
}
