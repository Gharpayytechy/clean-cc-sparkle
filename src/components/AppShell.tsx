import { Link, useRouterState } from "@tanstack/react-router";
import {
  Target, ClipboardList, Activity, Building2, Search, Sun, Command, Sparkles,
  Users, Home, Calendar, Settings, ShieldCheck, Inbox, HelpCircle, Layers,
  HeartPulse, Zap, MoreHorizontal, MessageSquare, Store, MapPin, Trophy,
  IndianRupee, Camera,
} from "lucide-react";

import { NotificationCenter } from "./NotificationCenter";
import { ProfileMenu } from "./ProfileMenu";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReactNode } from "react";
import { LeadControlPanel } from "./LeadControlPanel";
import { CommandPalette } from "./CommandPalette";
import { CoachWidget } from "./CoachWidget";
import { useNow, useMountedNow } from "@/hooks/use-now";
import { buildDoNextQueue } from "@/lib/engine";
import { useGame, whoKey } from "@/lib/gamification";
import { useCRM10x } from "@/lib/crm10x/store";
import { useEffect, useMemo } from "react";
import { PictureInPictureProvider, PipMount, usePip } from "./pip/PipProvider";
import { PipButton } from "./pip/PipButton";
import { usePipRouteSync } from "./pip/usePipSync";
import { AutoPilotBadge } from "./AutoPilotBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function PipRouteSyncBridge() {
  const { active } = usePip();
  usePipRouteSync(active);
  return null;
}

