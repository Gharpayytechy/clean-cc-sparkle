// Zustand store for the Lead Identity, Dedup & Ownership system.
// Mock layer — replaced by Lovable Cloud in the next pass.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  UnifiedLead, AccessRequest, ActivityEntry, ParsedLeadDraft,
  MatchResult, ActivityKind, LifecycleState,
  LeadPriority, CustomTag, AssignmentEntry,
} from "./types";
import { newUlid, normalizePhoneIN, normalizeEmail, parseBudgetToNumber } from "./normalize";
import { findMatches } from "./similarity";

interface CurrentUser {
  id: string;
  name: string;
  role: "agent" | "manager";
}

interface IdentityStore {
  leads: UnifiedLead[];
  activities: ActivityEntry[];
  requests: AccessRequest[];
  customTags: CustomTag[];
  currentUser: CurrentUser;
  setCurrentUser: (u: CurrentUser) => void;

  /** Run dedup against current store using a parsed draft. */
  checkDuplicates: (draft: Partial<ParsedLeadDraft>) => MatchResult;

  /** Create a new unified lead from a parsed draft. Caller has already resolved dedup. */
  createLead: (
    draft: ParsedLeadDraft,
    opts?: {
      ownerId?: string;
      ownerName?: string;
      quality?: import("./types").LeadQuality;
      priority?: LeadPriority;
      tags?: string[];
      earliestCheckIn?: string;
      stage?: string;
      assigneeId?: string | null;
      assigneeName?: string | null;
      zoneCategory?: string;
    },
  ) => UnifiedLead;

  /** Append an activity to a lead's timeline. */
  logActivity: (ulid: string, kind: ActivityKind, text: string, meta?: Record<string, unknown>) => void;

  requestAccess: (ulid: string, message?: string) => AccessRequest | null;
  decideRequest: (id: string, decision: "approved" | "rejected") => void;

  setSecondaryOwner: (ulid: string, ownerId: string, ownerName: string) => void;
  reassignPrimary: (ulid: string, ownerId: string, ownerName: string, reason: string) => void;
  setLifecycleState: (ulid: string, state: LifecycleState) => void;

  // New actions
  addTag: (ulid: string, tag: string) => void;
  removeTag: (ulid: string, tag: string) => void;
  setPriority: (ulid: string, priority: LeadPriority) => void;
  setEarliestCheckIn: (ulid: string, date: string) => void;
  assignLead: (ulid: string, toMemberId: string, toMemberName: string, reason?: string) => void;
  createCustomTag: (label: string, color: string) => CustomTag;
  deleteCustomTag: (id: string) => void;

  getLead: (ulid: string) => UnifiedLead | undefined;
  getActivities: (ulid: string) => ActivityEntry[];
  getRequestsForOwner: (ownerId: string) => AccessRequest[];
  getRequestsByMe: (userId: string) => AccessRequest[];
}

