"""
Patch SpecsTab.tsx to implement the Spec Status System:
1. Add DropdownMenu import
2. Add getAllMeta query + specStatusMap
3. Update specMeta to include specStatus
4. Add setStatusMutation + handleSetStatus
5. Update handleUpsert to pass colours + rowKeys
6. Replace progress bar in StyleRow with status badge
7. Update style list sections to use specStatus instead of pct
8. Add status badge + dropdown toggle to spec sheet header
"""

import re

with open('client/src/components/dashboard/SpecsTab.tsx', 'r') as f:
    content = f.read()

# ── 1. Add DropdownMenu import ──────────────────────────────────────────────
old_import_popover = 'import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";'
new_import_popover = '''import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";'''

if old_import_popover in content:
    content = content.replace(old_import_popover, new_import_popover)
    print("SUCCESS: DropdownMenu import added")
else:
    print("ERROR: Popover import not found")

# ── 2. Add getAllMeta query + specStatusMap after specCountMap ───────────────
old_counts = '''  // Spec counts for all styles (for sidebar completion dots)
  const { data: specCounts = [] } = trpc.specs.getCounts.useQuery();
  const specCountMap = Object.fromEntries(specCounts.map((r) => [r.style, r.filledCount]));'''

new_counts = '''  // Spec counts for all styles (for sidebar completion dots)
  const { data: specCounts = [] } = trpc.specs.getCounts.useQuery();
  const specCountMap = Object.fromEntries(specCounts.map((r) => [r.style, r.filledCount]));
  // Spec status for all styles (for sidebar status badges)
  const { data: allSpecMeta = [], refetch: refetchAllSpecMeta } = trpc.specs.getAllMeta.useQuery();
  const specStatusMap = Object.fromEntries(
    allSpecMeta.map((m) => [m.style, (m as any).specStatus as "not_started" | "in_progress" | "complete"])
  );'''

if old_counts in content:
    content = content.replace(old_counts, new_counts)
    print("SUCCESS: getAllMeta query + specStatusMap added")
else:
    print("ERROR: specCounts area not found")

# ── 3. Update specMeta to include specStatus ─────────────────────────────────
old_spec_meta = '''  const specMeta = rawMeta
    ? {
        hasBuckle: rawMeta.hasBuckle ?? false,
        dressShoeSubType: rawMeta.dressShoeSubType as "court" | "sling" | null ?? null,
        notes: rawMeta.notes ?? null,
      }
    : null;'''

new_spec_meta = '''  const specMeta = rawMeta
    ? {
        hasBuckle: rawMeta.hasBuckle ?? false,
        dressShoeSubType: rawMeta.dressShoeSubType as "court" | "sling" | null ?? null,
        notes: rawMeta.notes ?? null,
        specStatus: ((rawMeta as any).specStatus ?? "not_started") as "not_started" | "in_progress" | "complete",
      }
    : null;'''

if old_spec_meta in content:
    content = content.replace(old_spec_meta, new_spec_meta)
    print("SUCCESS: specMeta updated with specStatus")
else:
    print("ERROR: specMeta target not found")

# ── 4. Add setStatusMutation + handleSetStatus after resetColourMutation ─────
old_reset_handler = '''  function handleResetColour(colour: string) {
    if (!selectedStyle) return;
    resetColourMutation.mutate({ style: selectedStyle, colour });
  }'''

new_reset_handler = '''  function handleResetColour(colour: string) {
    if (!selectedStyle) return;
    resetColourMutation.mutate({ style: selectedStyle, colour });
  }
  // ─── Spec Status ──────────────────────────────────────────────────────────
  const setStatusMutation = trpc.specs.setStatus.useMutation({
    onSuccess: (_data, { style }) => {
      refetchMeta();
      refetchAllSpecMeta();
    },
    onError: () => toast.error("Failed to update spec status"),
  });
  function handleSetStatus(status: "not_started" | "in_progress" | "complete") {
    if (!selectedStyle) return;
    setStatusMutation.mutate({ style: selectedStyle, status });
  }'''

if old_reset_handler in content:
    content = content.replace(old_reset_handler, new_reset_handler)
    print("SUCCESS: setStatusMutation + handleSetStatus added")
else:
    print("ERROR: handleResetColour target not found")

