/**
 * SalesTab — paste in sales data (style + colour + units) and analyse it.
 *
 * Paste format (tab-separated, as exported from the report):
 *   StyleName   (no units — this is a style header)
 *   ColourName  units
 *   ColourName  units
 *   ...
 *   Grand Total  482
 *
 * The parser detects style headers as lines with no numeric second token,
 * and colour rows as lines with a numeric second token.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Trash2, PlusCircle, ChevronDown, ChevronRight, BarChart2, Upload } from "lucide-react";

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  style: string;
  colour: string;
  units: number;
}

function parseSalesText(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let currentStyle = "";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip grand total line
    if (/^grand total/i.test(line)) continue;
    // Split on tab or multiple spaces
    const parts = line.split(/\t|  +/);
    const lastPart = parts[parts.length - 1].trim();
    const units = parseInt(lastPart, 10);
    if (parts.length === 1 || isNaN(units)) {
      // Style header — no numeric value at end
      currentStyle = line.replace(/\s+\d+$/, "").trim().toUpperCase();
    } else {
      // Colour row
      const colour = parts.slice(0, parts.length - 1).join(" ").trim().toUpperCase();
      if (currentStyle && colour) {
        rows.push({ style: currentStyle, colour, units });
      }
    }
  }
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SalesTab() {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [snapshotName, setSnapshotName] = useState("");
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const { data: snapshots = [] } = trpc.sales.listSnapshots.useQuery();
  const { data: rows = [] } = trpc.sales.getSnapshot.useQuery(
    { snapshotId: selectedSnapshotId! },
    { enabled: selectedSnapshotId !== null }
  );

  const createMutation = trpc.sales.createSnapshot.useMutation({
    onSuccess: (data) => {
      utils.sales.listSnapshots.invalidate();
      setSelectedSnapshotId(data.id ?? null);
      setShowPasteModal(false);
      setPasteText("");
      setSnapshotName("");
      toast.success("Sales data saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.sales.deleteSnapshot.useMutation({
    onSuccess: () => {
      utils.sales.listSnapshots.invalidate();
      setSelectedSnapshotId(null);
      toast.success("Snapshot deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-select most recent snapshot
  useMemo(() => {
    if (snapshots.length > 0 && selectedSnapshotId === null) {
      setSelectedSnapshotId(snapshots[0].id);
    }
  }, [snapshots]);

  // Build style-grouped view
  const styleGroups = useMemo(() => {
    const map = new Map<string, { colour: string; units: number }[]>();
    for (const row of rows) {
      if (!map.has(row.style)) map.set(row.style, []);
      map.get(row.style)!.push({ colour: row.colour, units: row.units });
    }
    // Sort styles by total units desc
    return Array.from(map.entries())
      .map(([style, colours]) => ({
        style,
        colours: colours.sort((a, b) => b.units - a.units),
        total: colours.reduce((s, c) => s + c.units, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.units, 0), [rows]);

  const toggleStyle = (style: string) => {
    setExpandedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style);
      else next.add(style);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandedStyles.size === styleGroups.length) {
      setExpandedStyles(new Set());
    } else {
      setExpandedStyles(new Set(styleGroups.map((g) => g.style)));
    }
  };

  const handleSave = () => {
    if (!snapshotName.trim()) { toast.error("Please enter a name for this snapshot"); return; }
    if (!pasteText.trim()) { toast.error("Please paste some sales data"); return; }
    const parsed = parseSalesText(pasteText);
    if (parsed.length === 0) { toast.error("No rows could be parsed — check the format"); return; }
    createMutation.mutate({ name: snapshotName.trim(), rows: parsed });
  };

  const maxUnits = useMemo(() => Math.max(...styleGroups.map((g) => g.total), 1), [styleGroups]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold" style={{ color: "var(--foreground)" }}>
            Sales Analysis
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 80)" }}>
            Paste in sales data to track units sold by style and colourway
          </p>
        </div>
        <button
          onClick={() => setShowPasteModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
        >
          <Upload className="w-4 h-4" />
          Paste Sales Data
        </button>
      </div>

      {/* Snapshot selector */}
      {snapshots.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {snapshots.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedSnapshotId(s.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  selectedSnapshotId === s.id
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-card text-foreground border-border hover:border-amber-400"
                }`}
              >
                {s.name}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete snapshot "${s.name}"?`)) {
                    deleteMutation.mutate({ snapshotId: s.id });
                  }
                }}
                className="p-1 rounded text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Summary bar */}
      {rows.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-3 rounded-xl border bg-card">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {grandTotal.toLocaleString()} units sold
            </span>
          </div>
          <span className="text-sm" style={{ color: "oklch(0.55 0.01 80)" }}>
            {styleGroups.length} styles · {rows.length} colourways
          </span>
          <button
            onClick={handleExpandAll}
            className="ml-auto text-xs text-amber-600 hover:text-amber-700 font-medium"
          >
            {expandedStyles.size === styleGroups.length ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}

      {/* Style groups */}
      {styleGroups.length === 0 && selectedSnapshotId !== null && (
        <div className="text-center py-16 text-sm" style={{ color: "oklch(0.55 0.01 80)" }}>
          No data in this snapshot.
        </div>
      )}
      {styleGroups.length === 0 && selectedSnapshotId === null && (
        <div className="text-center py-16 space-y-3">
          <BarChart2 className="w-10 h-10 mx-auto text-amber-400 opacity-60" />
          <p className="text-sm font-medium" style={{ color: "oklch(0.55 0.01 80)" }}>
            No sales data yet
          </p>
          <p className="text-xs" style={{ color: "oklch(0.65 0.01 80)" }}>
            Click "Paste Sales Data" to add your first snapshot
          </p>
        </div>
      )}

      <div className="space-y-2">
        {styleGroups.map(({ style, colours, total }) => {
          const isExpanded = expandedStyles.has(style);
          const barWidth = Math.round((total / maxUnits) * 100);
          return (
            <div
              key={style}
              className="rounded-xl border bg-card overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              {/* Style header row */}
              <button
                onClick={() => toggleStyle(style)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/40 transition-colors text-left"
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.55 0.01 80)" }} />
                }
                <span className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>
                  {style}
                </span>
                {/* Mini bar */}
                <div className="hidden sm:flex items-center gap-2 flex-1 max-w-48">
                  <div className="flex-1 h-1.5 rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums w-16 text-right" style={{ color: "var(--foreground)" }}>
                  {total.toLocaleString()}
                </span>
                <span className="text-xs w-16 text-right" style={{ color: "oklch(0.55 0.01 80)" }}>
                  {colours.length} colour{colours.length !== 1 ? "s" : ""}
                </span>
              </button>

              {/* Colour rows */}
              {isExpanded && (
                <div className="border-t" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--border)", background: "oklch(0.97 0.005 80)" }}>
                        <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-wide" style={{ color: "oklch(0.55 0.01 80)" }}>
                          Colour
                        </th>
                        <th className="text-right px-4 py-2 font-medium text-xs uppercase tracking-wide w-24" style={{ color: "oklch(0.55 0.01 80)" }}>
                          Units
                        </th>
                        <th className="text-right px-4 py-2 font-medium text-xs uppercase tracking-wide w-24" style={{ color: "oklch(0.55 0.01 80)" }}>
                          % of Style
                        </th>
                        <th className="px-4 py-2 w-48" />
                      </tr>
                    </thead>
                    <tbody>
                      {colours.map((c) => {
                        const pct = total > 0 ? Math.round((c.units / total) * 100) : 0;
                        const colourBarWidth = total > 0 ? (c.units / total) * 100 : 0;
                        return (
                          <tr
                            key={c.colour}
                            className="border-b last:border-0 hover:bg-amber-50/20 transition-colors"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <td className="px-4 py-2.5 font-medium" style={{ color: "var(--foreground)" }}>
                              {c.colour}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--foreground)" }}>
                              {c.units}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-xs" style={{ color: "oklch(0.55 0.01 80)" }}>
                              {pct}%
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-amber-400"
                                  style={{ width: `${colourBarWidth}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paste modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
            style={{ maxHeight: "90vh", borderColor: "var(--border)", border: "1px solid" }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-display font-bold text-lg" style={{ color: "var(--foreground)" }}>
                Paste Sales Data
              </h3>
              <button
                onClick={() => { setShowPasteModal(false); setPasteText(""); setSnapshotName(""); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                  Snapshot name (e.g. "SS26 Week 4")
                </label>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="SS26 Week 4"
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                  Paste data below
                </label>
                <p className="text-xs mb-2" style={{ color: "oklch(0.60 0.01 80)" }}>
                  Format: style name on its own line, then colour + tab + units per line. Grand Total line is ignored.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Cappa\t39\nPetal Nappa/Vino\t15\nSky Nappa/Vino\t11\n..."}
                  rows={14}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                />
                {pasteText.trim() && (
                  <p className="text-xs mt-1 text-amber-600">
                    Preview: {parseSalesText(pasteText).length} rows parsed
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => { setShowPasteModal(false); setPasteText(""); setSnapshotName(""); }}
                className="px-4 py-2 rounded-lg text-sm border bg-card hover:bg-amber-50 transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving…" : "Save Snapshot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
