import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiStrip } from "@/components/monitoring/KpiStrip";
import { TeamDashboard } from "@/components/monitoring/TeamDashboard";
import { StageMatrix } from "@/components/monitoring/StageMatrix";
import { ActivityLogTable } from "@/components/monitoring/ActivityLogTable";
import { ManagerDashboard } from "@/components/crm10x/ManagerDashboard";
import { ManagerMorningReview } from "@/components/execution/ManagerMorningReview";
import { Activity, Zap, Trophy, Users, HeartPulse, Layers } from "lucide-react";

export const Route = createFileRoute("/command")({
  head: () => ({
    meta: [
      { title: "Command Center · Gharpayy" },
      { name: "description", content: "Unified live command — monitoring, manager, leaderboard, activity and system health in one place." },
    ],
  }),
  component: CommandCenter,
});

function CommandCenter() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" /> Command Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Auto-refresh 30s · every action logged · one place to intervene.
            </p>
          </div>
        </div>

        <KpiStrip />

        <Tabs defaultValue="live">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="live"><Zap className="h-3.5 w-3.5 mr-1" /> Live</TabsTrigger>
            <TabsTrigger value="team"><Users className="h-3.5 w-3.5 mr-1" /> Team</TabsTrigger>
            <TabsTrigger value="pipeline"><Layers className="h-3.5 w-3.5 mr-1" /> Pipeline</TabsTrigger>
            <TabsTrigger value="manager"><Trophy className="h-3.5 w-3.5 mr-1" /> Manager</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5 mr-1" /> Activity</TabsTrigger>
            <TabsTrigger value="health"><HeartPulse className="h-3.5 w-3.5 mr-1" /> Health</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-3 space-y-4">
            <ManagerMorningReview />
          </TabsContent>
          <TabsContent value="team" className="mt-3"><TeamDashboard /></TabsContent>
          <TabsContent value="pipeline" className="mt-3"><StageMatrix /></TabsContent>
          <TabsContent value="manager" className="mt-3"><ManagerDashboard /></TabsContent>
          <TabsContent value="activity" className="mt-3"><ActivityLogTable /></TabsContent>
          <TabsContent value="health" className="mt-3">
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              System health, connector status and background workers appear here.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
