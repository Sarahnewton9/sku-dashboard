import { CheckCircle2 } from "lucide-react";
import {
  getLastApprovalSizeChecks,
  type LastApprovalSizeField,
  type LastApprovalSizeFlags,
} from "@shared/lastApprovalSizes";

export function LastApprovalSizeChecks({
  season,
  approvals,
  onToggle,
}: {
  season: string;
  approvals?: LastApprovalSizeFlags;
  onToggle: (field: LastApprovalSizeField, current: boolean) => void;
}) {
  return (
    <>
      {getLastApprovalSizeChecks(season, approvals).map(({ label, field, checked, firstFitting }) => (
        <button
          key={field}
          type="button"
          aria-pressed={checked}
          aria-label={`Size ${label}${firstFitting ? " — first fitting" : ""}`}
          onClick={() => onToggle(field, checked)}
          title={`Size ${label}${firstFitting ? " — first fitting" : ""}: ${checked ? "approved — click to uncheck" : "not yet approved"}`}
          className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all hover:opacity-80"
          style={checked
            ? { background: "oklch(0.92 0.08 155)", color: "oklch(0.35 0.14 155)", borderColor: "oklch(0.72 0.14 155)" }
            : { background: "var(--muted)", color: "var(--muted-foreground)", borderColor: "var(--border)" }
          }
        >
          {checked && <CheckCircle2 className="w-3 h-3" />}
          <span className="flex flex-col items-center leading-tight">
            <span>Sz {label}</span>
            {firstFitting && <span className="text-[9px] font-normal">First fitting</span>}
          </span>
        </button>
      ))}
    </>
  );
}
