import { usePipeline } from "@/lib/pipeline/store";
import { missingDossierFields } from "@/lib/pipeline/stage-engine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useIdentityStore } from "@/lib/lead-identity/store";

interface Props { leadId: string; }

/**
 * 9-field mandatory dossier. Grouped 3 x 3. Live completion % feeds the timer.
 */
export function DossierForm({ leadId }: Props) {
  const dossier = usePipeline((s) => s.states[leadId]?.dossier ?? { completionPct: 0 });
  const updateDossier = usePipeline((s) => s.updateDossier);
  const advanceStage = usePipeline((s) => s.advanceStage);
  const user = useIdentityStore((s) => s.currentUser);
  const missing = missingDossierFields(dossier);

  const patch = (p: Parameters<typeof updateDossier>[1]) =>
    updateDossier(leadId, p, { userId: user.id, userName: user.name });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Move date *</Label>
          <Input type="date" value={dossier.moveDate ?? ""}
            onChange={(e) => patch({ moveDate: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Budget (₹) *</Label>
          <Input type="number" value={dossier.budget ?? ""}
            onChange={(e) => patch({ budget: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Preferred area *</Label>
          <Input value={dossier.area ?? ""}
            onChange={(e) => patch({ area: e.target.value })} />
        </div>

        <div>
          <Label className="text-xs">Gender *</Label>
          <Select value={dossier.gender ?? ""} onValueChange={(v) => patch({ gender: v as "male" | "female" | "coed" })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="coed">Coed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sharing *</Label>
          <Select value={dossier.sharing ?? ""} onValueChange={(v) => patch({ sharing: v as "private" | "double" | "triple" | "any" })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="double">Double</SelectItem>
              <SelectItem value="triple">Triple</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Moving feasibility *</Label>
          <Select value={dossier.movingFeasibility ?? ""} onValueChange={(v) => patch({ movingFeasibility: v as "immediate" | "7d" | "15d" | "30d" | "researching" })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">Immediate</SelectItem>
              <SelectItem value="7d">Within 7 days</SelectItem>
              <SelectItem value="15d">Within 15 days</SelectItem>
              <SelectItem value="30d">Within 30 days</SelectItem>
              <SelectItem value="researching">Just researching</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Decision maker *</Label>
          <Select value={dossier.decisionMaker ?? ""} onValueChange={(v) => patch({ decisionMaker: v as "self" | "parents" | "friends" | "company" })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Self</SelectItem>
              <SelectItem value="parents">Parents</SelectItem>
              <SelectItem value="friends">Friends</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Competition *</Label>
          <Select value={dossier.competition ?? ""} onValueChange={(v) => patch({ competition: v as "visiting" | "booked" | "comparing" | "none" })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="visiting">Already visiting others</SelectItem>
              <SelectItem value="booked">Already booked elsewhere</SelectItem>
              <SelectItem value="comparing">Comparing</SelectItem>
              <SelectItem value="none">No competition</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Primary objection *</Label>
          <Select value={dossier.objection ?? ""} onValueChange={(v) => patch({ objection: v as NonNullable<typeof dossier.objection> })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="distance">Distance</SelectItem>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="parents">Parents</SelectItem>
              <SelectItem value="friends">Friends</SelectItem>
              <SelectItem value="timing">Timing</SelectItem>
              <SelectItem value="exploring">Still exploring</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Notes / properties sent (P1, P2, P3, PDF, video)</Label>
        <Textarea rows={2} value={dossier.objectionNotes ?? ""}
          onChange={(e) => patch({ objectionNotes: e.target.value })}
          placeholder="e.g. Sent P1 Bliss + P2 Metrofield + PDF" />
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {missing.length === 0
            ? "All 9 fields captured — ready to match property."
            : `${missing.length} field${missing.length > 1 ? "s" : ""} remaining: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`}
        </div>
        <Button
          size="sm"
          disabled={missing.length > 0}
          onClick={() => advanceStage(leadId, "MATCHED", { userId: user.id, userName: user.name })}
        >
          Lock dossier → Property match
        </Button>
      </div>
    </div>
  );
}
