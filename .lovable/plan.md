# One-Shot Build Plan: Sidebar Slim + Persona Today + Consolidations + Lead Power Features

This plan ships **all 8 architecture items + 4 lead-data features** in a single coordinated pass. I've grouped the work into 5 phases that share infrastructure (types, stores, components) so we don't redo work.

---

## Phase 1 — Lead Schema & Store Power-Ups (foundation for everything else)

**Goal:** Extend `UnifiedLead` so the rest of the UI has data to render.

### 1.1 Extend `src/lib/lead-identity/types.ts`
Add to `UnifiedLead`:
- `tags: string[]` — free-form WhatsApp-label-style tags (color-coded)
- `priority: "super-hot" | "hot" | "normal" | null` — "super-hot" = ASAP same-day-close
- `earliestCheckIn?: string` — ISO date, separate from `moveInDate` (preferred). Earliest = "I can move in by X if needed"
- `assignmentHistory: { ts, fromId, toId, byActorId, reason }[]`
- New activity kinds: `tag-added`, `tag-removed`, `priority-changed`, `assignee-changed`, `earliest-checkin-set`

Add new top-level type:
```ts
export interface CustomTag { id: string; label: string; color: string; createdBy: string; ts: string; }
```

### 1.2 Extend `src/lib/lead-identity/store.ts`
New actions (all log to activity feed):
- `addTag(ulid, tag)` / `removeTag(ulid, tag)`
- `setPriority(ulid, priority)`
- `setEarliestCheckIn(ulid, date)`
- `assignLead(ulid, toMemberId, toMemberName, reason?)` — pushes `assignmentHistory` and updates `assigneeId/Name`
- `customTags: CustomTag[]` slice + `createCustomTag(label, color)` / `deleteCustomTag(id)`

### 1.3 Update `QuickAddLeadPanel` & `DirectLeadForm`
Add fields: tag picker (with "create new"), priority chip row (🚨 Super Hot / 🔥 Hot / Normal), earliest check-in date input, assignee dropdown (reads from team/personas).

---

## Phase 2 — Universal Audit Log + "What Changed" Strip

**Goal:** Every mutation across the app emits an entry; a strip on every detail view shows the last 5.

### 2.1 New `src/lib/audit-log.ts`
Zustand store, persisted, with:
```ts
type AuditEntry = { id; ts; actorId; actorName; entityType: "lead"|"tour"|"property"|"booking"|...; entityId; action; before?; after?; summary };
logAudit(entry)  // append
getRecentFor(entityType, entityId, limit)
getRecentForActor(actorId, limit)
```

### 2.2 New `src/components/audit/WhatChangedStrip.tsx`
Collapsed: "3 changes today · last by Aarav 12m ago"  
Expanded: timeline list with diff badges (e.g. "priority: hot → super-hot").

Mount on: lead drawer, tour detail, property detail, owner home.

### 2.3 Wire emit calls
Patch existing `lead-identity/store.ts`, `crm10x/store.ts`, `myt/lib/app-context.tsx` mutations to also call `logAudit()`.

---

## Phase 3 — Unified Lead Timeline (single component, 7 stores)

**Goal:** Replace the scattered per-store activity displays with one component.

### 3.1 New `src/components/leads/UnifiedLeadTimeline.tsx`
Reads from:
1. `useLeadIdentity` activity feed
2. `useCRM10x.calls` (call attempts)
3. `useCRM10x.objections`
4. `useCRM10x.commitments`
5. `useCRM10x.messageOutcomes` (WhatsApp sends + replies + booking attribution)
6. `useCRM10x.visits`
7. `useAuditLog` entries
8. (bonus) `useApp.tours` + `bookings` for the lead's tours

Merges, sorts desc by `ts`, renders icon + actor + summary + relative time. Filter chips: All / Calls / WhatsApp / Visits / Status / Tags. Used in lead drawer (replaces existing partial timeline) + new "Lead 360" tab.

---

## Phase 4 — Sidebar Slim, Persona Today, Dashboard Consolidation

### 4.1 Slim sidebars to ≤8 + Pinned + More
Refactor `src/components/AppShell.tsx`:

New per-role pinned (≤8):
- **HR:** Coach · Today · War Room (merged) · Funnel · Team · Supply Hub · Revenue · Inbox
- **Flow-Ops:** Coach · Today · Inbox · Flow Ops · MYT Leads · Schedule · Supply Hub · Marketplace
- **TCM:** Coach · Today · TCM Desk · My Tours · Follow-ups · Handoffs · MYT Leads · Marketplace
- **Owner:** Home · Approve (consolidated) · Insights · Inbox

Add `pinnedByRole` (persisted in zustand) so users can pin/unpin from the **More** drawer. "More" opens a sheet listing all remaining routes grouped by section, with a search input.

### 4.2 Persona-driven Today (`src/routes/today.tsx`)
New `src/components/today/PersonaTodayCards.tsx` reads `personas.ts` for the active user (`role` + `currentTcmId` etc). Cards generated from:
- `arc` → "Storyline today" card with progress
- `weakSpots[0]` → "Coach watch" card (gentle nudge using `coachTone`)
- `signature` → personalised greeting at top
- `missionCap` → progress ring "X / cap items cleared today"
- `motivators[]` → reward copy when goals hit
- `channels[0]` → default action button (e.g. WhatsApp vs Phone)

Falls back gracefully when no persona matches.

