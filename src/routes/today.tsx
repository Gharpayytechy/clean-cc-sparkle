import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useMountedNow } from "@/hooks/use-now";
import { buildDoNextQueue, computeTcmPerformance } from "@/lib/engine";
import { useMemo } from "react";
import { QuickActionRow } from "@/components/QuickActionRow";
import { format, formatDistanceToNow } from "date-fns";
import { Sun, Zap, ArrowUpRight, Trophy } from "lucide-react";
import { KpiCard } from "@/components/atoms";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutionQueue } from "@/components/execution/ExecutionQueue";
import { DailyActionQueue } from "@/components/crm10x/DailyActionQueue";
import { useAutoPilot } from "@/lib/pipeline/auto-pilot";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Gharpayy" },
      { name: "description", content: "One super module: ranked next actions, execution queue, follow-ups. Auto-Pilot fires what it can." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { role, currentTcmId, leads, tours, followUps, tcms, completeFollowUp } = useApp();
  const [now, mounted] = useMountedNow(15_000);
  const autopilot = useAutoPilot((s) => s.enabled);

  const filterTcm = role === "tcm" ? currentTcmId : undefined;
  const queue = useMemo(
    () => buildDoNextQueue(leads, tours, followUps, now || Date.now(), filterTcm),
    [leads, tours, followUps, now, filterTcm],
  );
  const me = role === "tcm" ? tcms.find((t) => t.id === currentTcmId) : null;
  const perf = me ? computeTcmPerformance(me.id, leads, tours, followUps, now || Date.now()) : null;
  const top = queue.slice(0, 12);

  return (
    <AppShell>
      <div className="space-y-4">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Sun className="h-3.5 w-3.5" />
              <span className="min-h-[1em]">
                {mounted ? format(new Date(now), "EEEE, MMMM d · h:mm a") : "\u00a0"}
              </span>
              {autopilot && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                  <Zap className="h-3 w-3" /> Auto-Pilot handling routine work
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {mounted ? greeting(now) : "Hello"}{me ? `, ${me.name.split(" ")[0]}` : ""}.
            </h1>
            <p className="text-sm text-muted-foreground">
              {top.length === 0
                ? "Inbox zero. Auto-Pilot is watching."
                : `${queue.length} action${queue.length > 1 ? "s" : ""} ranked. Start at the top.`}
            </p>
          </div>
          <Link to="/leads" className="text-xs text-accent inline-flex items-center gap-1">
            All leads <ArrowUpRight className="h-3 w-3" />
          </Link>
        </header>

        {perf && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="My leads" value={perf.leadCount} sub={`${perf.toursDone} tours done`} />
            <KpiCard label="My conversion" value={`${perf.conversion}%`} sub={`${perf.bookings} booked`} tone="success" />
            <KpiCard label="Pending post-tour" value={perf.pendingPostTour} sub="Fill now" tone={perf.pendingPostTour ? "destructive" : "default"} />
            <KpiCard label="Discipline" value={`${perf.discipline}`} sub="0–100" tone={perf.discipline >= 75 ? "success" : perf.discipline >= 50 ? "warning" : "destructive"} />
          </div>
        )}

        <Tabs defaultValue="do-next">
          <TabsList>
            <TabsTrigger value="do-next"><Zap className="h-3.5 w-3.5 mr-1" /> Do Next</TabsTrigger>
            <TabsTrigger value="execution">Execution Queue</TabsTrigger>
            <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="do-next" className="mt-3">
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <header className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-sm font-semibold">Do this next</h2>
                  <span className="text-[11px] text-muted-foreground font-mono">live · 15s refresh</span>
                </div>
              </header>
              {top.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Trophy className="h-8 w-8 text-success mx-auto mb-2" />
                  <div className="font-display font-semibold">Inbox zero.</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    New leads land here automatically. Auto-Pilot handles routine follow-ups.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {top.map((a) => {
                    const lead = leads.find((l) => l.id === a.leadId);
                    if (!lead) return null;
                    const onDone = a.kind === "follow-up-overdue" || a.kind === "follow-up-today"
                      ? () => {
                          const f = followUps.find((x) => x.leadId === a.leadId && !x.done);
                          if (f) completeFollowUp(f.id);
                        }
                      : undefined;
                    const dueLabel = mounted && a.dueAt
                      ? formatDistanceToNow(new Date(a.dueAt), { addSuffix: true })
                      : undefined;
                    return (
                      <QuickActionRow
                        key={`${a.leadId}-${a.kind}`}
                        lead={lead}
                        reason={a.reason}
                        accent={toneFor(a)}
                        dueLabel={dueLabel}
                        onDone={onDone}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="execution" className="mt-3">
            <ExecutionQueue />
          </TabsContent>

          <TabsContent value="follow-ups" className="mt-3">
            <DailyActionQueue />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function greeting(ts: number) {
  const h = new Date(ts).getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function toneFor(a: { kind: string }): "destructive" | "warning" | "accent" | "default" {
  if (a.kind === "post-tour-overdue" || a.kind === "first-response" || a.kind === "follow-up-overdue") return "destructive";
  if (a.kind === "no-follow-up") return "warning";
  if (a.kind === "tour-today" || a.kind === "follow-up-today") return "accent";
  return "default";
}
