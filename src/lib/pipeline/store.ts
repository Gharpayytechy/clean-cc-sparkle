// Per-lead pipeline state store — layered on top of the existing lead-identity store.
// Keyed by ULID. Persisted to localStorage.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { canAdvance, dossierCompletion, initialPipelineState, newGate } from "./stage-engine";
import type { PipelineStage } from "./stage-config";
import type { Dossier, PipelineState, StageEvidence } from "./types";
import { logAction } from "@/lib/monitoring/activity-store";

interface PipelineStore {
  states: Record<string, PipelineState>;
  ensure: (leadId: string) => PipelineState;
  updateDossier: (
    leadId: string, patch: Partial<Dossier>,
    actor?: { userId: string; userName: string; leadName?: string },
  ) => void;
  advanceStage: (
    leadId: string, to: PipelineStage,
    actor?: { userId: string; userName: string; leadName?: string },
  ) => { ok: boolean; reason?: string };
  setTour: (leadId: string, patch: Partial<NonNullable<PipelineState["tour"]>>) => void;
  setPostVisit: (leadId: string, patch: NonNullable<PipelineState["postVisit"]>) => void;
  setQuote: (leadId: string, patch: NonNullable<PipelineState["quote"]>) => void;
  setBooking: (leadId: string, patch: NonNullable<PipelineState["booking"]>) => void;
  overrideGate: (leadId: string, reason: string, by: string) => void;
  attachEvidence: (
    leadId: string, stage: PipelineStage,
    ev: Omit<StageEvidence, "id" | "uploadedAt">,
    actor?: { userId: string; userName: string; leadName?: string },
  ) => void;
  requestEvidence: (
    leadId: string, stage: PipelineStage, by: string, reason?: string,
    actor?: { userId: string; userName: string; leadName?: string },
  ) => void;
  verifyEvidence: (leadId: string, stage: PipelineStage, evidenceId: string, by: string) => void;
  applyDossierPreset: (
    leadId: string, patch: Partial<Dossier>,
    actor?: { userId: string; userName: string; leadName?: string },
  ) => void;
}

