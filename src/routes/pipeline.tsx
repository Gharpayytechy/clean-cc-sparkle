import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageMatrix } from "@/components/monitoring/StageMatrix";
import { ExecutionQueue } from "@/components/execution/ExecutionQueue";
import { Layers, Zap, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline · Gharpayy" },
      { name: "description", content: "11-stage board, revival queue and execution actions unified." },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-accent" /> Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Every lead, every stage, every action. Auto-Pilot advances what it can.
          </p>
        </div>

        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board"><Layers className="h-3.5 w-3.5 mr-1" /> Stage Board</TabsTrigger>
            <TabsTrigger value="queue"><Zap className="h-3.5 w-3.5 mr-1" /> Execution Queue</TabsTrigger>
            <TabsTrigger value="revival"><RefreshCw className="h-3.5 w-3.5 mr-1" /> Revival</TabsTrigger>
          </TabsList>
          <TabsContent value="board" className="mt-3"><StageMatrix /></TabsContent>
          <TabsContent value="queue" className="mt-3"><ExecutionQueue /></TabsContent>
          <TabsContent value="revival" className="mt-3">
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Revival ladder (30d · 60d · 90d) surfaces cold leads for re-engagement here.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
