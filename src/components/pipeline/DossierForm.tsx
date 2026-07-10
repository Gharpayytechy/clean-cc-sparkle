import { useState } from "react";
import { usePipeline } from "@/lib/pipeline/store";
import {
  dossierFieldStatus,
  missingDossierFields,
} from "@/lib/pipeline/stage-engine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useIdentityStore } from "@/lib/lead-identity/store";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, MinusCircle, SkipForward, X } from "lucide-react";
import type { Dossier } from "@/lib/pipeline/types";
import {
  SIGNAL_PRESETS, CLOSING_EXPECTATIONS, GOAL_OPTIONS, LEAD_PERSONAS,
  DOSSIER_FIELD_LABELS,
} from "@/lib/pipeline/dossier-presets";

interface Props { leadId: string; }

type FieldKey = keyof Dossier;

/**
 * Rich, live dossier form. Every field shows a status dot
 * (green filled · red empty · amber skipped) and can be deferred with a reason.
 */
export function DossierForm({ leadId }: Props) {
  const dossier = usePipeline((s) => s.states[leadId]?.dossier ?? { completionPct: 0 } as Dossier);
  const updateDossier = usePipeline((s) => s.updateDossier);
  const advanceStage = usePipeline((s) => s.advanceStage);
  const user = useIdentityStore((s) => s.currentUser);
  const missing = missingDossierFields(dossier);

  const patch = (p: Partial<Dossier>) =>
    updateDossier(leadId, p, { userId: user.id, userName: user.name });

  const skip = (key: FieldKey, reason: string) => {
    const next = { ...(dossier.skipped ?? {}) };
    if (reason) next[key as string] = reason;
    else delete next[key as string];
    patch({ skipped: next });
  };

  const unskip = (key: FieldKey) => skip(key, "");

  const toggleSignal = (s: string) => {
    const cur = dossier.signals ?? [];
    patch({ signals: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
  };

  return (
    <div className="space-y-4">
      {/* Deal read — the "can we even close this?" section, up top */}
      <Section title="Deal read" subtitle="Set this before you call. If it's 'try nearby' — reassign.">
        <div className="grid grid-cols-2 gap-3">
          <FieldRow
            k="closingExpectation" dossier={dossier}
            onSkip={(r) => skip("closingExpectation", r)} onUnskip={() => unskip("closingExpectation")}
          >
            <div className="grid grid-cols-2 gap-1.5">
              {CLOSING_EXPECTATIONS.map((o) => {
                const active = dossier.closingExpectation === o.key;
                return (
                  <button key={o.key}
                    type="button"
                    onClick={() => patch({ closingExpectation: o.key })}
                    className={cn(
                      "text-[11px] px-2 py-1.5 rounded-md border transition",
                      active ? o.tone : "bg-background text-muted-foreground border-border hover:bg-muted",
                    )}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </FieldRow>

          <FieldRow
            k="goal" dossier={dossier}
            onSkip={(r) => skip("goal", r)} onUnskip={() => unskip("goal")}
          >
            <div className="flex gap-1.5">
              {GOAL_OPTIONS.map((o) => {
                const active = dossier.goal === o.key;
                return (
                  <button key={o.key} type="button"
                    onClick={() => patch({ goal: o.key })}
                    className={cn(
                      "flex-1 text-[11px] px-2 py-1.5 rounded-md border transition",
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "bg-background text-muted-foreground border-border hover:bg-muted",
                    )}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </FieldRow>
        </div>
      </Section>

      {/* Who is coming — persona */}
      <Section title="Who is coming" subtitle="Solo? Couple? Group of 10 interns? Pitch shifts either way.">
        <FieldRow
          k="leadPersona" dossier={dossier} inline
          onSkip={(r) => skip("leadPersona", r)} onUnskip={() => unskip("leadPersona")}
        >
          <div className="flex flex-wrap gap-1.5">
            {LEAD_PERSONAS.map((p) => {
              const active = dossier.leadPersona === p.key;
              return (
                <button key={p.key} type="button"
                  onClick={() => patch({ leadPersona: p.key })}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border transition inline-flex items-center gap-1",
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "bg-background text-muted-foreground border-border hover:bg-muted",
                  )}>
                  <span>{p.emoji}</span>{p.label}
                </button>
              );
            })}
            {(dossier.leadPersona?.startsWith("group") || dossier.leadPersona === "family") && (
              <div className="inline-flex items-center gap-1 ml-2">
                <span className="text-[10px] text-muted-foreground">Size</span>
                <Input
                  type="number" min={2}
                  className="h-7 w-16 text-xs"
                  value={dossier.groupSize ?? ""}
                  onChange={(e) => patch({ groupSize: Number(e.target.value) || undefined })}
                />
              </div>
            )}
          </div>
        </FieldRow>
      </Section>

      {/* Signals chip strip */}
      <Section title="Notes & signals" subtitle="Tap to mark. These flow to the header for scan-at-a-glance.">
        <div className="flex flex-wrap gap-1.5">
          {SIGNAL_PRESETS.map((s) => {
            const active = (dossier.signals ?? []).includes(s.key);
            const toneOn =
              s.tone === "hot"  ? "border-destructive/50 bg-destructive/10 text-destructive"
            : s.tone === "warn" ? "border-warning/50 bg-warning/10 text-warning"
            :                     "border-muted-foreground/30 bg-muted text-muted-foreground";
            return (
              <button key={s.key} type="button" onClick={() => toggleSignal(s.key)}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-full border transition inline-flex items-center gap-1",
                  active ? toneOn : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}>
                {active && <span className="text-[10px]">✓</span>}
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Feasibility grid */}
      <Section title="Feasibility">
        <div className="grid grid-cols-3 gap-3">
          <FieldRow k="moveDate" dossier={dossier}
            onSkip={(r) => skip("moveDate", r)} onUnskip={() => unskip("moveDate")}>
            <Input type="date" value={dossier.moveDate ?? ""}
              onChange={(e) => patch({ moveDate: e.target.value })} />
          </FieldRow>
          <FieldRow k="budget" dossier={dossier}
            onSkip={(r) => skip("budget", r)} onUnskip={() => unskip("budget")}>
            <Input type="number" placeholder="₹" value={dossier.budget ?? ""}
              onChange={(e) => patch({ budget: Number(e.target.value) })} />
          </FieldRow>
          <FieldRow k="area" dossier={dossier}
            onSkip={(r) => skip("area", r)} onUnskip={() => unskip("area")}>
            <Input value={dossier.area ?? ""}
              onChange={(e) => patch({ area: e.target.value })} />
          </FieldRow>

          <FieldRow k="gender" dossier={dossier}
            onSkip={(r) => skip("gender", r)} onUnskip={() => unskip("gender")}>
            <Select value={dossier.gender ?? ""} onValueChange={(v) => patch({ gender: v as Dossier["gender"] })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="coed">Coed</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow k="sharing" dossier={dossier}
            onSkip={(r) => skip("sharing", r)} onUnskip={() => unskip("sharing")}>
            <Select value={dossier.sharing ?? ""} onValueChange={(v) => patch({ sharing: v as Dossier["sharing"] })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="double">Double</SelectItem>
                <SelectItem value="triple">Triple</SelectItem>
                <SelectItem value="any">Any</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow k="movingFeasibility" dossier={dossier}
            onSkip={(r) => skip("movingFeasibility", r)} onUnskip={() => unskip("movingFeasibility")}>
            <Select value={dossier.movingFeasibility ?? ""} onValueChange={(v) => patch({ movingFeasibility: v as Dossier["movingFeasibility"] })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="7d">Within 7 days</SelectItem>
                <SelectItem value="15d">Within 15 days</SelectItem>
                <SelectItem value="30d">Within 30 days</SelectItem>
                <SelectItem value="researching">Just researching</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow k="decisionMaker" dossier={dossier}
            onSkip={(r) => skip("decisionMaker", r)} onUnskip={() => unskip("decisionMaker")}>
            <Select value={dossier.decisionMaker ?? ""} onValueChange={(v) => patch({ decisionMaker: v as Dossier["decisionMaker"] })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Self</SelectItem>
                <SelectItem value="parents">Parents</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow k="competition" dossier={dossier}
            onSkip={(r) => skip("competition", r)} onUnskip={() => unskip("competition")}>
            <Select value={dossier.competition ?? ""} onValueChange={(v) => patch({ competition: v as Dossier["competition"] })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visiting">Visiting others</SelectItem>
                <SelectItem value="booked">Booked elsewhere</SelectItem>
                <SelectItem value="comparing">Comparing</SelectItem>
                <SelectItem value="none">No competition</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow k="objection" dossier={dossier}
            onSkip={(r) => skip("objection", r)} onUnskip={() => unskip("objection")}>
            <Select value={dossier.objection ?? ""} onValueChange={(v) => patch({ objection: v as Dossier["objection"] })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="parents">Parents</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
                <SelectItem value="timing">Timing</SelectItem>
                <SelectItem value="exploring">Still exploring</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </Section>

      <div>
        <Label className="text-xs">Notes / properties sent (P1, P2, P3, PDF, video)</Label>
        <Textarea rows={2} value={dossier.objectionNotes ?? ""}
          onChange={(e) => patch({ objectionNotes: e.target.value })}
          placeholder="e.g. Sent P1 Bliss + P2 Metrofield + PDF" />
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {missing.length === 0
            ? "All fields captured or skipped — ready to match property."
            : `${missing.length} field${missing.length > 1 ? "s" : ""} remaining: ${
                missing.slice(0, 3).map((k) => DOSSIER_FIELD_LABELS[k as string] ?? k).join(", ")
              }${missing.length > 3 ? "…" : ""}`}
        </div>
        <Button
          size="sm"
          disabled={missing.length > 0}
          onClick={() => advanceStage(leadId, "MATCHED", { userId: user.id, userName: user.name })}
        >
          Lock dossier → Property match
        </Button>
      </div>
    </div>
  );
}

/* ─────────── helpers ─────────── */

function Section({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground/70">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function FieldRow({
  k, dossier, children, inline, onSkip, onUnskip,
}: {
  k: FieldKey;
  dossier: Dossier;
  children: React.ReactNode;
  inline?: boolean;
  onSkip: (reason: string) => void;
  onUnskip: () => void;
}) {
  const status = dossierFieldStatus(dossier, k);
  const label = DOSSIER_FIELD_LABELS[k as string] ?? String(k);
  const skipReason = dossier.skipped?.[k as string];

  const Dot =
    status === "filled"  ? <CheckCircle2 className="h-3 w-3 text-success" />
  : status === "skipped" ? <MinusCircle  className="h-3 w-3 text-warning" />
  :                        <Circle       className="h-3 w-3 text-destructive" />;

  return (
    <div className={cn(
      "space-y-1 rounded-md p-1.5 -m-1.5 transition",
      status === "empty"   && "bg-destructive/5",
      status === "skipped" && "bg-warning/5",
    )}>
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5", inline && "text-xs")}>
          {Dot}
          <Label className="text-[11px] leading-none">{label}</Label>
          {status === "skipped" && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-warning/20 text-warning">
              later · {skipReason}
            </span>
          )}
        </div>
        {status === "skipped" ? (
          <button type="button" onClick={onUnskip}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
            <X className="h-2.5 w-2.5" /> undo
          </button>
        ) : status === "empty" ? (
          <SkipPopover onSkip={onSkip} />
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SkipPopover({ onSkip }: { onSkip: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const submit = (r: string) => {
    onSkip(r || "ask later");
    setReason(""); setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
          <SkipForward className="h-2.5 w-2.5" /> skip
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Why defer?</div>
        <div className="flex flex-wrap gap-1">
          {["will ask later", "not urgent", "waiting on lead", "not comfortable asking"].map((r) => (
            <button key={r} type="button" onClick={() => submit(r)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted">
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Input className="h-7 text-xs" placeholder="Custom reason"
            value={reason} onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(reason)} />
          <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => submit(reason)}>OK</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
