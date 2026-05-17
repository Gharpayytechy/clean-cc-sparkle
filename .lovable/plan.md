# 100X Date-Anchored Lead Execution Engine

Turn the CRM from a database into a **decision engine**. Every lead is always in exactly one Phase (1–4), on a known Day offset from an Anchor (L / T / CI), with exactly one Next Action that is either scheduled, due, or breached. TCMs execute. Managers review gaps. The system never lets a lead exist without a Next Action.

This plan ships the full spec in coordinated layers — schema, engine, scripts, UI, manager dashboard, escalations — wired into the existing `lead-identity` store, `crm10x` store, and audit log.

---

## Layer 1 — Anchors & Phase Schema

**`src/lib/lead-identity/types.ts`** — extend `UnifiedLead`:
- `anchors: { leadDate: string; tourDate?: string; checkInDate?: string }`
- `phase: 1 | 2 | 3 | 4`
- `stage: "NEW" | "CONTACTED" | "TOUR_SCHEDULED" | "TOURED" | "NEGOTIATING" | "CLOSED" | "COLD" | "LOST"`
- `interestLevel: "HOT" | "WARM" | "COLD" | null` (post-tour)
- `primaryObjection: ObjectionTag | null` — enum below, free text rejected
- `nextAction: { id; kind; dueAt; templateId; payload } | null`
- `noShowCount`, `followUpCount`, `lastContactAt`, `managerEscalated`
- `closedReason?`, `lostReason?`

New enum `ObjectionTag`: `PRICE-HIGH | LOCATION-MISMATCH | COMPARING | FAMILY-APPROVAL | TIMING | AMENITY-GAP | UNRESPONSIVE | SWITCHED-PLATFORM | PLANS-CHANGED | UNKNOWN`.

---

## Layer 2 — Script Library

**New `src/lib/crm10x/scripts.ts`** — encodes every message from the spec as templates with variables (`{{name}}`, `{{area}}`, `{{property}}`, `{{time}}`, `{{address}}`):

```
type ScriptTemplate = {
  id: string;             // "L0-1A-standard-opener"
  phase: 1|2|3|4;
  dayOffset: number;      // L+0, T-2, CI-7 → 0, -2, -7
  anchor: "L"|"T"|"CI";
  window?: { fromHour: number; toHour: number };  // 9.5–10.5 for "9:30-10:30 AM"
  condition?: "no-reply"|"replied"|"hot"|"warm"|"cold"|"price"|"location"|"family"|"size";
  body: string;
  followUpKind: "message"|"call"|"visit-confirm"|"close-attempt"|"escalation";
};
```

Seed every script verbatim from the brief: L+0 1A/1B/1C, L+0 shortlist, L+0 no-reply, L+0 EOD, L+1 morning (replied / never), L+1 afternoon + 4 objection rebuttals, L+1 evening, L+2 morning/afternoon, L+3+ cold, T-confirm, T-2, T-1, T-0 morning, T-0 no-show 30m/3h, T+0 went-well/unsure/comparing, T+0 EOD, T+1 HOT/WARM/COLD, T+1 objection × 4, T+2 morning/evening, T+3 final, CI-30/21/14/10/7/5/3/1.

---

## Layer 3 — The Decision Engine

**New `src/lib/crm10x/execution-engine.ts`** — pure functions, no React:

```
computeNextAction(lead, now): NextAction | null
  → returns { kind, dueAt, templateId, reason }
  → uses phase + days-since-anchor + lastContactAt + replied flag
advancePhase(lead, event): partial<UnifiedLead>
  → events: "first-contact"|"replied"|"tour-booked"|"tour-rescheduled"
            |"no-show"|"toured"|"closed"|"lost"|"cold-out"
materializeAction(lead, template, now): ActionTicket
breachState(lead, now): "ok"|"due"|"breached"|"escalated"
```

Rules baked in:
- 15-min law: NEW lead with no contact → breached at `leadDate + 15m` → manager alert.
- L+2 no tour → manager review flag.
- T-0 no-show + 1h no follow-up → TCM warning.
- TOURED >3d with no close or escalation → manager takeover.
- CI-7 with no activity in 10d → manager review.
- LOST without `primaryObjection` → engine rejects the mutation (store action throws).
- Reschedule resets Phase 2 clock from new `T-2`.

Recompute on every store mutation + via `useNow()` tick (already in `src/hooks/use-now.ts`) every 60s.

---

## Layer 4 — Store Wiring

**`src/lib/lead-identity/store.ts`** — new actions, all audit-logged:
- `setAnchors`, `bookTour`, `rescheduleTour`, `markNoShow`, `markToured`, `setInterestLevel`, `setObjection`, `markClosed`, `markLost(reason, tag)`, `recordContact(channel)`
- After every mutation: call `computeNextAction()` and persist on the lead.
- `markLost` throws if no objection tag → satisfies escalation matrix.