const nowIso = () => new Date().toISOString();

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set, get) => ({
      leads: [],
      activities: [],
      requests: [],
      customTags: [],
      currentUser: { id: "u-self", name: "You", role: "agent" },

      setCurrentUser: (u) => set({ currentUser: u }),

      checkDuplicates: (draft) => {
        const phoneE164 = normalizePhoneIN(draft.phone ?? "");
        const emailNorm = normalizeEmail(draft.email ?? "");
        return findMatches(
          { phoneE164, emailNorm, name: draft.name, area: draft.location },
          get().leads,
        );
      },

      createLead: (draft, opts) => {
        const user = get().currentUser;
        const ownerId = opts?.ownerId ?? user.id;
        const ownerName = opts?.ownerName ?? user.name;
        const ts = nowIso();
        const lead: UnifiedLead = {
          ulid: newUlid(),
          name: draft.name || "Unnamed Lead",
          phoneRaw: draft.phone,
          phoneE164: normalizePhoneIN(draft.phone),
          email: draft.email,
          emailNorm: normalizeEmail(draft.email),
          area: draft.location,
          areas: draft.areas,
          fullAddress: draft.fullAddress,
          zone: draft.zone,
          zoneCategory: opts?.zoneCategory,
          quality: opts?.quality ?? null,
          priority: opts?.priority ?? "normal",
          tags: opts?.tags ?? [],
          earliestCheckIn: opts?.earliestCheckIn,
          stage: opts?.stage,
          assigneeId: opts?.assigneeId ?? null,
          assigneeName: opts?.assigneeName ?? null,
          assignmentHistory: opts?.assigneeId
            ? [{
                ts, fromId: null, fromName: null,
                toId: opts.assigneeId, toName: opts.assigneeName ?? "",
                byActorId: user.id, byActorName: user.name,
                reason: "initial assignment",
              }]
            : [],
          budget: parseBudgetToNumber(draft.budget),
          moveInDate: draft.moveIn,
          type: draft.type,
          room: draft.room,
          need: draft.need,
          inBLR: draft.inBLR,
          notes: draft.specialReqs,
          state: "new",
          primaryOwnerId: ownerId,
          secondaryOwnerId: null,
          createdAt: ts,
          updatedAt: ts,
          lastActivityAt: ts,
          rawSource: draft.rawSource,
        };
        set((s) => ({ leads: [lead, ...s.leads] }));
        get().logActivity(lead.ulid, "lead-created", `Lead created by ${ownerName}`);
        return lead;
      },

      logActivity: (ulid, kind, text, meta) => {
        const user = get().currentUser;
        const entry: ActivityEntry = {
          id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          ulid, ts: nowIso(),
          actorId: user.id, actorName: user.name,
          kind, text, meta,
        };
        set((s) => ({
          activities: [entry, ...s.activities],
          leads: s.leads.map((l) => l.ulid === ulid ? { ...l, lastActivityAt: entry.ts, updatedAt: entry.ts } : l),
        }));
      },

      requestAccess: (ulid, message) => {
        const lead = get().leads.find((l) => l.ulid === ulid);
        if (!lead) return null;
        const user = get().currentUser;
        if (lead.primaryOwnerId === user.id) return null;
        // Already pending?
        const existing = get().requests.find(
          (r) => r.ulid === ulid && r.requesterId === user.id && r.state === "pending",
        );
        if (existing) return existing;
        const req: AccessRequest = {
          id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ulid,
          requesterId: user.id,
          requesterName: user.name,
          toOwnerId: lead.primaryOwnerId,
          ts: nowIso(),
          state: "pending",
          message,
        };
        set((s) => ({ requests: [req, ...s.requests] }));
        get().logActivity(ulid, "access-requested", `${user.name} requested access`);
        return req;
      },

      decideRequest: (id, decision) => {
        const req = get().requests.find((r) => r.id === id);
        if (!req) return;
        const ts = nowIso();
        set((s) => ({
          requests: s.requests.map((r) => r.id === id ? { ...r, state: decision, decidedAt: ts } : r),
        }));
        if (decision === "approved") {
          get().setSecondaryOwner(req.ulid, req.requesterId, req.requesterName);
          get().logActivity(req.ulid, "access-granted", `Access granted to ${req.requesterName}`);
        } else {
          get().logActivity(req.ulid, "access-rejected", `Access rejected for ${req.requesterName}`);
        }
      },

      setSecondaryOwner: (ulid, ownerId, ownerName) => {
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid
            ? { ...l, secondaryOwnerId: ownerId, updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(ulid, "secondary-added", `${ownerName} added as secondary owner`);
      },

      reassignPrimary: (ulid, ownerId, ownerName, reason) => {
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid
            ? { ...l, primaryOwnerId: ownerId, updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(ulid, "owner-changed", `Primary owner → ${ownerName} (${reason})`);
      },

      setLifecycleState: (ulid, state) => {
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid ? { ...l, state, updatedAt: nowIso() } : l),
        }));
        get().logActivity(ulid, "state-changed", `State → ${state}`);
      },

      addTag: (ulid, tag) => {
        const t = tag.trim();
        if (!t) return;
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid && !(l.tags ?? []).includes(t)
            ? { ...l, tags: [...(l.tags ?? []), t], updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(ulid, "tag-added", `Tag added: ${t}`, { tag: t });
      },

      removeTag: (ulid, tag) => {
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid
            ? { ...l, tags: (l.tags ?? []).filter((x) => x !== tag), updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(ulid, "tag-removed", `Tag removed: ${tag}`, { tag });
      },

      setPriority: (ulid, priority) => {
        const lead = get().leads.find((l) => l.ulid === ulid);
        const before = lead?.priority ?? "normal";
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid
            ? { ...l, priority, updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(ulid, "priority-changed",
          `Priority: ${before} → ${priority ?? "normal"}`,
          { before, after: priority });
      },

      setEarliestCheckIn: (ulid, date) => {
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid
            ? { ...l, earliestCheckIn: date, updatedAt: nowIso() }
            : l),
        }));
        get().logActivity(ulid, "earliest-checkin-set",
          `Earliest check-in: ${date}`, { date });
      },

      assignLead: (ulid, toMemberId, toMemberName, reason) => {
        const user = get().currentUser;
        const lead = get().leads.find((l) => l.ulid === ulid);
        if (!lead) return;
        const entry: AssignmentEntry = {
          ts: nowIso(),
          fromId: lead.assigneeId ?? null,
          fromName: lead.assigneeName ?? null,
          toId: toMemberId,
          toName: toMemberName,
          byActorId: user.id,
          byActorName: user.name,
          reason,
        };
        set((s) => ({
          leads: s.leads.map((l) => l.ulid === ulid
            ? {
                ...l,
                assigneeId: toMemberId,
                assigneeName: toMemberName,
                assignmentHistory: [entry, ...(l.assignmentHistory ?? [])],
                updatedAt: nowIso(),
              }
            : l),
        }));
        get().logActivity(ulid, "assignee-changed",
          `Assigned to ${toMemberName}${reason ? ` (${reason})` : ""}`,
          { toId: toMemberId, fromId: entry.fromId });
      },

      createCustomTag: (label, color) => {
        const user = get().currentUser;
        const tag: CustomTag = {
          id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: label.trim(),
          color,
          createdBy: user.id,
          ts: nowIso(),
        };
        set((s) => ({ customTags: [tag, ...s.customTags] }));
        return tag;
      },

      deleteCustomTag: (id) => {
        set((s) => ({ customTags: s.customTags.filter((t) => t.id !== id) }));
      },

      getLead: (ulid) => get().leads.find((l) => l.ulid === ulid),
      getActivities: (ulid) => get().activities.filter((a) => a.ulid === ulid),
      getRequestsForOwner: (ownerId) =>
        get().requests.filter((r) => r.toOwnerId === ownerId && r.state === "pending"),
      getRequestsByMe: (userId) => get().requests.filter((r) => r.requesterId === userId),
    }),
    { name: "lead-identity-store-v1" },
  ),
);
