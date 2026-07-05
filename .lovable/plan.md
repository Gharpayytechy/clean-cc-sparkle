# Gharpayy Closing Engine (0 → 1)

Transform the CRM from list-of-leads into a **stage-gated execution pipeline** where every lead moves through 11 enforced checkpoints with timers, mandatory data capture, and manager visibility.

---

## 1. Pipeline Schema (single source of truth)

Extend `UnifiedLead` in `src/lib/lead-identity/types.ts`:

```ts
type PipelineStage =
  | 'NEW'              // 0-15s
  | 'DOSSIER'          // 60s timer
  | 'MATCHED'          // P1/P2/P3 pinned
  | 'TOUR_SCHEDULED'
  | 'TOUR_CONFIRMED'
  | 'TOUR_IN_PROGRESS'
  | 'POST_VISIT'
  | 'QUOTED'           // 15-min SLA after tour
  | 'NEGOTIATION'
  | 'BOOKED'
  | 'CHECKED_IN'
  | 'LOST'

interface StageGate {
  enteredAt: string
  slaDeadline?: string      // when this stage breaches
  breached: boolean
  requiredFields: string[]  // must be filled to exit
  completedFields: string[]
}

interface Dossier {
  feasibility: {...}       // move date, budget, area, gender, occupation, food, sharing, duration
  locationFeasibility: {...} // office, college, travelTime, preferred, alt
  movingFeasibility: 'immediate'|'7d'|'15d'|'30d'|'researching'
  decisionMaker: 'self'|'parents'|'friends'|'company'
  competition: 'visiting'|'booked'|'comparing'|'none'
  objection: ObjectionTag
  propertiesSent: { p1?, p2?, p3?, p4?, pdfSent, videoSent, locationSent }
  completionPct: number   // 0-100, stage cannot advance below 100
}
```

## 2. The Stage Gate Engine

New file `src/lib/pipeline/stage-engine.ts`:
- `canAdvance(lead, toStage)` — enforces entry/exit criteria per stage
- `advanceStage(leadId, toStage)` — throws if gate fails, logs to audit
- `computeSlaState(lead)` — returns `ok|warning|breached|escalated` per active stage
- Stage rules table (SLAs):
  - `NEW → DOSSIER`: 60 seconds
  - `TOUR_SCHEDULED → TOUR_CONFIRMED`: 24h/6h/2h/30m reminder cascade
  - `POST_VISIT → QUOTED`: **15 minutes mandatory** (breach = red)
  - `QUOTED → NEGOTIATION/BOOKED`: 2h → 24h → 48h → 72h → 7d follow-up ladder
  - No booking after 7d → Revival at 30/60/90d

## 3. The 60-Second Dossier Timer (Stage 2)

New component `src/components/pipeline/DossierTimer.tsx`:
- Fires immediately on lead creation
- Red pulsing banner with countdown `60 → 0`
- Progress bar showing dossier completion % (e.g. 72%, 3 fields remaining)
- On expiry: SLA badge turns red, manager notified via `escalation.ts`, lead moves to bottom of TCM's queue
- Cannot dismiss until all mandatory fields filled OR manager overrides with reason

New `src/components/pipeline/DossierForm.tsx`: single tight form covering all Stage 2 mandatory fields, grouped into 6 sections, live completion %.

## 4. Stage-Gated Lead Dossier Panel

Refactor lead detail to show **the 11-stage stepper** (replaces current 5-block layout):
- Each stage = clickable pill showing state (`done | active | locked | breached`)
- Active stage exposes its action panel (dossier form / tour scheduler / quote builder / etc.)
- Locked stages show entry criteria not yet met
- Breach stages pulse red with time-since-breach

Files:
- `src/components/pipeline/StageStepper.tsx`
- `src/components/pipeline/StagePanel.tsx` (routes to per-stage sub-panel)
- Per-stage panels: `Dossier`, `PropertyMatch`, `TourSchedule`, `TourConfirm`, `VisitExecution`, `PostVisit`, `Quotation`, `Negotiation`, `Booking`, `CheckIn`

