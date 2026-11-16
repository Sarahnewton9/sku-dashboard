import type { Dispatch, SetStateAction } from "react";
import { Check, Minus } from "lucide-react";
import {
  getBuySessionSelectionState,
  toggleAllBuySessionIds,
  toggleBuySessionId,
} from "@shared/buySessionSelection";

export interface BuySessionPickerSession {
  id: number;
  name: string;
  createdAt: Date;
  isLocked: boolean | number;
}

interface BuySessionPickerOptionsProps {
  sessions: readonly BuySessionPickerSession[];
  selectedIds: readonly number[];
  onSelectionChange: Dispatch<SetStateAction<number[]>>;
}

function SelectionMark({ state }: { state: false | true | "indeterminate" }) {
  return (
    <span
      aria-hidden="true"
      className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
      style={{
        borderColor: state ? "oklch(0.55 0.14 55)" : "var(--border)",
        background: state ? "oklch(0.55 0.14 55)" : "transparent",
      }}
    >
      {state === true && <Check className="w-3 h-3 text-white" />}
      {state === "indeterminate" && <Minus className="w-3 h-3 text-white" />}
    </span>
  );
}

export function BuySessionPickerOptions({ sessions, selectedIds, onSelectionChange }: BuySessionPickerOptionsProps) {
  if (sessions.length === 0) {
    return <div className="px-4 py-6 text-sm text-muted-foreground text-center">No sessions yet</div>;
  }

  const availableIds = sessions.map(session => session.id);
  const selectionState = getBuySessionSelectionState(availableIds, selectedIds);
  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={selectionState === "indeterminate" ? "mixed" : selectionState}
        aria-label="Select all sessions"
        onClick={() => onSelectionChange(previous => toggleAllBuySessionIds(availableIds, previous))}
        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold border-b hover:bg-muted/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        style={{ borderColor: "var(--border)" }}
      >
        <SelectionMark state={selectionState} />
        <span className="text-foreground">Select all</span>
      </button>
      <div className="max-h-64 overflow-y-auto">
        {[...sessions].reverse().map(session => {
          const isSelected = selectedIds.includes(session.id);
          return (
            <button
              key={session.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-label={session.name}
              onClick={() => onSelectionChange(previous => toggleBuySessionId(previous, session.id))}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              style={{ background: isSelected ? "oklch(0.97 0.04 65 / 0.6)" : undefined }}
            >
              <SelectionMark state={isSelected} />
              <span className="flex-1 truncate font-medium text-foreground">{session.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(session.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
              </span>
              {session.isLocked && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                >Locked</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