# ── 5. Update handleUpsert to pass colours + rowKeys ─────────────────────────
old_handle_upsert = '''  function handleUpsert(colour: string, component: string, value: string) {
    if (!selectedStyle) return;
    // No onSuccess refetch needed — optimistic update handles the UI immediately
    upsertMutation.mutate({ style: selectedStyle, colour, component, value });
  }'''

new_handle_upsert = '''  function handleUpsert(colour: string, component: string, value: string) {
    if (!selectedStyle) return;
    // Pass colours + rowKeys so server can auto-check completion status
    const colours = selectedEntry?.colours ?? [];
    const rowKeys = exportRowOrderData?.rowKeys ?? [];
    upsertMutation.mutate(
      { style: selectedStyle, colour, component, value, colours, rowKeys },
      {
        onSettled: () => {
          // Refresh status after save (server may have auto-promoted to complete)
          refetchMeta();
          refetchAllSpecMeta();
        },
      }
    );
  }'''

if old_handle_upsert in content:
    content = content.replace(old_handle_upsert, new_handle_upsert)
    print("SUCCESS: handleUpsert updated with colours + rowKeys")
else:
    print("ERROR: handleUpsert target not found")

# ── 6. Replace progress bar in StyleRow with status badge ────────────────────
old_style_row = '''            function StyleRow({ entry }: { entry: StyleEntry }) {
              const isSelected = selectedStyle === entry.style;
              const pct = getCompletionPct(entry);
              return (
                <button
                  key={entry.style}
                  onClick={() => setSelectedStyle(entry.style)}
                  className={`w-full text-left px-3 py-2.5 border-b transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {(entry.imageUrl || imageOverrides[entry.style]) && (
                      <img src={imageOverrides[entry.style] ?? entry.imageUrl} alt={entry.style} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs truncate">{entry.style}</div>
                      <div className="text-xs text-muted-foreground truncate">{entry.category} · {entry.last}</div>
                      <div className="text-xs text-muted-foreground">{entry.colours.length} colours</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {entry.isAllNew && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title="New pattern" />
                      )}
                      {pct > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct >= 100 ? 'oklch(0.65 0.15 145)' : 'oklch(0.70 0.15 55)' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            }'''

new_style_row = '''            function StyleRow({ entry }: { entry: StyleEntry }) {
              const isSelected = selectedStyle === entry.style;
              const status = specStatusMap[entry.style] ?? "not_started";
              const statusBadge = status === "complete"
                ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex-shrink-0">Done</span>
                : status === "in_progress"
                ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex-shrink-0">In Progress</span>
                : null;
              return (
                <button
                  key={entry.style}
                  onClick={() => setSelectedStyle(entry.style)}
                  className={`w-full text-left px-3 py-2.5 border-b transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {(entry.imageUrl || imageOverrides[entry.style]) && (
                      <img src={imageOverrides[entry.style] ?? entry.imageUrl} alt={entry.style} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs truncate">{entry.style}</div>
                      <div className="text-xs text-muted-foreground truncate">{entry.category} · {entry.last}</div>
                      <div className="text-xs text-muted-foreground">{entry.colours.length} colours</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {entry.isAllNew && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title="New pattern" />
                      )}
                      {statusBadge}
                    </div>
                  </div>
                </button>
              );
            }'''

if old_style_row in content:
    content = content.replace(old_style_row, new_style_row)
    print("SUCCESS: StyleRow updated with status badge")
else:
    print("ERROR: StyleRow target not found")

# ── 7. Update style list sections to use specStatus instead of pct ─────────────
old_sections = '''            const inProgress = filtered.filter((e) => getCompletionPct(e) < 100);
            const completed = filtered.filter((e) => getCompletionPct(e) >= 100);'''

new_sections = '''            const notStarted = filtered.filter((e) => (specStatusMap[e.style] ?? "not_started") === "not_started");
            const inProgress = filtered.filter((e) => (specStatusMap[e.style] ?? "not_started") === "in_progress");
            const completed = filtered.filter((e) => (specStatusMap[e.style] ?? "not_started") === "complete");'''

if old_sections in content:
    content = content.replace(old_sections, new_sections)
    print("SUCCESS: Style list sections updated to use specStatus")
else:
    print("ERROR: Style list sections target not found")