## 5. Automation Rules (Rule 1–8 in spec)

`src/lib/pipeline/automation-rules.ts` — pure functions run on every store mutation:
- R1: Lead created → start 60s timer
- R2: Timer expired → red alert + manager notify
- R3: No tour in 24h → move to Action Queue
- R4: Tour today → auto-fire confirmation cascade (6h/2h/30m)
- R5: Tour completed → mandatory quote within 15min or SLA breach
- R6: Quote sent → schedule 2h/24h/48h/72h/7d follow-ups
- R7: No booking after ladder → Negotiation queue
- R8: Lead cold → Revival 30/60/90d

Ticks run via `useAutomationTicker` hook (every 30s, cheap client-side pass).

## 6. Activity Monitoring & Manager Sheet

New store `src/lib/monitoring/activity-store.ts` — logs every action (button click, stage change, message sent) with `{time, userId, leadId, action, stageFrom, stageTo, feature}`.

New route `/monitoring` (Owner/Manager only) with 6 tabs mirroring the sheet spec:
1. **Raw Activity Log** — live scrolling table
2. **30-Min Dashboard** — per-person: leads added, clicks, scheduled, quotes, inactive flag, stuck lead count
3. **Lead Stage Matrix** — per-person × per-stage counts
4. **Low Activity Alerts** — anyone idle >30min or stuck at a stage
5. **Feature Usage Analytics** — most-clicked buttons, unique users
6. **End-of-Day Scoreboard** — vs targets (20 scheduled, 3 quotes per person)

Auto-refresh every 30s. Export-to-CSV button for the manager report.

## 7. Live KPI Strip (visible to every TCM)

Replace top strip in Flow-Ops / Today with the spec's 20 KPIs, color-coded vs target:
Leads Added · Dossiers % · Avg Dossier Time · Timer Violations · Match Accuracy · Tours Scheduled · Show Rate · No-Show Rate · Rescheduled · Tours Completed · Quotes Sent · Quote SLA % · Negotiations · Booking Conv · Revenue · Avg Closing Time · Active Follow-ups · Stuck · Escalated · Daily Target Progress

## 8. Deliverables (files)

**Create (~15):**
- `src/lib/pipeline/stage-engine.ts`
- `src/lib/pipeline/automation-rules.ts`
- `src/lib/pipeline/stage-config.ts` (SLAs, required fields)
- `src/lib/monitoring/activity-store.ts`
- `src/hooks/useAutomationTicker.ts`
- `src/components/pipeline/DossierTimer.tsx`
- `src/components/pipeline/DossierForm.tsx`
- `src/components/pipeline/StageStepper.tsx`
- `src/components/pipeline/StagePanel.tsx`
- `src/components/pipeline/panels/*.tsx` (10 per-stage panels — thin wrappers around existing UI where possible)
- `src/components/monitoring/ActivityLogTable.tsx`
- `src/components/monitoring/TeamDashboard.tsx`
- `src/components/monitoring/StageMatrix.tsx`
- `src/components/monitoring/KpiStrip.tsx`
- `src/routes/monitoring.tsx`

**Edit (~6):**
- `src/lib/lead-identity/types.ts` — add PipelineStage, StageGate, Dossier
- `src/lib/lead-identity/store.ts` — add `advanceStage`, `updateDossier`, `logActivity`
- `src/lib/crm10x/execution-engine.ts` — hook new SLA rules
- `src/components/leads/LeadDossierPanel.tsx` — swap to StageStepper
- `src/components/AppShell.tsx` — add /monitoring nav for Owner
- Add lead flow — trigger 60s timer on create

## Scope note

This is a large build (~20 files). I'll ship it as one atomic set so the pipeline is consistent end-to-end. Existing screens (Flow-Ops board, Impact Queue, Execution Queue) stay as they are — they'll read from the new stage field automatically since stage transitions flow through the existing store.

Ready to build?
