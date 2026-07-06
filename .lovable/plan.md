# Gharpayy 10X: Unified Super Modules + Auto-Everything

Goal: fewer surfaces, fewer clicks, more automation. Every module becomes a
single place. Every routine step becomes automatic with an "undo" instead of
a "confirm".

---

## 1. Super Modules (collapse ~20 routes → 6)

New sidebar, in order:

```text
Today        → merges /today + /execution + /queue + /follow-ups
Leads        → /leads (single cockpit for all lead detail)
Pipeline     → /pipeline (stage board + dossier board + revival)
Command      → merges /monitoring + /manager + /leaderboard + /activity + /health
Calendar     → /calendar + /tours
More         → drawer: Sequences, Zone Brain, Inventory, Coach, Settings, HR, Owner, MYT
```

Existing routes stay as redirects to the new module so links don't break.
File deletions are limited to sidebar entries; underlying components are
reused inside the new module shells.

## 2. Unified Lead Cockpit (one panel, no tabs)

Kill the split between `LeadDeepProfile`, `LeadControlPanel`, `LeadDossierPanel`,
`ClosingEngineCard`, `NextActionCard`, `UnifiedLeadTimeline`. Replace with a
single right-hand sheet:

```text
┌ Header: name · phone · stage badge · SLA pulse · auto-actions toggle ┐
│ Auto Next Action  →  [Send now] [Edit] [Snooze 15m]  (fires itself   │
│                     in N seconds unless user intervenes)             │
│ Dossier (inline, live-parsed from paste, auto-completing)            │
│ Stage rail (11 stages, click to jump, locked ones show why)          │
│ Timeline (WA + audit + system events, single stream)                 │
└──────────────────────────────────────────────────────────────────────┘
```

One component: `src/components/cockpit/LeadCockpit.tsx`. Old panels become
thin re-exports for one release, then removed.

## 3. Auto-Everything Engine

New `src/lib/pipeline/auto-pilot.ts` runs on every store tick:

| Trigger                              | Auto action                                             |
| ------------------------------------ | ------------------------------------------------------- |
| Lead created                         | Auto-assign via `routing.autoAssign` — no click         |
| Paste captured                       | Auto-fill dossier fields (name, phone, area, budget,    |
|                                      | move-in) via `lead-identity/parser`                     |
| Dossier ≥ 80% + WA reply             | Advance NEW → CONTACTED                                 |
| Tour scheduled + reply "yes/confirm" | Advance TOUR_SCHEDULED → TOUR_CONFIRMED                 |
| Tour time passes                     | Advance to TOURED (unless no-show flag)                 |
| SLA breach                           | One grouped manager alert per 5 min, not per lead       |
| Next-action due                      | Countdown → auto-send at T-0, unless user hits Snooze   |
|                                      | or Edit (5s "undo" toast after send)                    |

Toggle per lead + global "Auto-pilot" switch in header. All auto actions are
logged to `activity-store` with `actor: "auto-pilot"` so managers see them.

## 4. Unified Command Bar (⌘K)

Replace `CommandPalette` + quick-add + `LeadActionsMenu` with one bar. Typing:

```text
> paste lead …            → creates lead + auto-fills dossier + auto-assigns
> send wa to <name> …     → picks template, queues send
> advance <name> to tour  → runs stage gate
> assign <name> to <tcm>  → reroutes
> snooze <name> 2h        → pauses next action
> escalate <name>         → flags for manager
```

Everything routes through the same execution engine. No modals.

## 5. Unified Command Center (`/command`)

Tabs inside one page (replacing 5 routes):

```text
[ Live ] [ Team ] [ Pipeline ] [ Leaderboard ] [ Activity ] [ Health ]
```

`Live` = new default: KPI strip + real-time action feed + open SLA breaches
grouped by cause. Manager can bulk-acknowledge or bulk-reassign from here.

## 6. Files

Create:
- `src/lib/pipeline/auto-pilot.ts`
- `src/hooks/useAutoPilot.ts` (subscribes to ticker, executes rules)
- `src/components/cockpit/LeadCockpit.tsx`
- `src/components/cockpit/AutoActionCountdown.tsx`
- `src/components/cockpit/DossierInline.tsx`
- `src/components/cockpit/StageRail.tsx`
- `src/components/cockpit/UnifiedTimeline.tsx`
- `src/components/command/UnifiedCommandBar.tsx`
- `src/routes/today.tsx` (rewrite as Super Module)
- `src/routes/command.tsx` (new merged Command Center)
- `src/routes/pipeline.tsx` (new merged Pipeline board)

Edit:
- `src/components/AppShell.tsx` — collapse sidebar to 6 items + More drawer
- `src/lib/lead-identity/store.ts` — call auto-pilot hooks on create/update
- `src/lib/pipeline/store.ts` — expose events for auto-pilot
- `src/routes/execution.tsx`, `queue.tsx`, `follow-ups.tsx`,
  `monitoring.tsx`, `manager.tsx`, `leaderboard.tsx`, `activity.tsx`,
  `health.tsx` — thin redirects to their new super module
- `src/components/crm10x/LeadDossierPanel.tsx` — render `LeadCockpit`

## 7. Out of scope (this pass)

- WhatsApp Business API integration (still simulated sends)
- Lovable Cloud persistence (still local zustand)
- MYT / Owner / Supply-Hub internal reshuffling (only sidebar entry point changes)

## 8. Ship order

1. Auto-pilot engine + toggle (invisible wins immediately)
2. Lead Cockpit (unifies detail view)
3. Unified Command Bar
4. Super Modules + sidebar collapse + route redirects
5. Command Center merge

Approve and I'll implement top-to-bottom.
