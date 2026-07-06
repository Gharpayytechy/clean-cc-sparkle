import { useEffect, useRef, useState } from "react";
import { runAutoPilotTick, useAutoPilot } from "@/lib/pipeline/auto-pilot";

/** Mount once in AppShell — ticks every 15s and applies rules. */
export function useAutoPilotEngine(intervalMs = 15_000) {
  const enabled = useAutoPilot((s) => s.enabled);
  const [stats, setStats] = useState({ advanced: 0, reminders: 0, breaches: 0, lastTick: 0 });
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (running.current) return;
      running.current = true;
      try {
        const r = runAutoPilotTick();
        setStats({ ...r, lastTick: Date.now() });
      } finally {
        running.current = false;
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return stats;
}
