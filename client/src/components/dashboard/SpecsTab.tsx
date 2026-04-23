import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  ChevronDown, ChevronRight, Search, CheckCircle, FileSpreadsheet, Copy, Upload, AlertCircle, Check, ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTemplateForCategory, DEFAULT_DROPDOWN_OPTIONS, SECTION_LABELS,
  type SpecComponent, type ShoeCategory,
} from "@shared/specTemplates";
import { exportSpecSheet } from "@/lib/exportSpecSheet";
import { parseSpecSheetFile, type ParsedSpecSheet } from "@/lib/importSpecSheet";

// ─── Constants ────────────────────────────────────────────────────────────────

const NEW_LASTS = [
  "DAZIE", "SIA", "SALLY", "TIANA", "BILLIE", "MATISSE",
  "EDGY", "EMBER", "TILDA", "LUCY", "ENVY", "FINCH",
  "HARLEY", "JAYDE", "ROXIE", "VIVA", "PIXIE",
];

// ─── Build colour+leather lookup from rawSkus ────────────────────────────────
// Maps style → { colour → "COLOUR LEATHER" } e.g. MOMA → { BLACK: "BLACK NAPPA" }
function buildColourLeatherMap(): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {};
  const rawSkus = (skuData as any).rawSkus ?? [];
  for (const sku of rawSkus) {
    const style = sku.style as string;
    const colour = sku.colour as string;
    const leather = sku.leather as string;
    if (!map[style]) map[style] = {};
    if (!map[style][colour]) {
      map[style][colour] = leather ? `${colour} ${leather}` : colour;
    }
  }
  return map;
}
const COLOUR_LEATHER_MAP = buildColourLeatherMap();

