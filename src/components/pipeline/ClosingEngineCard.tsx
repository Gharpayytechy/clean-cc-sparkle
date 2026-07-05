import { usePipeline } from "@/lib/pipeline/store";
import { STAGE_CONFIG } from "@/lib/pipeline/stage-config";
import { computeSlaState } from "@/lib/pipeline/stage-engine";
import { useAutomationTicker } from "@/hooks/useAutomationTicker";
import { StageStepper } from "./StageStepper";
import { StagePanel } from "./StagePanel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props { leadId: string; }

/**
 * Master lead-detail panel showing 11-stage stepper + active stage sub-panel.
 * Drop this into any lead detail view.
 */
export function ClosingEngineCard({ leadId }: Props) {
  const now = useAutomationTicker(1000);
  const state = usePipeline((s) => s.states[leadId]);
  const ensure = usePipeline((s) => s.ensure);
  if (!state) {
    ensure(leadId);
    return null;
  }
  const sla = computeSlaState(state, now);
  const cfg = STAGE_CONFIG[state.currentStage];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Closing Engine</div>
          <div className="text-sm font-display font-semibold">{cfg.label}</div>
          <div className="text-xs text-muted-foreground">{cfg.description}</div>
        </div>
        <Badge variant={sla === "ok" ? "outline" : sla === "warning" ? "secondary" : "destructive"} className={cn("uppercase text-[10px]")}>
          SLA · {sla}
        </Badge>
      </div>
      <StageStepper leadId={leadId} />
      <StagePanel leadId={leadId} />
    </div>
  );
}