type NavItem = { to: string; label: string; icon: typeof Target; badge?: number; accent?: boolean };

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, currentTcmId, setCurrentTcmId, tcms, leads, tours, followUps, handoffs, bookings } = useApp();
  const router = useRouterState();
  const path = router.location.pathname;
  const [now, mounted] = useMountedNow();

  const filterTcm = role === "tcm" ? currentTcmId : undefined;
  const queue = useMemo(
    () => (mounted ? buildDoNextQueue(leads, tours, followUps, now, filterTcm) : []),
    [leads, tours, followUps, now, filterTcm, mounted],
  );
  const overdueCount = mounted ? followUps.filter((f) => !f.done && +new Date(f.dueAt) <= now).length : 0;
  const incompletePostTour = tours.filter((t) => t.status === "completed" && !t.postTour.filledAt).length;
  const unreadHandoffs = handoffs.filter((h) => !h.read && h.to === role).length;

  const awardXp = useGame((s) => s.awardXp);
  const registerBooking = useGame((s) => s.registerBooking);
  const rolloverIfNeeded = useGame((s) => s.rolloverIfNeeded);
  useEffect(() => {
    if (!mounted) return;
    bookings.forEach((b) => {
      const who = whoKey("tcm", b.tcmId);
      awardXp(who, 100, `booking:${b.id}`);
      registerBooking(who, b.id);
    });
  }, [bookings, mounted, awardXp, registerBooking]);

  useEffect(() => {
    if (!mounted) return;
    rolloverIfNeeded(whoKey(role, currentTcmId));
  }, [mounted, role, currentTcmId, rolloverIfNeeded]);

  const markMessageBookedAfter = useCRM10x((s) => s.markMessageBookedAfter);
  useEffect(() => {
    if (!mounted) return;
    bookings.forEach((b) => markMessageBookedAfter(b.leadId, b.id, b.ts));
  }, [bookings, mounted, markMessageBookedAfter]);

  // ── 6 Super Modules per role ───────────────────────────────────────
  const primary: Record<typeof role, NavItem[]> = {
    hr: [
      { to: "/today", label: "Today", icon: Sun, badge: queue.length, accent: true },
      { to: "/leads", label: "Leads", icon: Target },
      { to: "/pipeline", label: "Pipeline", icon: Layers },
      { to: "/command", label: "Command", icon: Zap, accent: true },
      { to: "/calendar", label: "Calendar", icon: Calendar },
    ],
    "flow-ops": [
      { to: "/today", label: "Today", icon: Sun, badge: queue.length, accent: true },
      { to: "/leads", label: "Leads", icon: Target },
      { to: "/pipeline", label: "Pipeline", icon: Layers },
      { to: "/command", label: "Command", icon: Zap, accent: true },
      { to: "/calendar", label: "Calendar", icon: Calendar },
    ],
    tcm: [
      { to: "/today", label: "Today", icon: Sun, badge: queue.length, accent: true },
      { to: "/leads", label: "Leads", icon: Target },
      { to: "/tours", label: "Tours", icon: Calendar, badge: incompletePostTour },
      { to: "/follow-ups", label: "Follow-ups", icon: ClipboardList, badge: overdueCount },
      { to: "/handoffs", label: "Handoffs", icon: MessageSquare, badge: unreadHandoffs },
    ],
    owner: [
      { to: "/owner", label: "Owner Home", icon: ShieldCheck },
      { to: "/owner/inventory", label: "Inventory", icon: Layers },
      { to: "/owner/rooms", label: "Rooms", icon: Building2 },
      { to: "/owner/visits", label: "Visits", icon: Camera },
      { to: "/owner/insights", label: "Insights", icon: IndianRupee },
    ],
  };

  const more: Record<typeof role, NavItem[]> = {
    hr: [
      { to: "/coach", label: "Coach", icon: Sparkles },
      { to: "/sequences", label: "Sequences", icon: Zap },
      { to: "/revival", label: "Revival", icon: Sparkles },
      { to: "/zone-brain", label: "Zone Brain", icon: MapPin },
      { to: "/supply-hub", label: "Supply Hub", icon: Layers },
      { to: "/myt", label: "MYT Tower", icon: Home },
      { to: "/myt/team", label: "Team", icon: Users },
      { to: "/myt/zones", label: "Zones", icon: MapPin },
      { to: "/myt/leaderboard", label: "Leaderboard", icon: Trophy },
      { to: "/revenue", label: "Revenue", icon: IndianRupee },
      { to: "/inbox", label: "Inbox", icon: Inbox },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/health", label: "System Health", icon: HeartPulse },
      { to: "/help", label: "How to use", icon: HelpCircle },
    ],
    "flow-ops": [
      { to: "/coach", label: "Coach", icon: Sparkles },
      { to: "/sequences", label: "Sequences", icon: Zap },
      { to: "/revival", label: "Revival", icon: Sparkles },
      { to: "/zone-brain", label: "Zone Brain", icon: MapPin },
      { to: "/supply-hub", label: "Supply Hub", icon: Layers },
      { to: "/myt/marketplace", label: "Marketplace", icon: Store },
      { to: "/myt/properties", label: "Properties", icon: Building2 },
      { to: "/myt/schedule", label: "Schedule", icon: Calendar },
      { to: "/inbox", label: "Inbox", icon: Inbox },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/health", label: "System Health", icon: HeartPulse },
      { to: "/help", label: "How to use", icon: HelpCircle },
    ],
    tcm: [
      { to: "/coach", label: "Coach", icon: Sparkles },
      { to: "/myt/tcm", label: "TCM Desk", icon: Target },
      { to: "/myt/schedule", label: "Schedule Tour", icon: Calendar },
      { to: "/supply-hub", label: "Supply Hub", icon: Layers },
      { to: "/myt/marketplace", label: "Marketplace", icon: Store },
      { to: "/myt/score", label: "Score", icon: Trophy },
      { to: "/inbox", label: "Inbox", icon: Inbox },
      { to: "/help", label: "How to use", icon: HelpCircle },
    ],
    owner: [
      { to: "/owner/blocks", label: "Block Requests", icon: Inbox },
      { to: "/coach", label: "Coach", icon: Sparkles },
      { to: "/inbox", label: "Inbox", icon: Inbox },
      { to: "/help", label: "How to use", icon: HelpCircle },
    ],
  };

  const items: NavItem[] = [
    ...primary[role],
    { to: "__more__", label: "More", icon: MoreHorizontal },
  ];
  const moreItems = more[role];

  const isActive = (to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"));


  return (
    <PictureInPictureProvider>
      <PipRouteSyncBridge />
      <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[240px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
            <Building2 className="h-4 w-4 text-accent-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sidebar-accent-foreground font-display font-semibold text-sm">Gharpayy</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground">Arena Infrastructure</div>
          </div>
        </div>

        {(() => {
          const roleMeta = {
            "flow-ops": { label: "Flow Ops", dot: "bg-info" },
            tcm: { label: "TCM Desk", dot: "bg-accent" },
            hr: { label: "HR / Leadership", dot: "bg-success" },
            owner: { label: "Owner Portal", dot: "bg-warning" },
          } as const;
          const meta = roleMeta[role];
          const userName = role === "tcm" ? tcms.find((t) => t.id === currentTcmId)?.name : null;
          return (
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-semibold">
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                <span>{meta.label}</span>
                {userName && <span className="text-sidebar-foreground/50 normal-case tracking-normal">· {userName.split(" ")[0]} {userName.split(" ")[1]?.[0] ?? ""}.</span>}
              </div>
            </div>
          );
        })()}

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {items.map((it) => {
            const Icon = it.icon;
            if (it.to === "__more__") {
              return (
                <Popover key="more">
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors",
                        "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground text-sidebar-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>More</span>
                      <span className="ml-auto text-[10px] text-sidebar-foreground/60 font-mono">{moreItems.length}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="w-56 p-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                      All modules
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto space-y-0.5">
                      {moreItems.map((m) => {
                        const MIcon = m.icon;
                        return (
                          <Link
                            key={m.to}
                            to={m.to}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs hover:bg-muted transition-colors"
                          >
                            <MIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{m.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }
            const active = isActive(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  it.accent && !active && "text-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{it.label}</span>
                {it.badge !== undefined && it.badge > 0 && mounted && (
                  <span className={cn(
                    "ml-auto text-[10px] rounded-full px-1.5 py-0.5 font-mono",
                    it.accent
                      ? "bg-accent text-accent-foreground"
                      : "bg-destructive text-destructive-foreground",
                  )}>
                    {it.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>


        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="text-[10px] text-sidebar-foreground/70 flex items-center justify-between px-1">
            <span>Quick jump</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 font-mono text-sidebar-accent-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground px-1">View as</div>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flow-ops">Flow Ops</SelectItem>
              <SelectItem value="tcm">TCM</SelectItem>
              <SelectItem value="hr">HR / Leadership</SelectItem>
              <SelectItem value="owner">Property Owner</SelectItem>
            </SelectContent>
          </Select>
          {role === "tcm" && (
            <Select value={currentTcmId} onValueChange={setCurrentTcmId}>
              <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tcms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 bg-background/85 backdrop-blur border-b border-border flex items-center gap-3 px-4 md:px-6">
          <div className="md:hidden font-display font-semibold">Gharpayy</div>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-card hover:bg-muted/60 text-xs text-muted-foreground w-full max-w-md transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Jump to lead, page or action…</span>
            <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <AutoPilotBadge />
            <PipButton />
            <NotificationCenter role={role} />
            <ProfileMenu />
          </div>
        </header>


        <PipMount>
          <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        </PipMount>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-2 scrollbar-thin scroll-smooth snap-x">
          {items.map((item) => {
            const Icon = item.icon;
            if (item.to === "__more__") {
              return (
                <Popover key="more-m">
                  <PopoverTrigger asChild>
                    <button className="relative flex shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/60 min-w-[64px] min-h-[44px]">
                      <Icon className="h-4 w-4" />
                      <span>More</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-56 p-1">
                    <div className="max-h-[50vh] overflow-y-auto space-y-0.5">
                      {moreItems.map((m) => {
                        const MIcon = m.icon;
                        return (
                          <Link key={m.to} to={m.to} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted">
                            <MIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{m.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors min-w-[64px] min-h-[44px]",
                  active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && mounted && (
                  <span className="absolute right-1 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-mono text-destructive-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

        </div>
      </nav>

      {/* Overlays */}
      <LeadControlPanel />
      <CommandPalette />
      <CoachWidget />
      </div>
    </PictureInPictureProvider>
  );
}