export const usePipeline = create<PipelineStore>()(
  persist(
    (set, get) => ({
      states: {},

      ensure: (leadId) => {
        const existing = get().states[leadId];
        if (existing) return existing;
        const fresh = initialPipelineState();
        set((s) => ({ states: { ...s.states, [leadId]: fresh } }));
        return fresh;
      },

      updateDossier: (leadId, patch, actor) => {
        set((s) => {
          const cur = s.states[leadId] ?? initialPipelineState();
          const nextDossier = { ...cur.dossier, ...patch };
          nextDossier.completionPct = dossierCompletion(nextDossier);
          if (nextDossier.completionPct === 100 && !nextDossier.completedAt) {
            nextDossier.completedAt = new Date().toISOString();
          }
          return {
            states: { ...s.states, [leadId]: { ...cur, dossier: nextDossier } },
          };
        });
        if (actor) {
          logAction({
            userId: actor.userId, userName: actor.userName,
            leadId, leadName: actor.leadName,
            action: "dossier-updated", feature: "dossier-form",
          });
        }
      },

      advanceStage: (leadId, to, actor) => {
        const cur = get().states[leadId] ?? initialPipelineState();
        const check = canAdvance(cur, to);
        if (!check.ok) return check;
        set((s) => {
          const c = s.states[leadId] ?? initialPipelineState();
          return {
            states: {
              ...s.states,
              [leadId]: {
                ...c,
                currentStage: to,
                history: [...c.history, newGate(to)],
              },
            },
          };
        });
        if (actor) {
          logAction({
            userId: actor.userId, userName: actor.userName,
            leadId, leadName: actor.leadName,
            action: "stage-changed", feature: `advance-to-${to}`,
            stageFrom: cur.currentStage, stageTo: to,
          });
        }
        return { ok: true };
      },

      setTour: (leadId, patch) => {
        set((s) => {
          const cur = s.states[leadId] ?? initialPipelineState();
          const tour = {
            date: cur.tour?.date ?? "",
            remindersSent: cur.tour?.remindersSent ?? [],
            ...cur.tour, ...patch,
          };
          return { states: { ...s.states, [leadId]: { ...cur, tour } } };
        });
      },

      setPostVisit: (leadId, patch) => {
        set((s) => {
          const cur = s.states[leadId] ?? initialPipelineState();
          return { states: { ...s.states, [leadId]: { ...cur, postVisit: patch } } };
        });
      },

      setQuote: (leadId, patch) => {
        set((s) => {
          const cur = s.states[leadId] ?? initialPipelineState();
          return { states: { ...s.states, [leadId]: { ...cur, quote: patch } } };
        });
      },

      setBooking: (leadId, patch) => {
        set((s) => {
          const cur = s.states[leadId] ?? initialPipelineState();
          return { states: { ...s.states, [leadId]: { ...cur, booking: patch } } };
        });
      },

      overrideGate: (leadId, reason, by) => {
        set((s) => {
          const cur = s.states[leadId];
          if (!cur) return s;
          const history = [...cur.history];
          const last = history[history.length - 1];
          history[history.length - 1] = {
            ...last,
            managerOverride: { by, reason, at: new Date().toISOString() },
          };
          return { states: { ...s.states, [leadId]: { ...cur, history } } };
        });
      },


      attachEvidence: (leadId, stage, ev, actor) => {
        set((s) => {
          const cur = s.states[leadId];
          if (!cur) return s;
          const history = cur.history.map((g) => {
            if (g.stage !== stage) return g;
            const newEv: StageEvidence = {
              ...ev,
              id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              uploadedAt: new Date().toISOString(),
            };
            return { ...g, evidence: [...(g.evidence ?? []), newEv], evidenceRequested: undefined };
          });
          return { states: { ...s.states, [leadId]: { ...cur, history } } };
        });
        if (actor) {
          logAction({
            userId: actor.userId, userName: actor.userName,
            leadId, leadName: actor.leadName,
            action: "evidence-attached", feature: `evidence-${stage}`,
          });
        }
      },

      requestEvidence: (leadId, stage, by, reason, actor) => {
        set((s) => {
          const cur = s.states[leadId];
          if (!cur) return s;
          const history = cur.history.map((g) =>
            g.stage === stage
              ? { ...g, evidenceRequested: { by, reason, at: new Date().toISOString() } }
              : g,
          );
          return { states: { ...s.states, [leadId]: { ...cur, history } } };
        });
        if (actor) {
          logAction({
            userId: actor.userId, userName: actor.userName,
            leadId, leadName: actor.leadName,
            action: "evidence-requested", feature: `request-evidence-${stage}`,
            remarks: reason,
          });
        }
      },

      verifyEvidence: (leadId, stage, evidenceId, by) => {
        set((s) => {
          const cur = s.states[leadId];
          if (!cur) return s;
          const history = cur.history.map((g) => {
            if (g.stage !== stage) return g;
            const evidence = (g.evidence ?? []).map((e) =>
              e.id === evidenceId ? { ...e, verifiedBy: by, verifiedAt: new Date().toISOString() } : e,
            );
            return { ...g, evidence };
          });
          return { states: { ...s.states, [leadId]: { ...cur, history } } };
        });
      },

      applyDossierPreset: (leadId, patch, actor) => {
        set((s) => {
          const cur = s.states[leadId] ?? initialPipelineState();
          // Merge signals arrays instead of overwriting.
          const mergedSignals = Array.from(new Set([
            ...(cur.dossier.signals ?? []),
            ...(patch.signals ?? []),
          ]));
          const nextDossier: Dossier = {
            ...cur.dossier,
            ...patch,
            ...(patch.signals ? { signals: mergedSignals } : {}),
          };
          nextDossier.completionPct = dossierCompletion(nextDossier);
          return { states: { ...s.states, [leadId]: { ...cur, dossier: nextDossier } } };
        });
        if (actor) {
          logAction({
            userId: actor.userId, userName: actor.userName,
            leadId, leadName: actor.leadName,
            action: "preset-applied", feature: "dossier-quick-preset",
          });
        }
      },
    }),
    { name: "gharpayy-pipeline-v1" },
  ),
);
