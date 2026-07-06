// Auto-Pilot: settings store + rule executor.
// Runs on every tick from useAutoPilot() to advance stages, fire reminders,
// escalate breaches, and auto-assign leads — all without a click.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { usePipeline } from "@/lib/pipeline/store";
import { useApp } from "@/lib/store";
import { autoAssign } from "@/lib/routing";
import { logAction } from "@/lib/monitoring/activity-store";
import { runRules } from "./automation-rules";
import { canAdvance, dossierCompletion } from "./stage-engine";
import type { PipelineStage } from "./stage-config";
import type { UnifiedLead } from "@/lib/lead-identity/types";

interface AutoPilotSettings {
  enabled: boolean;               // master switch
  autoAssign: boolean;            // route new leads to best TCM
  autoAdvance: boolean;           // auto NEW→CONTACTED→TOURED etc
  autoReminders: boolean;         // fire tour reminders
  autoEscalate: boolean;          // one grouped manager alert on breach
  perLeadPaused: Record<string, boolean>;
  lastEscalationTs: number;
  setEnabled: (v: boolean) => void;
  toggle: (k: Exclude<keyof AutoPilotSettings,
    "setEnabled" | "toggle" | "pause" | "resume" | "perLeadPaused" | "lastEscalationTs" | "markEscalated">) => void;
  pause: (leadId: string) => void;
  resume: (leadId: string) => void;
  markEscalated: () => void;
}

export const useAutoPilot = create<AutoPilotSettings>()(
  persist(
    (set, get) => ({
      enabled: true,
      autoAssign: true,
      autoAdvance: true,
      autoReminders: true,
      autoEscalate: true,
      perLeadPaused: {},
      lastEscalationTs: 0,
      setEnabled: (v) => set({ enabled: v }),
      toggle: (k) => set({ [k]: !get()[k] } as never),
      pause: (leadId) => set((s) => ({ perLeadPaused: { ...s.perLeadPaused, [leadId]: true } })),
      resume: (leadId) => set((s) => {
        const next = { ...s.perLeadPaused }; delete next[leadId];
        return { perLeadPaused: next };
      }),
      markEscalated: () => set({ lastEscalationTs: Date.now() }),
    }),
    { name: "gharpayy-autopilot-v1" },
  ),
);

/** Return true if the lead has replied to any outbound WA — used for CONTACTED. */
function hasReplied(lead: UnifiedLead): boolean {
  return Boolean((lead as unknown as { replied?: boolean }).replied);
}

/** Called on lead creation to auto-assign to the best TCM. */
export function autoAssignOnCreate(leadUlid: string, leadName: string) {
  const s = useAutoPilot.getState();
  if (!s.enabled || !s.autoAssign) return;
  const app = useApp.getState();
  // Build a minimal Lead-shape adapter using UnifiedLead's area.
  const unified = useIdentityStore.getState().leads.find((l) => l.ulid === leadUlid);
  if (!unified) return;
  const pseudoLead = {
    id: leadUlid,
    name: leadName,
    preferredArea: unified.area ?? unified.areas?.[0] ?? "",
    stage: "new" as const,
    intent: "warm" as const,
    assignedTcmId: "",
  };
  const suggestion = autoAssign(
    pseudoLead as never,
    app.tcms,
    app.leads,
    app.tours,
  );
  if (!suggestion?.tcmId) return;
  const tcm = app.tcms.find((t) => t.id === suggestion.tcmId);
  if (!tcm) return;
  useIdentityStore.getState().assignLead(
    leadUlid, tcm.id, tcm.name,
    `auto-pilot · ${suggestion.reasons.slice(0, 2).join(", ")}`,
  );
  logAction({
    userId: "auto-pilot", userName: "Auto-Pilot",
    leadId: leadUlid, leadName,
    action: "auto-assigned", feature: "auto-pilot",
    remarks: suggestion.reasons.join(" · "),
  });
}

/** Try to auto-advance a lead based on its current signals. */
function tryAutoAdvance(lead: UnifiedLead): void {
  const pipe = usePipeline.getState();
  const state = pipe.states[lead.ulid];
  if (!state) return;
  const cur = state.currentStage;
  const next: PipelineStage | null = pickNextStage(cur, lead, state.dossier ? dossierCompletion(state.dossier) : 0);
  if (!next || next === cur) return;
  const check = canAdvance(state, next);
  if (!check.ok) return;
  pipe.advanceStage(lead.ulid, next, {
    userId: "auto-pilot", userName: "Auto-Pilot",
    leadName: lead.name,
  });
  logAction({
    userId: "auto-pilot", userName: "Auto-Pilot",
    leadId: lead.ulid, leadName: lead.name,
    action: "auto-advanced", feature: "auto-pilot",
    stageFrom: cur, stageTo: next,
  });
}

function pickNextStage(cur: PipelineStage, lead: UnifiedLead, dossierPct: number): PipelineStage | null {
  const anchors = (lead as unknown as { anchors?: { tourDate?: string } }).anchors;
  const now = Date.now();
  switch (cur) {
    case "NEW":
      return "DOSSIER";
    case "DOSSIER":
      if (dossierPct >= 100) return "MATCHED";
      return null;
    case "MATCHED":
      if (anchors?.tourDate) return "TOUR_SCHEDULED";
      return null;
    case "TOUR_SCHEDULED":
      if (hasReplied(lead)) return "TOUR_CONFIRMED";
      return null;
    case "TOUR_CONFIRMED":
      if (anchors?.tourDate && Date.parse(anchors.tourDate) <= now) return "TOUR_IN_PROGRESS";
      return null;
    case "TOUR_IN_PROGRESS":
      if (lead.state === "visit-done") return "POST_VISIT";
      return null;
    default:
      return null;
  }
}

/** Executed by the useAutoPilot hook every tick. Pure side-effects. */
export function runAutoPilotTick(now: number = Date.now()): {
  advanced: number; reminders: number; breaches: number;
} {
  const s = useAutoPilot.getState();
  if (!s.enabled) return { advanced: 0, reminders: 0, breaches: 0 };
  const leads = useIdentityStore.getState().leads;
  const pipeStates = usePipeline.getState().states;

  let advanced = 0, reminders = 0, breaches = 0;

  for (const lead of leads) {
    if (s.perLeadPaused[lead.ulid]) continue;

    if (s.autoAdvance) {
      const before = pipeStates[lead.ulid]?.currentStage;
      tryAutoAdvance(lead);
      const after = usePipeline.getState().states[lead.ulid]?.currentStage;
      if (before !== after) advanced++;
    }

    const state = usePipeline.getState().states[lead.ulid];
    if (!state) continue;
    const actions = runRules(lead.ulid, state, now);
    for (const a of actions) {
      if (a.kind === "reminder" && s.autoReminders) {
        reminders++;
        logAction({
          userId: "auto-pilot", userName: "Auto-Pilot",
          leadId: lead.ulid, leadName: lead.name,
          action: "auto-reminder", feature: "auto-pilot",
          remarks: a.label,
        });
      }
      if (a.kind === "sla-breach") breaches++;
    }
  }

  // Grouped escalation: at most one alert every 5 minutes.
  if (s.autoEscalate && breaches > 0 && now - s.lastEscalationTs > 5 * 60_000) {
    logAction({
      userId: "auto-pilot", userName: "Auto-Pilot",
      action: "auto-escalation", feature: "auto-pilot",
      remarks: `${breaches} SLA breaches — grouped manager alert`,
    });
    useAutoPilot.getState().markEscalated();
  }

  return { advanced, reminders, breaches };
}