**`src/lib/crm10x/store.ts`** — add `actionTickets: ActionTicket[]` slice (queue of due/upcoming actions per TCM), `completeTicket`, `snoozeTicket(reason)`.

---

## Layer 5 — TCM Execution UI

**New `src/components/execution/NextActionCard.tsx`** — the atomic unit. Shows:
- Phase badge + Day label (`L+1 · Afternoon` or `T-2`)
- Lead name + anchor countdowns (`Tour in 2d` / `Check-in in 14d`)
- The exact script body with variables filled
- Buttons: **Send WhatsApp** (deep-link), **Mark Sent**, **Log Reply**, **Snooze**, **Escalate**
- Objection chip row (one-tap tag)
- Inline "Book Tour" / "Reschedule" / "Mark No-show" depending on phase

**New `src/routes/execution.tsx`** — TCM's home queue (`/execution`):
- Tabs: **Due Now** · **Today** · **Tomorrow** · **Breached** · **Cold drip**
- Sorted by breach state then `dueAt`
- Header: "X actions due, Y breached" with the 15-min law countdown for any fresh NEW lead
- Bulk send for templates that don't need personalization beyond `{{name}}`

**Mount `NextActionCard`** inline on:
- `MYTLeadTracker` rows (replaces ad-hoc CTAs)
- `LeadDossierPanel` top strip
- The PiP window root (PiP becomes a focused "Next Action" stream)

---

## Layer 6 — Manager 8:30 AM Dashboard

**New `src/components/execution/ManagerMorningReview.tsx`** mounted on `/myt/war-room` as a new top tab **Morning Review**:

Six checklists exactly per spec:
1. NEW leads from yesterday — first contact within 15min? Misses flagged red.
2. TOUR_SCHEDULED — T-1 reminder sent? No-shows followed up?
3. TOURED — post-visit message within 2h? Stuck at T+3?
4. CI-7 — active in last 48h?
5. LOST without objection tag — reject button returns to TCM.
6. Weekly: 10% sample of COLD leads from past 7d — opens follow-up quality reviewer.

Each row: lead link · TCM · gap reason · one-click action (Reassign / Nudge TCM / Take Over).

---

## Layer 7 — Escalation & Alerts

**New `src/lib/execution/escalation.ts`**:
- Rule registry mapping the Escalation Matrix to triggers.
- Emits notifications via existing `src/lib/notifications.ts` to TCM + Manager.
- Writes audit entries (`escalation-triggered`) so `WhatChangedStrip` shows them.
- Auto-creates a Manager-owned task when "Manager takes over" fires.

---

## Layer 8 — Lead Card Structure Pass

Refactor `LeadDossierPanel` / lead drawer to render the three blocks from the spec:
- **Identity Block** · **Requirement Block** · **Activity Block** · **Stage Block** (phase / stage / `days since L` / `days to CI` / escalation flag).

Days counters auto-tick via `useNow()`.

---

## Files

**Create**
- `src/lib/crm10x/scripts.ts`
- `src/lib/crm10x/execution-engine.ts`
- `src/lib/execution/escalation.ts`
- `src/components/execution/NextActionCard.tsx`
- `src/components/execution/ManagerMorningReview.tsx`
- `src/components/execution/PhaseDayBadge.tsx`
- `src/components/execution/ObjectionChipRow.tsx`
- `src/routes/execution.tsx`

**Modify**
- `src/lib/lead-identity/types.ts` (anchors, phase/stage, nextAction, objection)
- `src/lib/lead-identity/store.ts` (mutations + auto-recompute + LOST guard)
- `src/lib/crm10x/store.ts` (actionTickets slice)
- `src/lib/crm10x/types.ts` (ActionTicket, ScriptTemplate)
- `src/components/leads/QuickAddLeadPanel.tsx` + `DirectLeadForm.tsx` (capture anchors, set Phase 1 / `L+0` automatically)
- `src/components/crm10x/LeadDossierPanel.tsx` (4-block layout + NextActionCard)
- `src/myt/pages/MYTLeadTracker.tsx` (phase columns, breach badges, sort by `dueAt`)
- `src/myt/pages/WarRoom.tsx` (Morning Review tab)
- `src/components/AppShell.tsx` (pin `/execution` for TCM role)
- `src/components/pip/PipProvider.tsx` (default PiP route → `/execution`)

## Out of scope (called out)
- No backend / cron — schedule is recomputed client-side on store change + 60s tick. Move to Cloud later if needed.
- WhatsApp Business API not wired; "Send WhatsApp" uses `wa.me/` deep-links pre-filled with the rendered script.
- No SMS/email channels in this pass — message-only spec.
- Existing legacy follow-up UI stays mounted but its data source switches to the engine's `actionTickets`.

After approval I execute all 8 layers in order; Layers 1–3 are the foundation everything else binds to.

