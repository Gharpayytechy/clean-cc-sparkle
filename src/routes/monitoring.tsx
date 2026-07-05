import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { KpiStrip } from "@/components/monitoring/KpiStrip";
import { TeamDashboard } from "@/components/monitoring/TeamDashboard";
import { StageMatrix } from "@/components/monitoring/StageMatrix";
import { ActivityLogTable } from "@/components/monitoring/ActivityLogTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Monitoring · Gharpayy Command Center" },
      { name: "description", content: "Real-time CRM execution monitoring — activity, pipeline, and team performance." },
      { property: "og:title", content: "Monitoring · Gharpayy" },
      { property: "og:description", content: "Real-time CRM execution monitoring across the team." },
    ],
  }),
  component: MonitoringPage,
});

function MonitoringPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Live 30-second refresh · every action tracked · execute or intervene.
          </p>
        </div>

        <KpiStrip />

        <Tabs defaultValue="team">
          <TabsList>
            <TabsTrigger value="team">Team Dashboard</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline Health</TabsTrigger>
            <TabsTrigger value="activity">Raw Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="team" className="mt-3"><TeamDashboard /></TabsContent>
          <TabsContent value="pipeline" className="mt-3"><StageMatrix /></TabsContent>
          <TabsContent value="activity" className="mt-3"><ActivityLogTable /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
