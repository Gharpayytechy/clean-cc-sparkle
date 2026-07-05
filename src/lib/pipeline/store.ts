// Per-lead pipeline state store — layered on top of the existing lead-identity store.
// Keyed by ULID. Persisted to localStorage.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { canAdvance, dossierCompletion, initialPipelineState, newGate } from "./stage-engine";
import type { PipelineStage } from "./stage-config";
import type { Dossier, PipelineState } from "./types";
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
    }),
    { name: "gharpayy-pipeline-v1" },
  ),
);
