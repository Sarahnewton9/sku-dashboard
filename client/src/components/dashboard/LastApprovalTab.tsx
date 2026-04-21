import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { CheckCircle2, Clock, ChevronDown, ChevronRight } from "lucide-react";

// Extract all unique lasts from skuData
const ALL_LASTS = Array.from(new Set(skuData.styles.map((s) => s.last))).sort();

// Build a map of last → styles for context
const LAST_TO_STYLES: Record<string, string[]> = {};
for (const s of skuData.styles) {
  if (!LAST_TO_STYLES[s.last]) LAST_TO_STYLES[s.last] = [];
  LAST_TO_STYLES[s.last].push(s.style);
}

export default function LastApprovalTab() {
  const { data: approvals, refetch } = trpc.lastApproval.getAll.useQuery();
  const upsert = trpc.lastApproval.upsert.useMutation({ onSuccess: () => refetch() });

  const [expandedLast, setExpandedLast] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [filter, setFilter] = useState<"all" | "approved" | "waiting_revised">("all");

  // Build a map of lastName → approval record
  const approvalMap = useMemo(() => {
    const map: Record<string, { status: "approved" | "waiting_revised"; notes: string | null }> = {};
    for (const a of approvals ?? []) {
      map[a.lastName] = { status: a.status, notes: a.notes ?? null };
    }
    return map;
  }, [approvals]);

  const filteredLasts = useMemo(() => {
    return ALL_LASTS.filter((last) => {
      const status = approvalMap[last]?.status ?? "waiting_revised";
      if (filter === "all") return true;
      return status === filter;
    });
  }, [approvalMap, filter]);

  const approvedCount = ALL_LASTS.filter((l) => (approvalMap[l]?.status ?? "waiting_revised") === "approved").length;
  const waitingCount = ALL_LASTS.length - approvedCount;

  const handleToggle = (lastName: string, current: "approved" | "waiting_revised") => {
    const next = current === "approved" ? "waiting_revised" : "approved";
    upsert.mutate({ lastName, status: next, notes: approvalMap[lastName]?.notes ?? null });
  };

  const handleSaveNotes = (lastName: string) => {
    upsert.mutate({
      lastName,
      status: approvalMap[lastName]?.status ?? "waiting_revised",
      notes: notesValue || null,
    });
    setEditingNotes(null);
  };

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-xl p-4 cursor-pointer border transition-all"
          style={{
            background: filter === "all" ? "oklch(0.97 0.02 240)" : "var(--card)",
            borderColor: filter === "all" ? "oklch(0.72 0.10 240)" : "var(--border)",
          }}
          onClick={() => setFilter("all")}
        >
          <div className="text-2xl font-bold text-foreground">{ALL_LASTS.length}</div>
          <div className="text-sm text-muted-foreground mt-0.5">Total Lasts</div>
        </div>
        <div
          className="rounded-xl p-4 cursor-pointer border transition-all"
          style={{
            background: filter === "approved" ? "oklch(0.96 0.06 155)" : "var(--card)",
            borderColor: filter === "approved" ? "oklch(0.72 0.14 155)" : "var(--border)",
          }}
          onClick={() => setFilter(filter === "approved" ? "all" : "approved")}
        >
          <div className="text-2xl font-bold" style={{ color: "oklch(0.40 0.14 155)" }}>{approvedCount}</div>
          <div className="text-sm text-muted-foreground mt-0.5">Approved</div>
        </div>
        <div
          className="rounded-xl p-4 cursor-pointer border transition-all"
          style={{
            background: filter === "waiting_revised" ? "oklch(0.97 0.06 65)" : "var(--card)",
            borderColor: filter === "waiting_revised" ? "oklch(0.72 0.16 65)" : "var(--border)",
          }}
          onClick={() => setFilter(filter === "waiting_revised" ? "all" : "waiting_revised")}
        >
          <div className="text-2xl font-bold" style={{ color: "oklch(0.50 0.14 55)" }}>{waitingCount}</div>
          <div className="text-sm text-muted-foreground mt-0.5">Waiting on Revised</div>
        </div>
      </div>

      {/* Last list */}
      <div className="space-y-2">
        {filteredLasts.map((lastName) => {
          const approval = approvalMap[lastName];
          const status = approval?.status ?? "waiting_revised";
          const notes = approval?.notes ?? null;
          const styles = LAST_TO_STYLES[lastName] ?? [];
          const isExpanded = expandedLast === lastName;
          const isEditingThisNotes = editingNotes === lastName;

          return (
            <div
              key={lastName}
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: status === "approved" ? "oklch(0.80 0.10 155)" : "var(--border)",
                background: status === "approved" ? "oklch(0.98 0.02 155)" : "var(--card)",
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Toggle button */}
                <button
                  onClick={() => handleToggle(lastName, status)}
                  className="flex-shrink-0 transition-transform hover:scale-110"
                  title={status === "approved" ? "Mark as Waiting on Revised" : "Mark as Approved"}
                >
                  {status === "approved" ? (
                    <CheckCircle2 className="w-6 h-6" style={{ color: "oklch(0.45 0.14 155)" }} />
                  ) : (
                    <Clock className="w-6 h-6" style={{ color: "oklch(0.60 0.12 65)" }} />
                  )}
                </button>

                {/* Last name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{lastName}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={
                        status === "approved"
                          ? { background: "oklch(0.92 0.08 155)", color: "oklch(0.35 0.14 155)" }
                          : { background: "oklch(0.95 0.06 65)", color: "oklch(0.50 0.14 55)" }
                      }
                    >
                      {status === "approved" ? "Approved" : "Waiting on Revised"}
                    </span>
                  </div>
                  {notes && !isExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{notes}</p>
                  )}
                </div>

                {/* Style count */}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {styles.length} {styles.length === 1 ? "style" : "styles"}
                </span>

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedLast(isExpanded ? null : lastName)}
                  className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Expanded section */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--border)" }}>
                  {/* Styles on this last */}
                  <div className="mt-3 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Styles on this last
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {styles.map((s) => (
                        <span
                          key={s}
                          className="text-xs px-2 py-0.5 rounded border font-medium text-foreground"
                          style={{ borderColor: "var(--border)", background: "var(--muted)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Notes
                    </p>
                    {isEditingThisNotes ? (
                      <div className="flex gap-2">
                        <textarea
                          className="flex-1 text-sm rounded border px-3 py-2 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                          style={{ borderColor: "var(--border)" }}
                          rows={3}
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add notes about this last..."
                          autoFocus
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleSaveNotes(lastName)}
                            className="px-3 py-1.5 rounded text-xs font-medium text-white"
                            style={{ background: "oklch(0.45 0.14 155)" }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="px-3 py-1.5 rounded text-xs font-medium text-muted-foreground border"
                            style={{ borderColor: "var(--border)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="text-sm text-muted-foreground rounded border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors min-h-[2.5rem]"
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => {
                          setEditingNotes(lastName);
                          setNotesValue(notes ?? "");
                        }}
                      >
                        {notes ? notes : <span className="italic opacity-60">Click to add notes...</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