### 4.3 HR War Room consolidation
Merge `/manager`, `/myt`, `/myt/war-room` into one route at `/myt/war-room` with tabs:
- **Pulse** (today numbers — from current ManagerDashboard "today's pulse")
- **Funnel** (from ManagerDashboard funnel + WarRoom leak point)
- **Forecast** (WarRoom 7-day curve + revenue gap)
- **Team** (ManagerDashboard agent comparison)
- **Red flags** (objections + reassignments)

Old routes redirect to the appropriate tab via `Navigate` with `?tab=` param. `/myt` stays as a lighter HR Tower for ops.

### 4.4 Owner simplification
Collapse 7 owner routes → 3:
- `/owner` **Home** — KPIs, urgent items, persona-tailored hero (using owner personas in `personas.ts`)
- `/owner/approve` **Approve** — merges `blocks` + `visits` + `rooms` updates as one inbox-style queue
- `/owner/insights` **Insights** — yields/occupancy + media health (absorbs `inventory` + `media`)

Old routes redirect.

---

## Phase 5 — TCM Call/Voice Logger + Flow-Ops Auto-Balance + Dup Merge Inbox

### 5.1 TCM call+voice logger
New `src/components/tcm/CallVoiceLogger.tsx`:
- One-click "Call" button on lead row → opens `tel:` link AND immediately creates a `CallRecord` via `useCRM10x.logCall` (status=initiated, ts=now)
- After call: prompt with mic button → uses **Web Speech API** (`SpeechRecognition`) to transcribe in-browser (no external dep)
- Transcript stored on the call record (`note` field — extend `CallRecord` if needed)
- Outcome chips: Connected / Voicemail / Busy / No-answer + objection chip-row (auto-creates `ObjectionRecord`)
- Hooks into `WhatChangedStrip` + `UnifiedLeadTimeline`

Browser-support fallback: text area if `webkitSpeechRecognition` missing.

### 5.2 Flow-Ops auto-balance panel
New `src/components/flow-ops/AutoBalancePanel.tsx` on `/myt/flow-ops`:
- Reads `useCRM10x.assignments` + `useApp.leads` + TCM list
- Computes load per TCM (active leads ÷ avg cap)
- Suggests rebalance moves (drag overloaded → underloaded), one-click "Apply" → calls new `assignLead` action
- "Auto-distribute N unclaimed" button using existing `routing.ts` if present, else round-robin

### 5.3 Duplicate merge inbox
New `src/components/flow-ops/DuplicateMergeInbox.tsx`:
- Surfaces existing `useCRM10x.merges` + runs `findMatches` from lead-identity over current leads to find candidates not yet merged
- Shows pairs side-by-side with score + reasons → "Merge" button calls existing `mergeDuplicates` action and consolidates activity
- Mounted as a tab on `/myt/flow-ops`

---

## Phase 6 — Cross-cutting polish

- **Tag chips** rendered on lead cards everywhere (use color from `CustomTag.color`)
- **Super-hot leads** get a pulsing 🚨 badge + sort to top of every queue + auto-create a follow-up due in 2h
- **Earliest check-in** shown in lead drawer + factored into ManagerDashboard "same-day-closing potential" KPI card
- **Assignment dropdown** added to lead row context menu (`LeadActionsMenu`) — calls new `assignLead`

---

## Files to be created
- `src/lib/audit-log.ts`
- `src/components/audit/WhatChangedStrip.tsx`
- `src/components/leads/UnifiedLeadTimeline.tsx`
- `src/components/leads/TagPicker.tsx`
- `src/components/leads/PriorityChip.tsx`
- `src/components/leads/AssigneeSelect.tsx`
- `src/components/today/PersonaTodayCards.tsx`
- `src/components/tcm/CallVoiceLogger.tsx`
- `src/components/flow-ops/AutoBalancePanel.tsx`
- `src/components/flow-ops/DuplicateMergeInbox.tsx`
- `src/components/SidebarMore.tsx`
- `src/routes/owner/approve.tsx`

## Files to be modified
- `src/lib/lead-identity/types.ts` (schema)
- `src/lib/lead-identity/store.ts` (new actions + audit emit)
- `src/lib/crm10x/store.ts` (audit emit + extend `CallRecord` with transcript)
- `src/components/AppShell.tsx` (slim sidebar, pinned/more)
- `src/components/leads/QuickAddLeadPanel.tsx` (tags/priority/assignee/earliest)
- `src/components/leads/DirectLeadForm.tsx` (same)
- `src/components/LeadActionsMenu.tsx` (assign + tag actions)
- `src/myt/pages/MYTLeadTracker.tsx` (super-hot sort, tags, timeline tab)
- `src/myt/pages/WarRoom.tsx` (tabbed merge with ManagerDashboard)
- `src/myt/pages/FlowOpsDashboard.tsx` (mount auto-balance + dup-merge)
- `src/routes/today.tsx` (mount PersonaTodayCards)
- `src/routes/manager.tsx` + `src/routes/myt/index.tsx` (redirect to war-room)
- `src/owner/pages/OwnerHome.tsx` (persona-tailored)
- `src/routes/owner/blocks.tsx` + `visits.tsx` + `rooms.tsx` (redirect to /owner/approve)

## Out of scope (call out explicitly)
- No backend wiring — all data continues to live in zustand persisted stores. Voice transcripts use the in-browser Web Speech API (no ElevenLabs cost).
- No mobile redesign of the sidebar — slim layout still uses the existing mobile sheet.
- I will **not** delete the legacy route files; they redirect, so deep links keep working.

After approval I'll execute all phases in order. Phases 1–3 land first because 4–6 depend on them.