// ─── All colour+leather combos from rawSkus (for upper_1 dropdown) ───────────
function buildAllColourLeatherOptions(): string[] {
  const rawSkus = (skuData as any).rawSkus ?? [];
  const seen = new Set<string>();
  for (const sku of rawSkus) {
    const colour = sku.colour as string;
    const leather = sku.leather as string;
    if (colour && leather) seen.add(`${colour} ${leather}`);
    else if (colour) seen.add(colour);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
const ALL_COLOUR_LEATHER_OPTIONS = buildAllColourLeatherOptions();

// ─── Types ────────────────────────────────────────────────────────────────────

interface StyleEntry {
  style: string;
  last: string;
  category: string;
  imageUrl?: string;
  colours: string[];       // raw colour names e.g. ["BLACK", "PETAL"]
  colourLabels: string[];  // full labels e.g. ["BLACK NAPPA", "PETAL NAPPA"]
  isAllNew: boolean;
  hasNew: boolean;
  totalSKUs: number;
  newSKUs: number;
}

// ─── Build style list: same filter as FittingTab ─────────────────────────────
// Specs required for: new lasts OR all-new patterns (same logic as fitting)

function buildStyleList(): StyleEntry[] {
  return skuData.styles
    .filter((s) => {
      const lastUpper = (s.last ?? "").toUpperCase();
      const isOnNewLast = NEW_LASTS.some((nl) => lastUpper.includes(nl));
      return isOnNewLast || s.isAllNew;
    })
    .map((s) => {
      const rawColours: string[] = (s as any).colours ?? [];
      return {
        style: s.style,
        last: s.last,
        category: s.category,
        imageUrl: (s as any).imageUrl,
        colours: rawColours,
        colourLabels: rawColours.map((c) => COLOUR_LEATHER_MAP[s.style]?.[c] ?? c),
        isAllNew: s.isAllNew,
        hasNew: s.hasNew,
        totalSKUs: s.totalSKUs,
        newSKUs: s.newSKUs,
      };
    })
    .sort((a, b) => a.style.localeCompare(b.style));
}

// ─── Editable Dropdown Cell ───────────────────────────────────────────────────

interface DropdownCellProps {
  component: SpecComponent;
  value: string;
  savedOptions: string[];
  onSave: (val: string) => void;
  onAddOption: (val: string) => void;
  /** If provided, overrides the default option list (used for upper_1) */
  overrideOptions?: string[];
}

function DropdownCell({ component, value, savedOptions, onSave, onAddOption, overrideOptions }: DropdownCellProps) {
  const defaults = overrideOptions ?? DEFAULT_DROPDOWN_OPTIONS[component.key] ?? [];
  // Merge defaults + saved options, deduplicated, sorted alphabetically
  const allOptions = Array.from(new Set([...defaults, ...savedOptions]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Filtered options based on search query
  const filtered = query
    ? allOptions.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : allOptions;

  function handleSelect(val: string) {
    onSave(val);
    setOpen(false);
    setQuery("");
  }

  function handleAddNew() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onAddOption(trimmed);
    onSave(trimmed);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          className="h-8 px-2 flex items-center justify-between gap-1 text-xs rounded border border-input bg-background hover:bg-accent hover:text-accent-foreground min-w-[160px] w-full text-left"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value || "— select —"}
          </span>
          <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type new…"
            value={query}
            onValueChange={setQuery}
            className="text-xs h-8"
          />
          <CommandList className="max-h-52">
            {filtered.length === 0 && query.trim() === "" && (
              <CommandEmpty className="text-xs py-3">No options.</CommandEmpty>
            )}
            {filtered.length === 0 && query.trim() !== "" && (
              <div className="px-2 py-1.5">
                <button
                  className="w-full text-left text-xs text-blue-600 font-medium px-2 py-1.5 rounded hover:bg-accent"
                  onMouseDown={(e) => { e.preventDefault(); handleAddNew(); }}
                >
                  + Add "{query.trim()}" as new option
                </button>
              </div>
            )}
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => handleSelect(opt)}
                  className="text-xs"
                >
                  <Check className={`w-3 h-3 mr-1 shrink-0 ${value === opt ? "opacity-100" : "opacity-0"}`} />
                  {opt}
                </CommandItem>
              ))}
              {/* Show "Add new" at bottom when query has no exact match */}
              {query.trim() !== "" && !filtered.some((o) => o.toLowerCase() === query.trim().toLowerCase()) && (
                <CommandItem
                  value={`__add__${query}`}
                  onSelect={handleAddNew}
                  className="text-xs text-blue-600 font-medium"
                >
                  + Add "{query.trim()}" as new option
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Text Cell ────────────────────────────────────────────────────────────────

interface TextCellProps {
  value: string;
  onSave: (val: string) => void;
}

function TextCell({ value, onSave }: TextCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="h-8 text-xs min-w-[140px]"
        autoFocus
      />
    );
  }

  return (
    <div
      className="h-8 px-2 flex items-center text-xs rounded border border-transparent hover:border-border cursor-text min-w-[140px] text-foreground"
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 10); }}
    >
      {value || <span className="text-muted-foreground">— type —</span>}
    </div>
  );
}

// ─── Colour Copy Panel ───────────────────────────────────────────────────────

interface ColourCopyPanelProps {
  colours: string[];       // raw colour keys (used for copy logic)
  colourLabels: string[];  // full display labels e.g. "BLACK NAPPA"
  onCopy: (source: string, targets: string[]) => void;
}

