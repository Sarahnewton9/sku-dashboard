import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, Ruler } from "lucide-react";

const SIZES = ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "11"];
const HIGHLIGHT_SIZE = "7";

interface Props {
  /** If provided, shows only this last's measurements. If null, shows all lasts. */
  filterLast?: string | null;
  onClose: () => void;
}

export function LastMeasurementsPanel({ filterLast, onClose }: Props) {
  const { data: rows = [], isLoading } = trpc.lastMeasurements.getAll.useQuery();

  // Build structured data: { [lastName]: { LENGTH: { [size]: value }, GIRTH: { [size]: value } } }
  const structured = useMemo(() => {
    const map: Record<string, { LENGTH: Record<string, number>; GIRTH: Record<string, number> }> = {};
    for (const row of rows) {
      if (!map[row.lastName]) map[row.lastName] = { LENGTH: {}, GIRTH: {} };
      map[row.lastName][row.measureType][row.size] = row.value;
    }
    return map;
  }, [rows]);

  const lastNames = useMemo(() => {
    const all = Object.keys(structured).sort();
    return filterLast ? all.filter((n) => n === filterLast.toUpperCase()) : all;
  }, [structured, filterLast]);

  const [activeType, setActiveType] = useState<"LENGTH" | "GIRTH">("LENGTH");

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-card rounded-xl p-8 shadow-xl">
          <p className="text-muted-foreground">Loading measurements…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">
              {filterLast ? `${filterLast.toUpperCase()} — Last Measurements` : "Casual Flat Last Measurements"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Type toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                onClick={() => setActiveType("LENGTH")}
                className={`px-4 py-1.5 transition-colors ${activeType === "LENGTH" ? "bg-amber-100 text-amber-800 font-medium" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                Length
              </button>
              <button
                onClick={() => setActiveType("GIRTH")}
                className={`px-4 py-1.5 transition-colors ${activeType === "GIRTH" ? "bg-amber-100 text-amber-800 font-medium" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >
                Girth
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 p-4">
          {lastNames.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No measurement data available.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card z-10 text-left px-4 py-2.5 font-semibold text-foreground border-b border-border min-w-[100px]">
                    LAST
                  </th>
                  {SIZES.map((size) => (
                    <th
                      key={size}
                      className={`px-3 py-2.5 text-center font-semibold border-b border-border min-w-[52px] ${
                        size === HIGHLIGHT_SIZE
                          ? "bg-amber-100 text-amber-800 border-l border-r border-amber-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {size}#
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lastNames.map((lastName, idx) => {
                  const data = structured[lastName]?.[activeType] ?? {};
                  return (
                    <tr
                      key={lastName}
                      className={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}
                    >
                      <td className="sticky left-0 z-10 px-4 py-2.5 font-semibold text-foreground border-r border-border" style={{ background: idx % 2 === 0 ? "var(--card)" : undefined }}>
                        {lastName}
                      </td>
                      {SIZES.map((size) => (
                        <td
                          key={size}
                          className={`px-3 py-2.5 text-center tabular-nums ${
                            size === HIGHLIGHT_SIZE
                              ? "bg-amber-50 text-amber-900 font-semibold border-l border-r border-amber-200"
                              : "text-foreground"
                          }`}
                        >
                          {data[size] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-300 shrink-0" />
          Size 7 highlighted as primary fitting reference. All values in mm.
        </div>
      </div>
    </div>
  );
}