# ── 8. Update the sections rendering to include Not Started ──────────────────
old_sections_render = '''            return (
              <>
                {/* In Progress section */}
                {inProgress.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30 border-b flex items-center justify-between">
                      <span>In Progress</span>
                      <span className="text-muted-foreground font-normal">{inProgress.length}</span>
                    </div>
                    {inProgress.map((entry) => <StyleRow key={entry.style} entry={entry} />)}
                  </>
                )}
                {/* Completed section */}
                {completed.length > 0 && (
                  <>
                    <button
                      className="w-full px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30 border-b flex items-center justify-between hover:bg-muted/50 transition-colors"
                      onClick={() => setCompletedCollapsed((v) => !v)}
                    >
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Completed
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-muted-foreground font-normal">{completed.length}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${completedCollapsed ? "" : "rotate-180"}`} />
                      </span>
                    </button>
                    {!completedCollapsed && completed.map((entry) => <StyleRow key={entry.style} entry={entry} />)}
                  </>
                )}
                {filtered.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">No styles match "{search}"</div>
                )}
              </>
            );'''

new_sections_render = '''            return (
              <>
                {/* In Progress section */}
                {inProgress.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-amber-50 dark:bg-amber-950/20 border-b flex items-center justify-between">
                      <span className="text-amber-700 dark:text-amber-400">In Progress</span>
                      <span className="text-amber-600 dark:text-amber-500 font-normal">{inProgress.length}</span>
                    </div>
                    {inProgress.map((entry) => <StyleRow key={entry.style} entry={entry} />)}
                  </>
                )}
                {/* Not Started section */}
                {notStarted.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30 border-b flex items-center justify-between">
                      <span>Not Started</span>
                      <span className="text-muted-foreground font-normal">{notStarted.length}</span>
                    </div>
                    {notStarted.map((entry) => <StyleRow key={entry.style} entry={entry} />)}
                  </>
                )}
                {/* Completed section */}
                {completed.length > 0 && (
                  <>
                    <button
                      className="w-full px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-green-50 dark:bg-green-950/20 border-b flex items-center justify-between hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors"
                      onClick={() => setCompletedCollapsed((v) => !v)}
                    >
                      <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Complete
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-green-600 dark:text-green-500 font-normal">{completed.length}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform text-green-600 dark:text-green-500 ${completedCollapsed ? "" : "rotate-180"}`} />
                      </span>
                    </button>
                    {!completedCollapsed && completed.map((entry) => <StyleRow key={entry.style} entry={entry} />)}
                  </>
                )}
                {filtered.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">No styles match "{search}"</div>
                )}
              </>
            );'''

if old_sections_render in content:
    content = content.replace(old_sections_render, new_sections_render)
    print("SUCCESS: Style list section rendering updated")
else:
    print("ERROR: Style list section rendering target not found")

# ── 9. Add status badge + dropdown to spec sheet header ──────────────────────
# Insert after the Export button closing div (</div>) and before the import banner
old_header_end = '''            </div>
            {/* Import preview banner */}'''

new_header_end = '''            </div>
            {/* Spec status badge + manual override */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Spec Status:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer hover:opacity-80 ${
                      (specMeta?.specStatus ?? "not_started") === "complete"
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                        : (specMeta?.specStatus ?? "not_started") === "in_progress"
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {(specMeta?.specStatus ?? "not_started") === "complete" && <CheckCircle className="w-3 h-3" />}
                    {(specMeta?.specStatus ?? "not_started") === "complete"
                      ? "Complete"
                      : (specMeta?.specStatus ?? "not_started") === "in_progress"
                      ? "In Progress"
                      : "Not Started"}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem
                    onClick={() => handleSetStatus("not_started")}
                    className="text-xs gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                    Not Started
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSetStatus("in_progress")}
                    className="text-xs gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSetStatus("complete")}
                    className="text-xs gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    Complete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Import preview banner */}'''

if old_header_end in content:
    content = content.replace(old_header_end, new_header_end)
    print("SUCCESS: Status badge + dropdown added to spec sheet header")
else:
    print("ERROR: Header end target not found")
    # Try to find it
    idx = content.find('{/* Import preview banner */}')
    print(repr(content[max(0,idx-200):idx+50]))

with open('client/src/components/dashboard/SpecsTab.tsx', 'w') as f:
    f.write(content)

print(f"\nFinal file length: {len(content.splitlines())} lines")
print("All patches applied!")
