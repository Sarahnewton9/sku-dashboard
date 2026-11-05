import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { buildSampleReceiptWorklist } from "@shared/sampleReceiptTracking";
import type { Season } from "@/contexts/SeasonContext";

type ReceiptRow = ReturnType<typeof buildSampleReceiptWorklist>["receivedSkus"][number];

export function SampleReceiptDropdown({ season, received, rows, pending, onToggle }: {
  season?: Season;
  received: boolean;
  rows: ReceiptRow[];
  pending: ReadonlySet<string>;
  onToggle: (row: ReceiptRow) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = rows.filter((row) => row.label.toLowerCase().includes(search.trim().toLowerCase()));
  const title = received ? "Received Samples" : "Waiting on Samples";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={title}
          className="rounded-lg px-4 py-3 flex w-full items-center justify-between text-left"
          style={received
            ? { background: "oklch(0.94 0.08 155)", border: "1px solid oklch(0.85 0.12 155)", color: "oklch(0.40 0.14 155)" }
            : { background: "oklch(0.97 0.06 65)", border: "1px solid oklch(0.88 0.10 65)", color: "oklch(0.45 0.14 55)" }}>
          <span className="text-sm font-medium">{received ? "Received" : "Waiting"}</span>
          <span className="flex items-center gap-2"><span className="text-xl font-display font-bold tabular-nums">{rows.length}</span><ChevronDown className="w-4 h-4" /></span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={received ? "start" : "end"} className="w-[min(30rem,calc(100vw-2rem))] p-3">
        <h4 className="text-sm font-semibold mb-2">{season ? `${season} — ${title}` : title}</h4>
        <input aria-label={`Search ${title.toLowerCase()}`} placeholder="Search style or colour/leather…"
          value={search} onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm mb-2" />
        <ul className="max-h-72 overflow-y-auto space-y-1" aria-label={title}>
          {filtered.map((row) => (
            <li key={row.key} className="flex items-center gap-3 py-2 border-b last:border-0">
              <span className="text-xs flex-1 min-w-0 break-words">{row.label}{row.status === "fitting_sample" ? " (fitting)" : ""}</span>
              <button type="button" disabled={pending.has(row.key)}
                onClick={() => onToggle(row)}
                aria-label={`${received ? "Mark waiting" : "Mark received"}: ${row.label}`}
                className="shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium disabled:opacity-50 hover:bg-muted">
                {pending.has(row.key) ? <Loader2 className="w-3 h-3 animate-spin" /> : !received ? <Check className="w-3 h-3" /> : null}
                {received ? "Mark waiting" : "Rcvd"}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="text-xs text-muted-foreground py-3">{search ? "No matching samples." : "No samples in this list."}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