function ColourCopyPanel({ colours, colourLabels, onCopy }: ColourCopyPanelProps) {
  const [source, setSource] = useState<string | null>(null);
  const [targets, setTargets] = useState<Set<string>>(new Set());

  // Build a map from raw colour → display label for quick lookup
  const labelMap = Object.fromEntries(colours.map((c, i) => [c, colourLabels[i] ?? c]));

  function toggleTarget(colour: string) {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(colour)) next.delete(colour); else next.add(colour);
      return next;
    });
  }

  function handleCopy() {
    if (!source || targets.size === 0) return;
    onCopy(source, Array.from(targets));
    setSource(null);
    setTargets(new Set());
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/20 rounded-lg border text-xs">
      <span className="text-muted-foreground font-medium whitespace-nowrap">Copy specs from:</span>
      <Select value={source ?? ""} onValueChange={(v) => { setSource(v); setTargets(new Set()); }}>
        <SelectTrigger className="h-7 w-48 text-xs">
          <SelectValue placeholder="Select colour…" />
        </SelectTrigger>
        <SelectContent>
          {colours.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">{labelMap[c]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {source && (
        <>
          <span className="text-muted-foreground">to:</span>
          {colours.filter((c) => c !== source).map((c) => (
            <button
              key={c}
              onClick={() => toggleTarget(c)}
              className={`px-2 py-1 rounded border text-xs transition-colors ${
                targets.has(c)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {labelMap[c]}
            </button>
          ))}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={targets.size === 0}
            onClick={handleCopy}
          >
            <Copy className="w-3 h-3" />
            Copy
          </Button>
          <button
            onClick={() => { setSource(null); setTargets(new Set()); }}
            className="text-muted-foreground hover:text-foreground text-sm leading-none"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

// ─── Spec Form for a single style ─────────────────────────────────────────────

interface SpecFormProps {
  entry: StyleEntry;
  specMeta: { hasBuckle: boolean; dressShoeSubType: "court" | "sling" | null; notes: string | null } | null;
  specs: Record<string, Record<string, string>>; // colour → component → value
  allDropdownOptions: Record<string, string[]>;
  imageOverride?: string;
  onUpsert: (colour: string, component: string, value: string) => void;
  onAddDropdownOption: (component: string, value: string) => void;
  onMetaChange: (meta: Partial<{ hasBuckle: boolean; dressShoeSubType: "court" | "sling" | null; notes: string | null }>) => void;
}

function SpecForm({
  entry, specMeta, specs, allDropdownOptions, imageOverride, onUpsert, onAddDropdownOption, onMetaChange,
}: SpecFormProps) {
  const hasBuckle = specMeta?.hasBuckle ?? false;
  const dressShoeSubType = specMeta?.dressShoeSubType ?? null;
  const notes = specMeta?.notes ?? "";
  const isDressShoe = entry.category === "Dress Shoe";

  const template = getTemplateForCategory(entry.category, {
    hasBuckle,
    dressShoeSubType: isDressShoe ? dressShoeSubType : null,
  });

  // Group components by section
  const sections = template.reduce<Record<string, SpecComponent[]>>((acc, comp) => {
    if (!acc[comp.section]) acc[comp.section] = [];
    acc[comp.section].push(comp);
    return acc;
  }, {});

  function handleCopyFrom(sourceColour: string, targetColours: string[]) {
    const sourceValues = specs[sourceColour] ?? {};
    for (const colour of targetColours) {
      for (const comp of template) {
        const val = sourceValues[comp.key];
        if (val) onUpsert(colour, comp.key, val);
      }
    }
    toast.success(`Copied specs from ${sourceColour} to ${targetColours.length} colour(s)`);
  }

  // Auto-fill upper_1 with the colour+leather label for each colour that has no saved value
  const autoFillDoneRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    entry.colours.forEach((colour, colIdx) => {
      const key = `${entry.style}:${colour}`;
      if (autoFillDoneRef.current.has(key)) return;
      const existing = specs[colour]?.["upper_1"];
      if (!existing) {
        const label = entry.colourLabels[colIdx] ?? colour;
        autoFillDoneRef.current.add(key);
        onUpsert(colour, "upper_1", label);
      } else {
        autoFillDoneRef.current.add(key);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.style, entry.colours.join(",")]);

  // Count filled cells
  const totalCells = template.length * entry.colours.length;
  const filledCells = entry.colours.reduce((sum, colour) => {
    return sum + template.filter((c) => !!(specs[colour]?.[c.key])).length;
  }, 0);
  const pct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Style header */}
      <div className="flex items-start gap-4 pb-4 border-b">
        {(imageOverride || entry.imageUrl) && (
          <img src={imageOverride ?? entry.imageUrl} alt={entry.style} className="w-16 h-16 object-cover rounded-lg border" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{entry.style}</h2>
            <Badge variant="outline" className="text-xs">{entry.category}</Badge>
            <Badge variant="outline" className="text-xs">{entry.last}</Badge>
            {entry.isAllNew && <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">New Pattern</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">{entry.colours.length} colours · {entry.totalSKUs} SKUs</span>
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{pct}% complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Style-level settings */}
      <div className="flex flex-wrap gap-6 items-start p-3 bg-muted/30 rounded-lg border">
        {/* Buckle toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="buckle-toggle"
            checked={hasBuckle}
            onCheckedChange={(v) => onMetaChange({ hasBuckle: v })}
          />
          <Label htmlFor="buckle-toggle" className="text-sm font-medium cursor-pointer">Has Buckle</Label>
        </div>

        {/* Dress shoe sub-type */}
        {isDressShoe && (
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Sub-type:</Label>
            <Select
              value={dressShoeSubType ?? "none"}
              onValueChange={(v) => onMetaChange({ dressShoeSubType: v === "none" ? null : v as "court" | "sling" })}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">— not set —</SelectItem>
                <SelectItem value="court" className="text-xs">Court (full)</SelectItem>
                <SelectItem value="sling" className="text-xs">Sling Back</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notes */}
        <div className="flex-1 min-w-[200px]">
          <Label className="text-sm font-medium block mb-1">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => onMetaChange({ notes: e.target.value })}
            placeholder="Free-text notes for this style…"
            className="text-xs min-h-[60px] resize-none"
          />
        </div>
      </div>

      {/* Selective colour-to-colour copy */}
      {entry.colours.length > 1 && (
        <ColourCopyPanel
          colours={entry.colours}
          colourLabels={entry.colourLabels}
          onCopy={handleCopyFrom}
        />
      )}

      {/* Spec grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40 border-b">Colour</th>
              {entry.colours.map((colour, i) => (
                <th key={colour} className="text-left px-3 py-2 font-medium border-b min-w-[160px]">
                  {entry.colourLabels[i] ?? colour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(sections).map(([sectionKey, components]) => (
              <React.Fragment key={sectionKey}>
                <tr className="bg-muted/20">
                  <td
                    colSpan={entry.colours.length + 1}
                    className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b"
                  >
                    {SECTION_LABELS[sectionKey] ?? sectionKey}
                  </td>
                </tr>
                {components.map((comp) => (
                  <tr key={comp.key} className="border-b hover:bg-muted/10">
                    <td className="px-3 py-1.5 font-medium text-muted-foreground align-middle">{comp.label}</td>
                    {entry.colours.map((colour, colIdx) => {
                      const val = specs[colour]?.[comp.key] ?? "";
                      const savedOpts = allDropdownOptions[comp.key] ?? [];

                      // Upper 1: use all real colour+leather combos as options;
                      // show the colour+leather label as the effective value when not yet saved
                      const isUpper1 = comp.key === "upper_1";
                      const upper1AutoValue = entry.colourLabels[colIdx] ?? colour;
                      const upper1EffectiveVal = isUpper1 && !val ? upper1AutoValue : val;

                      return (
                        <td key={colour} className="px-2 py-1 align-middle">
                          {comp.type === "dropdown" ? (
                            <DropdownCell
                              component={comp}
                              value={upper1EffectiveVal}
                              savedOptions={savedOpts}
                              onSave={(v) => onUpsert(colour, comp.key, v)}
                              onAddOption={(v) => onAddDropdownOption(comp.key, v)}
                              overrideOptions={isUpper1 ? ALL_COLOUR_LEATHER_OPTIONS : undefined}
                            />
                          ) : (
                            <TextCell
                              value={val}
                              onSave={(v) => onUpsert(colour, comp.key, v)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main SpecsTab ────────────────────────────────────────────────────────────

interface SpecsTabProps {}

export default function SpecsTab({}: SpecsTabProps) {
  const baseStyleList = buildStyleList();
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [importParsed, setImportParsed] = useState<ParsedSpecSheet | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const importFileRef = React.useRef<HTMLInputElement>(null);

  // ── Cancelled styles + cancelled SKUs + custom SKUs ─────────────────────
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery();
  const cancelledSet = useMemo(
    () => new Set((cancelledStylesRaw as any[]).map((r: any) => r.style as string)),
    [cancelledStylesRaw]
  );

  // Individually cancelled SKUs (style|colour|leather)
  const { data: cancelledSkusRaw = [] } = trpc.cancelledSku.list.useQuery();
  const cancelledSkuSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of cancelledSkusRaw as any[]) {
      set.add(`${row.style}|${row.colour}|${row.leather}`);
    }
    return set;
  }, [cancelledSkusRaw]);

  const { data: customSkusRaw = [] } = trpc.customSku.getAll.useQuery();
  // Build a map: style → Set<colour> for custom SKUs
  const customColourMap = useMemo(() => {
    const map: Record<string, Array<{ colour: string; leather: string }>> = {};
    for (const sku of customSkusRaw as any[]) {
      if (!map[sku.style]) map[sku.style] = [];
      map[sku.style].push({ colour: sku.colour, leather: sku.leather });
    }
    return map;
  }, [customSkusRaw]);

  // Merge custom SKU colours into style entries, filter cancelled styles + cancelled SKUs
  const styleList = useMemo(() => {
    return baseStyleList
      .filter((s) => !cancelledSet.has(s.style))
      .map((s) => {
        // Filter out individually cancelled colours
        const filteredColours: string[] = [];
        const filteredLabels: string[] = [];
        for (let i = 0; i < s.colours.length; i++) {
          const colour = s.colours[i];
          // Look up the leather for this colour from the raw SKU map
          const leather = COLOUR_LEATHER_MAP[s.style]?.[colour]
            ? COLOUR_LEATHER_MAP[s.style][colour].replace(colour, "").trim()
            : "";
          const key = `${s.style}|${colour}|${leather}`;
          if (!cancelledSkuSet.has(key)) {
            filteredColours.push(colour);
            filteredLabels.push(s.colourLabels[i]);
          }
        }

        // Add custom SKU colours (also check they're not cancelled)
        const extras = customColourMap[s.style] ?? [];
        const existingColours = new Set(filteredColours);
        const newColours = extras.filter((e) => {
          if (existingColours.has(e.colour)) return false;
          const key = `${s.style}|${e.colour}|${e.leather ?? ""}`;
          return !cancelledSkuSet.has(key);
        });
        const addedColours = newColours.map((e) => e.colour);
        const addedLabels = newColours.map((e) => e.leather ? `${e.colour} ${e.leather}` : e.colour);

        return {
          ...s,
          colours: [...filteredColours, ...addedColours],
          colourLabels: [...filteredLabels, ...addedLabels],
        };
      })
      // Remove styles that end up with no colours after filtering
      .filter((s) => s.colours.length > 0);
  }, [baseStyleList, cancelledSet, cancelledSkuSet, customColourMap]);

  const filtered = styleList.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.style.toLowerCase().includes(q) || s.last.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  const selectedEntry = styleList.find((s) => s.style === selectedStyle) ?? null;

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: rawSpecs = [], refetch: refetchSpecs } = trpc.specs.getForStyle.useQuery(
    { style: selectedStyle! },
    { enabled: !!selectedStyle }
  );

  const { data: rawMeta, refetch: refetchMeta } = trpc.specs.getMeta.useQuery(
    { style: selectedStyle! },
    { enabled: !!selectedStyle }
  );

  const { data: rawDropdownOptions = [], refetch: refetchDropdowns } = trpc.specs.getAllDropdownOptions.useQuery();

  // Spec counts for all styles (for sidebar completion dots)
  const { data: specCounts = [] } = trpc.specs.getCounts.useQuery();
  const specCountMap = Object.fromEntries(specCounts.map((r) => [r.style, r.filledCount]));

  // ── Derived data ──────────────────────────────────────────────────────────
  // specs: colour → component → value
  const specs: Record<string, Record<string, string>> = {};
  for (const row of rawSpecs) {
    if (!specs[row.colour]) specs[row.colour] = {};
    specs[row.colour][row.component] = row.value ?? "";
  }

  // allDropdownOptions: component → string[]
  const allDropdownOptions: Record<string, string[]> = {};
  for (const opt of rawDropdownOptions) {
    if (!allDropdownOptions[opt.component]) allDropdownOptions[opt.component] = [];
    allDropdownOptions[opt.component].push(opt.value);
  }

  const specMeta = rawMeta
    ? {
        hasBuckle: rawMeta.hasBuckle ?? false,
        dressShoeSubType: rawMeta.dressShoeSubType as "court" | "sling" | null ?? null,
        notes: rawMeta.notes ?? null,
      }
    : null;

  // Style image overrides
  const { data: imageOverrideList = [], refetch: refetchImageOverrides } = trpc.styleImage.getAll.useQuery();
  const imageOverrides = imageOverrideList.reduce<Record<string, string>>((acc, o) => { acc[o.style] = o.imageUrl; return acc; }, {});
  const imageUploadRef = React.useRef<HTMLInputElement>(null);
  const uploadImageMutation = trpc.styleImage.upload.useMutation({
    onSuccess: () => { refetchImageOverrides(); toast.success("Image updated"); },
    onError: () => toast.error("Image upload failed"),
  });
  const revertImageMutation = trpc.styleImage.revert.useMutation({
    onSuccess: () => { refetchImageOverrides(); toast.success("Reverted to original image"); },
  });
  function handleImageUpload(file: File) {
    if (!selectedStyle) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      uploadImageMutation.mutate({ style: selectedStyle, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const upsertMutation = trpc.specs.upsert.useMutation({
    onError: () => toast.error("Failed to save spec value"),
  });

  const addDropdownMutation = trpc.specs.addDropdownOption.useMutation({
    onSuccess: () => refetchDropdowns(),
    onError: () => toast.error("Failed to add dropdown option"),
  });

  const upsertMetaMutation = trpc.specs.upsertMeta.useMutation({
    onSuccess: () => refetchMeta(),
    onError: () => toast.error("Failed to save style settings"),
  });

  // Debounced notes save
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleUpsert(colour: string, component: string, value: string) {
    if (!selectedStyle) return;
    upsertMutation.mutate(
      { style: selectedStyle, colour, component, value },
      { onSuccess: () => refetchSpecs() }
    );
  }

  function handleAddDropdownOption(component: string, value: string) {
    addDropdownMutation.mutate({ component, value });
  }

  function handleMetaChange(patch: Partial<{ hasBuckle: boolean; dressShoeSubType: "court" | "sling" | null; notes: string | null }>) {
    if (!selectedStyle) return;
    if ("notes" in patch) {
      // Debounce notes saves
      if (notesTimer.current) clearTimeout(notesTimer.current);
      notesTimer.current = setTimeout(() => {
        upsertMetaMutation.mutate({ style: selectedStyle, ...patch });
      }, 800);
    } else {
      upsertMetaMutation.mutate({ style: selectedStyle, ...patch });
    }
  }

  // ── Import handler ────────────────────────────────────────────────────────
  async function handleImportFile(file: File) {
    setImportLoading(true);
    setImportParsed(null);
    try {
      const parsed = await parseSpecSheetFile(file);
      setImportParsed(parsed);
      // Auto-select the style if it matches one in the list
      const match = styleList.find(
        (s) => s.style.toLowerCase() === parsed.styleName.toLowerCase()
      );
      if (match) setSelectedStyle(match.style);
    } catch (e: unknown) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImportLoading(false);
    }
  }

  async function handleSaveImport() {
    if (!importParsed || !selectedStyle) return;
    setImportSaving(true);
    let count = 0;
    try {
      // Build a reverse map: full label (e.g. "DOVE NAPPA") → raw colour key (e.g. "DOVE")
      // so that imported colour names from the factory spec sheet are saved under the correct key.
      const styleColourMap = COLOUR_LEATHER_MAP[selectedStyle] ?? {};
      const labelToRawColour: Record<string, string> = {};
      for (const [rawColour, label] of Object.entries(styleColourMap)) {
        labelToRawColour[label.toUpperCase()] = rawColour;
        // Also map the raw colour itself (in case the factory sheet uses just the colour name)
        labelToRawColour[rawColour.toUpperCase()] = rawColour;
      }

      for (const [importedColour, compMap] of Object.entries(importParsed.colourSpecs)) {
        // Resolve the raw colour key: try exact label match first, then fall back to the imported name
        const rawColour = labelToRawColour[importedColour.toUpperCase()] ?? importedColour;
        for (const [component, value] of Object.entries(compMap)) {
          if (!value.trim()) continue;
          await upsertMutation.mutateAsync({ style: selectedStyle, colour: rawColour, component, value });
          count++;
        }
      }
      await refetchSpecs();
      toast.success(`Imported ${count} spec values for ${selectedStyle}`);
      setImportParsed(null);
    } catch {
      toast.error("Failed to save imported specs");
    } finally {
      setImportSaving(false);
    }
  }

  // Completion stats — uses live rawSpecs for selected style, DB counts for others
  function getCompletionPct(entry: StyleEntry): number {
    const template = getTemplateForCategory(entry.category, {
      hasBuckle: false,
      dressShoeSubType: null,
    });
    const total = template.length * entry.colours.length;
    if (total === 0) return 0;
    const filled = entry.style === selectedStyle
      ? rawSpecs.filter((r) => r.value && r.value.trim()).length
      : (specCountMap[entry.style] ?? 0);
    return Math.min(100, Math.round((filled / total) * 100));
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: style list */}
      <div className="w-64 flex-shrink-0 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search styles…"
              className="pl-8 h-8 text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {filtered.length} of {styleList.length} styles
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const inProgress = filtered.filter((e) => getCompletionPct(e) < 100);
            const completed = filtered.filter((e) => getCompletionPct(e) >= 100);

            function StyleRow({ entry }: { entry: StyleEntry }) {
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
            }

            return (
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
            );
          })()}
        </div>
      </div>

      {/* Right: spec form */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedEntry ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">Select a style to view its spec sheet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {styleList.length} styles require specs this season
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Import/Export buttons */}
            <div className="flex justify-between items-center gap-2">
              {/* Image upload + Import buttons */}
              <div className="flex items-center gap-2">
                <input
                  ref={imageUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => imageUploadRef.current?.click()}
                  disabled={uploadImageMutation.isPending}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadImageMutation.isPending ? "Uploading…" : "Update Image"}
                </Button>
                {imageOverrides[selectedEntry.style] && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                    onClick={() => revertImageMutation.mutate({ style: selectedEntry.style })}
                  >
                    Revert
                  </Button>
                )}
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={importLoading}
                  onClick={() => importFileRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {importLoading ? "Parsing…" : "Import from Excel"}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    exportSpecSheet({
                      style: selectedEntry.style,
                      last: selectedEntry.last,
                      category: selectedEntry.category,
                      colours: selectedEntry.colours,
                      colourLabels: selectedEntry.colourLabels,
                      specs,
                      hasBuckle: specMeta?.hasBuckle ?? false,
                      dressShoeSubType: specMeta?.dressShoeSubType ?? null,
                      imageUrl: imageOverrides[selectedEntry.style] ?? selectedEntry.imageUrl,
                    });
                    toast.success(`Exported ${selectedEntry.style} spec sheet`);
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export to Excel
                </Button>
              </div>
            </div>
            {/* Import preview banner */}
            {importParsed && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      Ready to import: {importParsed.styleName}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      {Object.keys(importParsed.colourSpecs).length} colours detected
                      {importParsed.unmatchedComponents.length > 0 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          · {importParsed.unmatchedComponents.length} unrecognised fields skipped
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.keys(importParsed.colourSpecs).map((c) => (
                        <span key={c} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5">{c}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setImportParsed(null)} className="text-blue-400 hover:text-blue-600 text-lg leading-none">×</button>
                </div>
                {importParsed.unmatchedComponents.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Skipped: {importParsed.unmatchedComponents.join(", ")}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" disabled={importSaving} onClick={handleSaveImport} className="gap-1.5">
                    {importSaving ? "Saving…" : "Save to dashboard"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setImportParsed(null)}>Cancel</Button>
                </div>
              </div>
            )}

            <SpecForm
              entry={selectedEntry}
              specMeta={specMeta}
              specs={specs}
              allDropdownOptions={allDropdownOptions}
              imageOverride={imageOverrides[selectedEntry.style]}
              onUpsert={handleUpsert}
              onAddDropdownOption={handleAddDropdownOption}
              onMetaChange={handleMetaChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
