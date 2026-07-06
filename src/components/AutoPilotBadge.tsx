import { useAutoPilot } from "@/lib/pipeline/auto-pilot";
import { useAutoPilotEngine } from "@/hooks/useAutoPilot";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useMountedNow } from "@/hooks/use-now";

/** Header badge: shows auto-pilot state + last activity, click to configure. */
export function AutoPilotBadge() {
  const s = useAutoPilot();
  const stats = useAutoPilotEngine();
  const [, mounted] = useMountedNow(15_000);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[11px] font-medium transition-colors",
            s.enabled
              ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
              : "border-border bg-muted text-muted-foreground hover:bg-muted/80",
          )}
          aria-label="Auto-Pilot settings"
        >
          <Zap className={cn("h-3.5 w-3.5", s.enabled && "animate-pulse")} />
          <span>Auto-Pilot {s.enabled ? "ON" : "OFF"}</span>
          {s.enabled && mounted && stats.advanced + stats.reminders > 0 && (
            <span className="ml-1 rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px]">
              {stats.advanced + stats.reminders}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Auto-Pilot</div>
            <div className="text-[11px] text-muted-foreground">
              Runs every 15s. Actions logged.
            </div>
          </div>
          <Switch checked={s.enabled} onCheckedChange={s.setEnabled} />
        </div>

        <div className="space-y-2 text-xs">
          <Row label="Auto-assign new leads" v={s.autoAssign} on={() => s.toggle("autoAssign")} disabled={!s.enabled} />
          <Row label="Auto-advance stages" v={s.autoAdvance} on={() => s.toggle("autoAdvance")} disabled={!s.enabled} />
          <Row label="Auto tour reminders" v={s.autoReminders} on={() => s.toggle("autoReminders")} disabled={!s.enabled} />
          <Row label="Auto-escalate breaches" v={s.autoEscalate} on={() => s.toggle("autoEscalate")} disabled={!s.enabled} />
        </div>

        <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground space-y-0.5">
          <div>Advanced: <span className="font-mono text-foreground">{stats.advanced}</span></div>
          <div>Reminders: <span className="font-mono text-foreground">{stats.reminders}</span></div>
          <div>Breaches: <span className="font-mono text-foreground">{stats.breaches}</span></div>
          {mounted && stats.lastTick > 0 && (
            <div>Last tick: {formatDistanceToNow(stats.lastTick, { addSuffix: true })}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, v, on, disabled }: { label: string; v: boolean; on: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn(disabled && "opacity-50")}>{label}</span>
      <Switch checked={v} onCheckedChange={on} disabled={disabled} />
    </div>
  );
}
