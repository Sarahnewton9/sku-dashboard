import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { displayColourLeather } from "@/lib/utils";
import { buildEditableCustomSkuColumns } from "@shared/specSkuColumns";
import { buildSpecColourKeyLookup, getSpecSkuIdentity, normalizeSpecColourPart } from "@shared/specColourKey";
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
  ChevronDown, ChevronRight, Search, FileSpreadsheet, Mail, Copy, Upload, AlertCircle, Check, ChevronsUpDown, Plus, Trash2, X, ArrowRight, RefreshCw, GripVertical, RotateCcw, Pencil,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  getTemplateForCategory, DEFAULT_DROPDOWN_OPTIONS, SECTION_LABELS,
  type SpecComponent, type ShoeCategory,
} from "@shared/specTemplates";
import { buildSpecSheetAttachment, exportSpecSheet } from "@/lib/exportSpecSheet";
import { EmailSpecDialog } from "@/components/dashboard/EmailSpecDialog";
import { parseSpecSheetFile, type ParsedSpecSheet } from "@/lib/importSpecSheet";
import { useSeason } from "@/contexts/SeasonContext";
import { findSpecColourMapValue, normalizeStoredSpecColourKey } from "@shared/specColourKey";
import { excludeCancelledSpecStyles, selectSpecColourColumns } from "@shared/specsStyleVisibility";
import { getSeasonDisplayLabel } from "@shared/seasonLabel";
import { buildNewSpecColourColumns } from "@shared/specSeasonalColumns";
import { isNewSpecStyleAwaitingCompletion, type SpecCompletionStatus } from "@shared/specCompletionQueue";
import { matchesSpecsStyleSearchFilters } from "@shared/specsStyleSearch";
import { enqueueSpecRowSave, getCustomSpecRowAliases, getOrderedSpecRowKeys, groupSpecCustomRows, hideSpecRow, mergeSpecRowOrder, normalizeSpecRowLayout, replaceSpecRowKey, restoreSpecRow } from "@shared/specRowLayout";
import { getLatestSpecExportLayout, type RegisteredSpecRowLayout } from "@shared/specExportLayout";
import { buildSavedSpecCopySnapshot } from "@shared/specCopySnapshot";
import { createSpecCustomRowIdentityTracker } from "@shared/specCustomRowDrafts";
import { SpecCustomValueCell as CustomFreeTypeCell, SpecCustomTitleInput as CustomRowTitleInput } from "./SpecCustomEditors";
import {
  planSavedSpecReplacement,
  type CrossStyleCustomRowCopy,
} from "@shared/specCrossStyleCopy";

// ─── Constants ───────────────────────────────────────────────────────────────

// SS26 new lasts (kept for reference; season-aware version uses getNewLastsForSeason)
const NEW_LASTS = [
  "DAZIE", "SIA", "SALLY", "TIANA", "BILLIE", "MATISSE",
  "EDGY", "EMBER", "TILDA", "LUCY", "ENVY", "FINCH",
  "HARLEY", "JAYDE", "ROXIE", "VIVA", "PIXIE",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface StyleEntry {
  style: string;
  last: string;
  category: string;
  imageUrl?: string;
  colours: string[];       // raw colour names e.g. ["BLACK", "PETAL"]
  colourLabels: string[];  // full labels e.g. ["BLACK NAPPA", "PETAL NAPPA"]
  toeCapsPerColour: Record<string, string>; // colour key → toe cap leather e.g. {"BLACK": "BLACK PATENT"}
  isAllNew: boolean;
  hasNew: boolean;
  totalSKUs: number;
  newSKUs: number;
  _isCustomStyle?: boolean;
}



// ─── Free-Type Cell with optional suggestions ─────────────────────────────────
// A plain text input that shows a suggestions dropdown when focused.
// Replaces the old DropdownCell — all component cells are now free-type.

interface FreeTypeCellProps {
  component: SpecComponent;
  value: string;
  savedOptions: string[];
  savedOptionIds?: Record<string, number>; // value -> id mapping for edit
  onSave: (val: string) => void;
  onAddOption: (val: string) => void;
  onDeleteOption?: (val: string) => void;
  onEditOption?: (id: number, newValue: string) => void;
  /** If provided, overrides the default option list (used for upper_1) */
  overrideOptions?: string[];
  /** Used for Tab navigation: "rowId:colIdx" e.g. "upper_1:0" */
  cellId?: string;
}

function FreeTypeCell({ component, value, savedOptions, savedOptionIds, onSave, onAddOption, onDeleteOption, onEditOption, overrideOptions, cellId }: FreeTypeCellProps) {
  const defaults = overrideOptions ?? DEFAULT_DROPDOWN_OPTIONS[component.key] ?? [];
  const allOptions = Array.from(new Set([...defaults, ...savedOptions]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const [draft, setDraft] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingOpt, setEditingOpt] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Prevent double-commit: when a suggestion is clicked, handleSelect commits immediately;
  // the subsequent blur must not commit again with the stale draft.
  const committedRef = useRef(false);

  useEffect(() => { setDraft(value); }, [value]);

  // Auto-resize textarea height to fit content
  useEffect(() => {
    const el = inputRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [draft]);

  const filtered = draft.trim()
    ? allOptions.filter((o) => o.toLowerCase().includes(draft.toLowerCase()))
    : allOptions;

  // Keep dropdown open when draft is a new value not in options (so Save-as-suggestion always shows)
  const isNewValue = draft.trim() !== "" && !allOptions.some((o) => o.toLowerCase() === draft.trim().toLowerCase());

  function commit(val: string) {
    const trimmed = val.trim();
    onSave(trimmed);
    setDraft(trimmed);
    setShowSuggestions(false);
  }

  function handleSelect(opt: string) {
    committedRef.current = true;
    commit(opt);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && !e.shiftKey && cellId) {
      // Move focus to the next row's cell in the same column
      const [, colPart] = cellId.split(":");
      const colIdx = parseInt(colPart ?? "0", 10);
      const allCells = Array.from(
        document.querySelectorAll<HTMLTextAreaElement>(`[data-spec-cell]`)
      ).filter((el) => {
        const parts = el.getAttribute("data-spec-cell")?.split(":") ?? [];
        return parseInt(parts[1] ?? "0", 10) === colIdx;
      });
      const currentIdx = allCells.indexOf(inputRef.current!);
      const nextCell = allCells[currentIdx + 1];
      if (nextCell) {
        e.preventDefault();
        committedRef.current = true;
        commit(draft);
        nextCell.focus();
        return;
      }
    }
    if (e.key === "Enter" && e.ctrlKey && isNewValue) {
      e.preventDefault();
      onAddOption(draft.trim());
      committedRef.current = true;
      commit(draft.trim());
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); committedRef.current = true; commit(draft); inputRef.current?.blur(); }
    if (e.key === "Escape") { setDraft(value); setShowSuggestions(false); inputRef.current?.blur(); }
  }

  function handleBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    // Delay so clicks on suggestions register first
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        if (!committedRef.current) {
          commit(draft);
        }
        committedRef.current = false;
        setShowSuggestions(false);
      }
    }, 150);
  }

  return (
    <div ref={containerRef} className="relative min-w-[140px] w-full">
      <textarea
        ref={inputRef}
        value={draft}
        rows={1}
        data-spec-cell={cellId}
        onChange={(e) => { setDraft(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="— type —"
        className="w-full px-2 py-1.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground resize-none overflow-hidden min-h-[32px]"
        style={{ lineHeight: "1.4" }}
      />
      {showSuggestions && (filtered.length > 0 || isNewValue) && (
        <div className="absolute z-50 top-full left-0 mt-0.5 w-64 max-h-52 overflow-y-auto bg-popover border border-border rounded shadow-md">
          {filtered.map((opt) => {
            const isSaved = savedOptions.includes(opt);
            const optId = savedOptionIds?.[opt];
            if (editingOpt === opt) {
              return (
                <div key={opt} className="flex items-center gap-1 px-2 py-1" onMouseDown={(e) => e.preventDefault()}>
                  <input
                    autoFocus
                    className="flex-1 text-xs border border-input rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editDraft.trim() && optId !== undefined) {
                        onEditOption?.(optId, editDraft.trim());
                        setEditingOpt(null);
                      }
                      if (e.key === "Escape") setEditingOpt(null);
                    }}
                  />
                  <button
                    className="p-0.5 rounded text-xs text-green-600 hover:bg-green-50 flex-shrink-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (editDraft.trim() && optId !== undefined) {
                        onEditOption?.(optId, editDraft.trim());
                      }
                      setEditingOpt(null);
                    }}
                    title="Save"
                  ><Check className="w-3 h-3" /></button>
                  <button
                    className="p-0.5 rounded text-xs text-muted-foreground hover:bg-accent flex-shrink-0"
                    onMouseDown={(e) => { e.preventDefault(); setEditingOpt(null); }}
                    title="Cancel"
                  ><X className="w-3 h-3" /></button>
                </div>
              );
            }
            return (
              <div
                key={opt}
                className="flex items-center justify-between px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer group/opt"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
              >
                <span className="flex-1 break-words whitespace-pre-wrap">{opt}</span>
                {isSaved && (
                  <span className="flex items-center gap-0.5 opacity-0 group-hover/opt:opacity-100 flex-shrink-0">
                    {onEditOption && optId !== undefined && (
                      <button
                        className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditingOpt(opt); setEditDraft(opt); }}
                        title="Edit suggestion"
                      ><Pencil className="w-2.5 h-2.5" /></button>
                    )}
                    {onDeleteOption && (
                      <button
                        className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteOption(opt); }}
                        title="Remove suggestion"
                      ><X className="w-2.5 h-2.5" /></button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
          {/* Save as suggestion if typed value is new */}
          {draft.trim() && !allOptions.some((o) => o.toLowerCase() === draft.trim().toLowerCase()) && (
            <div
              className="px-2 py-1.5 text-xs text-blue-600 font-medium hover:bg-accent cursor-pointer border-t border-border"
              onMouseDown={(e) => { e.preventDefault(); onAddOption(draft.trim()); commit(draft.trim()); }}
            >
              + Save "{draft.trim()}" as suggestion
            </div>
          )}
        </div>
      )}
    </div>
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

// ─── Specs Comments Editor ────────────────────────────────────────────────────
// Comments must remain immediately responsive even though the complete Specs
// form is large. Keep keystrokes in this small local component and save only
// after a short pause (or immediately when focus leaves the field).
interface SpecCommentsEditorProps {
  value: string;
  onSave: (value: string) => void;
}

function SpecCommentsEditor({ value, onSave }: SpecCommentsEditorProps) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const lastSentRef = useRef(value);
  const onSaveRef = useRef(onSave);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Accept an external change (for example, an import) without replacing an
  // optimistic local draft that is waiting for its own save response.
  useEffect(() => {
    if (value === lastSentRef.current) return;
    lastSentRef.current = value;
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const nextValue = draftRef.current;
    if (nextValue === lastSentRef.current) return;
    lastSentRef.current = nextValue;
    onSaveRef.current(nextValue);
  }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 500);
  }, [flush]);

  // A style change unmounts this keyed editor. Flush its latest local draft so
  // comments cannot be lost when moving directly to another style.
  useEffect(() => () => flush(), [flush]);

  return (
    <Textarea
      value={draft}
      onChange={(e) => {
        const nextValue = e.target.value;
        draftRef.current = nextValue;
        setDraft(nextValue);
        scheduleSave();
      }}
      onBlur={flush}
      placeholder="Add factory-facing comments for this style…"
      className="text-xs min-h-[60px] resize-none bg-background"
    />
  );
}

// ─── Unified Template Row (sortable template row) ────────────────────────────────────────────
interface UnifiedTemplateRowProps {
  id: string;
  comp: SpecComponent;
  colours: string[];
  colourLabels: string[];
  specs: Record<string, Record<string, string>>;
  allDropdownOptions: Record<string, string[]>;
  allDropdownOptionIds?: Record<string, Record<string, number>>;
  allColourLeatherOptions: string[];
  onUpsert: (colour: string, key: string, value: string) => void;
  onAddDropdownOption: (key: string, value: string) => void;
  onDeleteDropdownOption: (key: string, value: string) => void;
  onEditDropdownOption?: (id: number, newValue: string) => void;
  isActive?: boolean;
  onDelete: (id: string) => void;
}
function UnifiedTemplateRow({
  id, comp, colours, colourLabels, specs, allDropdownOptions, allDropdownOptionIds, allColourLeatherOptions,
  onUpsert, onAddDropdownOption, onDeleteDropdownOption, onEditDropdownOption, isActive, onDelete,
}: UnifiedTemplateRowProps) {
  const isPinned = comp.key === "upper_1";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id,
    disabled: isPinned,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.15 : 1,
  };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b group ${
        isOver && !isDragging ? "ring-2 ring-amber-400 ring-inset" : ""
      } ${
        isDragging ? "bg-amber-50/20" : "hover:bg-muted/10"
      }`}
    >
      <td className="px-1 py-1.5 font-medium text-muted-foreground align-middle">
        <div className="flex items-center gap-1">
          {isPinned ? (
            // Upper 1 is always pinned at the top — no drag handle or delete button
            <span className="w-4 flex-shrink-0" />
          ) : (
            <button
              {...attributes}
              {...listeners}
              className="p-0.5 text-muted-foreground/30 hover:text-amber-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Drag to reorder"
              tabIndex={-1}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-xs">{comp.label}</span>
          {!isPinned && (
            <button
              onClick={() => onDelete(id)}
              className="ml-auto p-0.5 text-muted-foreground/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="Hide row"
              tabIndex={-1}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
      {colours.map((colour, colIdx) => {
        // Use the full colourLabel (e.g. "BLACK CAPRI") as the unique key for DB storage
        // This prevents conflicts when multiple SKUs share the same raw colour name
        const colourKey = colourLabels[colIdx] ?? colour;
        const val = specs[colourKey]?.[comp.key] ?? "";
        const savedOpts = allDropdownOptions[comp.key] ?? [];
        const savedOptIds = allDropdownOptionIds?.[comp.key] ?? {};
        const isUpper1 = comp.key === "upper_1";
        const upper1EffectiveVal = isUpper1 && !val ? colourKey : val;
        return (
          <td key={`${colourKey}-${colIdx}`} className="px-2 py-1 align-middle">
            <FreeTypeCell
              component={comp}
              value={upper1EffectiveVal}
              savedOptions={savedOpts}
              savedOptionIds={savedOptIds}
              onSave={(v) => onUpsert(colourKey, comp.key, v)}
              onAddOption={(v) => onAddDropdownOption(comp.key, v)}
              onDeleteOption={isUpper1 ? undefined : (v) => onDeleteDropdownOption(comp.key, v)}
              onEditOption={isUpper1 ? undefined : onEditDropdownOption}
              overrideOptions={isUpper1 ? allColourLeatherOptions : undefined}
              cellId={`${id}:${colIdx}`}
            />
          </td>
        );
      })}
    </tr>
  );
}

// ─── Unified Custom Row (sortable custom row) ───────────────────────────────────────────────
interface UnifiedCustomRowProps {
  id: string;
  /** The representative row (used for title, id, section, sortOrder). Either the __all__ row or the first per-colour row. */
  row: CustomRowData;
  /** Map of colour key → per-colour row. If the row is __all__, this map has one entry with key "__all__". */
  rowGroup: Map<string, CustomRowData>;
  colours: string[];
  colourLabels: string[];
  /** A component rename never carries a cell value. */
  onRename: (id: number, title: string) => void;
  /** Save one exact full-label colour override without deleting shared or other cells. */
  onUpdateForColour: (representativeId: number, title: string, colour: string, newValue: string, currentSharedValue: string, section: string, sortOrder: number) => void;
  onDelete: (id: number) => void;
  allTitles: string[];
  isActive?: boolean;
  /** Dropdown options keyed by "custom:TITLE" for option persistence */
  allDropdownOptions: Record<string, string[]>;
  allDropdownOptionIds?: Record<string, Record<string, number>>;
  onAddDropdownOption: (key: string, value: string) => void;
  onDeleteDropdownOption: (key: string, value: string) => void;
  onEditDropdownOption?: (id: number, newValue: string) => void;
}
function UnifiedCustomRow({ id, row, rowGroup, colours, colourLabels, onRename, onUpdateForColour, onDelete, allTitles, isActive, allDropdownOptions, allDropdownOptionIds, onAddDropdownOption, onDeleteDropdownOption, onEditDropdownOption }: UnifiedCustomRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.15 : 1,
  };
  const isAllRow = row.colour === "__all__";
  // Shared value is display fallback only; colour saves do not consume it.
  const sharedValue = isAllRow ? (row.value ?? "") : "";
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b group ${
        isOver && !isDragging ? "ring-2 ring-amber-400 ring-inset" : ""
      } ${
        isDragging ? "bg-amber-50/20" : "hover:bg-amber-50/30 dark:hover:bg-amber-900/10"
      }`}
    >
      <td className="px-1 py-1.5 align-middle">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 text-muted-foreground/30 hover:text-amber-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Drag to reorder"
            tabIndex={-1}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <CustomRowTitleInput
            id={row.id}
            initialTitle={row.title}
            onRename={onRename}
            onDelete={onDelete}
            allTitles={allTitles}
          />
        </div>
      </td>
      {colours.map((colour, colIdx) => {
        // Get the value for this specific colour.
        // Try the full colour key first (e.g. "BLUSH NUBUCK"), then the short colour name
        // (first word, e.g. "BLUSH") as a fallback for legacy values entered before a second
        // leather was added to the style and the colour key changed from "BLUSH" to "BLUSH NUBUCK".
        const label = colourLabels[colIdx] ?? colour;
        const colourRow = findSpecColourMapValue(rowGroup, label, colour) ?? rowGroup.get("__all__");
        const cellValue = colourRow?.value ?? "";
        // Normalise to lowercase so it matches the normalised allDropdownOptions keys
        const optKey = `custom:${row.title}`.toLowerCase();
        const opts = allDropdownOptions[optKey] ?? [];
        const optIds = allDropdownOptionIds?.[optKey] ?? {};
        return (
          <td key={`${colour}-${colIdx}`} className="px-2 py-1 align-middle">
            <CustomFreeTypeCell
              value={cellValue}
              options={opts}
              optionIds={optIds}
              onSave={(v) => {
                // Even a legacy fallback row belongs to a different physical colour.
                // Write an exact full-label override; never modify that fallback's ID.
                onUpdateForColour(row.id, row.title, label, v, sharedValue, row.section, row.sortOrder);
              }}
              onAddOption={(val) => onAddDropdownOption(optKey, val)}
              onDeleteOption={(val) => onDeleteDropdownOption(optKey, val)}
              onEditOption={onEditDropdownOption}
              cellId={`${id}:${colIdx}`}
            />
          </td>
        );
      })}
    </tr>
  );
}

// ─── Colour Copy Panel ───────────────────────────────────────────────────────

interface ColourCopyPanelProps {
  colours: string[];       // raw colour keys (used for copy logic)
  colourLabels: string[];  // full display labels e.g. "BLACK NAPPA"
  onCopy: (source: string, targets: string[]) => Promise<void>;
}

function ColourCopyPanel({ colours, colourLabels, onCopy }: ColourCopyPanelProps) {
  // Use full colour labels as the copy keys (e.g. "BLACK CAPRI" not "BLACK")
  const labels = colourLabels.length === colours.length ? colourLabels : colours;
  const [source, setSource] = useState<string | null>(null);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  function toggleTarget(label: string) {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  async function handleCopy() {
    if (!source || targets.size === 0 || copying) return;
    setCopying(true);
    try {
      await onCopy(source, Array.from(targets));
      setSource(null);
      setTargets(new Set());
    } catch (error) {
      toast.error(`Could not copy saved spec: ${error instanceof Error ? error.message : "please retry"}`);
    } finally { setCopying(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/20 rounded-lg border text-xs">
      <span className="text-muted-foreground font-medium whitespace-nowrap">Copy specs from:</span>
      <Select value={source ?? ""} onValueChange={(v) => { setSource(v); setTargets(new Set()); }}>
        <SelectTrigger className="h-7 w-48 text-xs">
          <SelectValue placeholder="Select colour…" />
        </SelectTrigger>
        <SelectContent>
          {labels.map((label) => (
            <SelectItem key={label} value={label} className="text-xs">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {source && (
        <>
          <span className="text-muted-foreground">to:</span>
          {labels.filter((label) => label !== source).map((label) => (
            <button
              key={label}
              onClick={() => toggleTarget(label)}
              className={`px-2 py-1 rounded border text-xs transition-colors ${
                targets.has(label)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={targets.size === 0 || copying}
            onClick={handleCopy}
          >
            <Copy className="w-3 h-3" />
            {copying ? "Copying…" : "Copy"}
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

interface CustomRowData {
  id: number;
  style: string;
  colour: string;
  section: string;
  title: string;
  value: string | null;
  sortOrder: number;
}

interface SpecFormProps {
  entry: StyleEntry;
  toeCapsPerColour: Record<string, string>; // colour key → toe cap leather
  specMeta: { hasBuckle: boolean; dressShoeSubType: "court" | "sling" | null; notes: string | null } | null;
  specs: Record<string, Record<string, string>>; // colour → component → value
  allDropdownOptions: Record<string, string[]>;
  allDropdownOptionIds: Record<string, Record<string, number>>;
  allColourLeatherOptions: string[];
  customRows: CustomRowData[];
  onUpsert: (colour: string, component: string, value: string) => void;
  onBulkAutoFill: (rows: Array<{ style: string; colour: string; component: string; value: string }>) => void;
  onBulkCopy: (rows: Array<{ style: string; colour: string; component: string; value: string }>) => Promise<void>;
  onAddDropdownOption: (component: string, value: string) => void;
  onDeleteDropdownOption: (component: string, value: string) => void;
  onEditDropdownOption: (id: number, newValue: string) => void;
  onMetaChange: (meta: Partial<{ hasBuckle: boolean; dressShoeSubType: "court" | "sling" | null; notes: string | null }>) => void;
  onAddSku: (colour: string, leather: string) => void;
  /** Map from Specs column key → editable custom SKU details. */
  editableCustomSkus: Record<string, { id: number; colour: string; leather: string | null | undefined }>;
  onEditSku: (id: number, colour: string, leather: string) => void;
  onAddCustomRow: (section: string, afterSortOrder?: number) => void;
  onRenameCustomRow: (id: number, title: string) => void;
  onUpdateCustomRowForColour: (representativeId: number, title: string, colour: string, newValue: string, currentSharedValue: string, section: string, sortOrder: number) => void;
  onDeleteCustomRow: (id: number) => void;
  onReorderCustomRows: (section: string, orderedIds: number[]) => void;
  dbCategory: string | null;
  allCustomRowTitles: string[]; // for autocomplete
  allStyleEntries: StyleEntry[]; // for cross-style copy
  onHideColumn: (colour: string) => void;
  hiddenColumns: Set<string>; // for showing restore buttons when showHiddenColumns is on
  showHiddenColumns: boolean;
  onShowColumn: (colour: string) => void;
  onResetColour: (colour: string) => void;
  tableScrollRef?: React.MutableRefObject<HTMLDivElement | null>; // lifted up for external colour navigation
  onBulkCopyCustomRowsFromStyle: (targetColours: string[], rows: Array<{ section: string; title: string; value: string; sortOrder: number }>) => Promise<void>;
  /** Called once on mount so SpecsTab can register a swap function that replaces oldKey with newKey in localRowKeys.
   * If localRowKeys is null (no saved order yet), it initialises from the current unifiedRowIds first
   * so the row stays in its current position instead of jumping to the bottom. */
  onRegisterReplaceRowKey?: (swapFn: (oldKey: string, newKey: string) => void) => void;
  /** Returns only a local edited layout; null means fetch the latest saved layout. */
  onRegisterGetRowKeys?: (getFn: (() => string[] | null) | null) => void;
  /** Apply identity changes through the same optimistic, serialized layout writer. */
  onRegisterUpdateRowKeys?: (updateFn: (update: (keys: string[]) => string[]) => Promise<void>) => void;
}

// ─── Fixed Bottom Scrollbar ──────────────────────────────────────────────────
// A standard horizontal scrollbar anchored at the bottom of the open spec.
// It stays visible while scrolling the grid vertically and mirrors the table.

interface BottomSpecScrollbarProps {
  tableElement: HTMLDivElement | null;
}

function BottomSpecScrollbar({ tableElement }: BottomSpecScrollbarProps) {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, width: 0, visible: false });

  useLayoutEffect(() => {
    if (!tableElement) return;

    const update = () => {
      const rect = tableElement.getBoundingClientRect();
      const hasOverflow = tableElement.scrollWidth > tableElement.clientWidth + 1;
      if (trackRef.current) trackRef.current.style.width = `${tableElement.scrollWidth}px`;
      setPosition({
        left: Math.max(0, rect.left),
        width: Math.max(0, rect.width),
        visible: hasOverflow && rect.width > 0,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(tableElement);
    if (tableElement.firstElementChild) observer.observe(tableElement.firstElementChild);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [tableElement]);

  useEffect(() => {
    const scrollbar = scrollbarRef.current;
    if (!tableElement || !scrollbar) return;
    let syncing = false;
    const syncFromTable = () => {
      if (syncing) return;
      syncing = true;
      scrollbar.scrollLeft = tableElement.scrollLeft;
      syncing = false;
    };
    const syncToTable = () => {
      if (syncing) return;
      syncing = true;
      tableElement.scrollLeft = scrollbar.scrollLeft;
      syncing = false;
    };
    tableElement.addEventListener("scroll", syncFromTable, { passive: true });
    scrollbar.addEventListener("scroll", syncToTable, { passive: true });
    syncFromTable();
    return () => {
      tableElement.removeEventListener("scroll", syncFromTable);
      scrollbar.removeEventListener("scroll", syncToTable);
    };
  }, [tableElement]);

  return (
    <div
      ref={scrollbarRef}
      tabIndex={0}
      aria-label="Scroll the spec sheet horizontally"
      className="fixed bottom-2 z-40 h-5 overflow-x-scroll rounded-md border border-border/70 bg-background shadow-lg [&::-webkit-scrollbar]:h-4 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/60"
      style={{
        scrollbarWidth: "auto",
        left: position.left,
        width: position.width,
        visibility: position.visible ? "visible" : "hidden",
      }}
    >
      <div ref={trackRef} className="h-px" />
    </div>
  );
}

// ─── Cross-Style Copy Panel ──────────────────────────────────────────────────
interface CrossStyleCopyPanelProps {
  currentStyle: string;
  currentColours: string[];
  currentColourLabels: string[];
  allStyleEntries: StyleEntry[];
  onCopy: (sourceColourLabel: string, sourceRawColour: string, targetColours: string[], sourceSpecs: Record<string, string>, sourceCustomRows: CrossStyleCustomRowCopy[]) => Promise<void>;
}
function CrossStyleCopyPanel({ currentStyle, currentColours, currentColourLabels, allStyleEntries, onCopy }: CrossStyleCopyPanelProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "full">("single");
  const [sourceStyle, setSourceStyle] = useState<string | null>(null);
  const [sourceColour, setSourceColour] = useState<string | null>(null);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const utils = trpc.useUtils();
  const { season } = useSeason();
  // Full-style mode: mapping from source colour label → target colour label (or "" to skip)
  const [colourMap, setColourMap] = useState<Record<string, string>>({});

  const sourceEntry = allStyleEntries.find((s) => s.style === sourceStyle);

  async function loadSavedSource(entry: StyleEntry) {
    // Wait for prior layout saves if the user has just edited the source style.
    await enqueueSpecRowSave(entry.style, async () => undefined);
    const [specRows, customRows, order, meta] = await Promise.all([
      utils.specs.getForStyle.fetch({ style: entry.style }, { staleTime: 0 }),
      utils.specCustomRow.getByStyle.fetch({ style: entry.style }, { staleTime: 0 }),
      utils.specRowOrder.get.fetch({ style: entry.style }, { staleTime: 0 }),
      utils.specs.getMeta.fetch({ style: entry.style, season }, { staleTime: 0 }),
    ]);
    const template = getTemplateForCategory(entry.category, {
      style: entry.style, hasBuckle: meta?.hasBuckle ?? false,
      dressShoeSubType: meta?.dressShoeSubType as "court" | "sling" | null,
    });
    return { specRows, customRows, rowKeys: order.rowKeys, template };
  }

  // Auto-build colour map when source style changes in full mode
  useEffect(() => {
    if (mode !== "full" || !sourceEntry) { setColourMap({}); return; }
    const newMap: Record<string, string> = {};
    for (let i = 0; i < sourceEntry.colours.length; i++) {
      const srcLabel = sourceEntry.colourLabels[i] ?? sourceEntry.colours[i];
      // Try to find a matching target colour by label (case-insensitive)
      const match = currentColourLabels.find((tl) => tl.toLowerCase() === srcLabel.toLowerCase());
      newMap[srcLabel] = match ?? "";
    }
    setColourMap(newMap);
  }, [sourceEntry, mode, currentColourLabels]);

  function reset() {
    setOpen(false);
    setSourceStyle(null);
    setSourceColour(null);
    setTargets(new Set());
    setColourMap({});
    setMode("single");
  }

  function toggleTarget(colour: string) {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(colour)) next.delete(colour); else next.add(colour);
      return next;
    });
  }

  async function handleSingleCopy() {
    if (!sourceEntry || !sourceColour || targets.size === 0 || copying) return;
    setCopying(true);
    try {
      const sourceIndex = sourceEntry.colours.indexOf(sourceColour);
      const sourceLabel = sourceEntry.colourLabels[sourceIndex] ?? sourceColour;
      const saved = await loadSavedSource(sourceEntry);
      const snapshot = buildSavedSpecCopySnapshot({ ...saved, sourceColourLabel: sourceLabel, sourceRawColour: sourceColour });
      await onCopy(sourceLabel, sourceColour, Array.from(targets), snapshot.components, snapshot.customRows);
      reset();
    } catch (error) {
      toast.error(`Could not copy saved spec: ${error instanceof Error ? error.message : "please retry"}`);
    } finally { setCopying(false); }
  }
  async function handleFullCopy() {
    if (!sourceEntry || copying) return;
    let copiedCount = 0;
    setCopying(true);
    try {
      const saved = await loadSavedSource(sourceEntry);
      for (let i = 0; i < sourceEntry.colours.length; i++) {
        const srcColourKey = sourceEntry.colours[i];
        const srcLabel = sourceEntry.colourLabels[i] ?? srcColourKey;
        const targetLabel = colourMap[srcLabel];
        if (!targetLabel) continue;
        const snapshot = buildSavedSpecCopySnapshot({ ...saved, sourceColourLabel: srcLabel, sourceRawColour: srcColourKey });
        await onCopy(srcLabel, srcColourKey, [targetLabel], snapshot.components, snapshot.customRows);
        copiedCount++;
      }
      if (copiedCount === 0) toast.error("No colour mappings set — nothing to copy");
      else reset();
    } catch (error) {
      toast.error(`Could not copy saved spec: ${error instanceof Error ? error.message : "please retry"}`);
    } finally { setCopying(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
      >
        + Copy from another style
      </button>
    );
  }

  return (
    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-amber-900 dark:text-amber-200">Copy components from another style</span>
        <button onClick={reset} className="text-muted-foreground hover:text-foreground text-sm leading-none">×</button>
      </div>
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("single")}
          className={`px-2 py-1 rounded border text-xs transition-colors ${mode === "single" ? "bg-amber-600 text-white border-amber-600" : "bg-background border-border hover:bg-muted"}`}
        >Single colour</button>
        <button
          onClick={() => setMode("full")}
          className={`px-2 py-1 rounded border text-xs transition-colors ${mode === "full" ? "bg-amber-600 text-white border-amber-600" : "bg-background border-border hover:bg-muted"}`}
        >Entire style</button>
      </div>
      {/* Source style picker */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-muted-foreground whitespace-nowrap">Source style:</span>
        <Select value={sourceStyle ?? ""} onValueChange={(v) => { setSourceStyle(v); setSourceColour(null); setTargets(new Set()); }}>
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue placeholder="Select style…" />
          </SelectTrigger>
          <SelectContent>
            {allStyleEntries.filter((s) => s.style !== currentStyle).map((s) => (
              <SelectItem key={s.style} value={s.style} className="text-xs">{s.style}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Single mode: source colour picker */}
        {mode === "single" && sourceEntry && (
          <>
            <span className="text-muted-foreground">colour:</span>
            <Select value={sourceColour ?? ""} onValueChange={(v) => { setSourceColour(v); setTargets(new Set()); }}>
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue placeholder="Select colour…" />
              </SelectTrigger>
              <SelectContent>
                {sourceEntry.colours.map((c, i) => {
                  const label = sourceEntry.colourLabels[i] ?? c;
                  return <SelectItem key={c} value={c} className="text-xs">{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      {/* Single mode: target colour picker */}
      {mode === "single" && sourceColour && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-muted-foreground whitespace-nowrap">Copy into:</span>
          {currentColours.map((c, i) => {
            const label = currentColourLabels[i] ?? c;
            return (
              <button
                key={c}
                onClick={() => toggleTarget(label)}
                className={`px-2 py-1 rounded border text-xs transition-colors ${
                  targets.has(label)
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {mode === "single" && sourceColour && (
        <p className="text-muted-foreground">
          Copies all populated components to the selected SKU columns. Upper 1 stays with each target SKU.
        </p>
      )}
      {/* Full mode: colour mapping table */}
      {mode === "full" && sourceEntry && Object.keys(colourMap).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground">Map source colours → target colours (leave blank to skip):</p>
          {sourceEntry.colours.map((srcKey, i) => {
            const srcLabel = sourceEntry.colourLabels[i] ?? srcKey;
            return (
              <div key={srcKey} className="flex items-center gap-2">
                <span className="w-36 truncate font-medium">{srcLabel}</span>
                <span className="text-muted-foreground">→</span>
                <Select
                  value={colourMap[srcLabel] ?? ""}
                  onValueChange={(v) => setColourMap((prev) => ({ ...prev, [srcLabel]: v }))}
                >
                  <SelectTrigger className="h-6 w-44 text-xs">
                    <SelectValue placeholder="— skip —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs text-muted-foreground">— skip —</SelectItem>
                    {currentColours.map((tc, ti) => {
                      const tl = currentColourLabels[ti] ?? tc;
                      return <SelectItem key={tc} value={tl} className="text-xs">{tl}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
      {/* Action buttons */}
      {mode === "single" && targets.size > 0 && (
        <Button size="sm" disabled={copying} onClick={handleSingleCopy} className="h-7 text-xs bg-amber-600 hover:bg-amber-700">
          Copy {targets.size} colour{targets.size > 1 ? "s" : ""}
        </Button>
      )}
      {mode === "full" && sourceEntry && Object.values(colourMap).some((v) => v) && (
        <Button size="sm" disabled={copying} onClick={handleFullCopy} className="h-7 text-xs bg-amber-600 hover:bg-amber-700">
          Copy entire style ({Object.values(colourMap).filter((v) => v).length} colour{Object.values(colourMap).filter((v) => v).length !== 1 ? "s" : ""})
        </Button>
      )}
    </div>
  );
}
// ─── Unified Row type for drag-and-drop ──────────────────────────────────────
type UnifiedRow =
  | { kind: "template"; id: string; comp: SpecComponent }
  | { kind: "custom"; id: string; row: CustomRowData; rowGroup: Map<string, CustomRowData> };

export function SpecForm({
  entry, toeCapsPerColour, specMeta, specs, allDropdownOptions, allDropdownOptionIds, allColourLeatherOptions, customRows,
  onUpsert, onBulkAutoFill, onBulkCopy, onAddDropdownOption, onDeleteDropdownOption, onEditDropdownOption, onMetaChange, onAddSku, editableCustomSkus, onEditSku, onAddCustomRow, onRenameCustomRow, onUpdateCustomRowForColour, onDeleteCustomRow, onReorderCustomRows,
  dbCategory, allCustomRowTitles, allStyleEntries,
  onHideColumn, hiddenColumns, showHiddenColumns, onShowColumn, onResetColour,
  tableScrollRef: externalTableScrollRef,
  onBulkCopyCustomRowsFromStyle,
  onRegisterReplaceRowKey,
  onRegisterGetRowKeys,
  onRegisterUpdateRowKeys,
}: SpecFormProps) {
  const [showAddSku, setShowAddSku] = useState(false);
  const [hideEmptyRows, setHideEmptyRows] = useState(true); // hide rows with no values by default
  const [showCopyPanel, setShowCopyPanel] = useState(false); // collapse copy panel by default
  const [newSkuColour, setNewSkuColour] = useState("");
  const [newSkuLeather, setNewSkuLeather] = useState("");
  // Edit custom SKU inline
  const [editingSkuColour, setEditingSkuColour] = useState<string | null>(null); // raw colour key being edited
  const [editSkuColour, setEditSkuColour] = useState("");
  const [editSkuLeather, setEditSkuLeather] = useState("");
  // Keep the mounted grid element in state so the colour navigator appears only
  // after it has an actual horizontal scroll container to control.
  const [tableScrollElement, setTableScrollElement] = useState<HTMLDivElement | null>(null);
  const setTableScrollNode = useCallback((node: HTMLDivElement | null) => {
    if (externalTableScrollRef) externalTableScrollRef.current = node;
    setTableScrollElement(node);
  }, [externalTableScrollRef]);
  const tableRef = useRef<HTMLTableElement>(null);
  // Unified drag-and-drop state — activeId is a string like "t:upper_1" or "c:42"
  const [activeId, setActiveId] = useState<string | null>(null);
  // Local row order override (optimistic, updated on drag)
  const [localRowKeys, setLocalRowKeys] = useState<string[] | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Load saved row order from server
  const { data: rowOrderData } = trpc.specRowOrder.get.useQuery(
    { style: entry.style },
    { enabled: !!entry.style }
  );
  const specRowOrderUtils = trpc.useUtils();
  const upsertRowOrderMutation = trpc.specRowOrder.upsert.useMutation({
    onSettled: (_data, _err, vars) => {
      specRowOrderUtils.specRowOrder.get.invalidate({ style: vars.style });
    },
  });
  const purgeOrphanedMutation = trpc.specRowOrder.purgeOrphaned.useMutation({
    onSuccess: (_data, vars) => {
      specRowOrderUtils.specRowOrder.get.invalidate({ style: vars.style });
      setLocalRowKeys(null);
    },
  });

  // Pre-compute sorted custom rows
  const allCustomRowsSorted = useMemo(
    () => [...customRows].sort((a, b) => a.sortOrder - b.sortOrder),
    [customRows]
  );
  const allCustomRowIds = useMemo(
    () => allCustomRowsSorted.map((r) => r.id),
    [allCustomRowsSorted]
  );

  // Group per-colour rows by title so they render as a single table row.
  // Key: title → Map<colour, row>. The representative row is the first one seen (lowest id).
  const customRowGroups = useMemo(() => {
    const groups = new Map<string, { rep: CustomRowData; colourMap: Map<string, CustomRowData> }>();
    for (const group of groupSpecCustomRows(customRows)) {
      groups.set(`c:${group.rep.id}`, group);
    }
    return groups;
  }, [customRows]);
  const customRowAliases = useMemo(() => getCustomSpecRowAliases(groupSpecCustomRows(customRows)), [customRows]);

  // For unifiedRows: use the representative row's id as the canonical key (c:{rep.id})
  const customRepMap = useMemo(() => {
    const m = new Map<string, { rep: CustomRowData; colourMap: Map<string, CustomRowData> }>();
    for (const [, group] of Array.from(customRowGroups)) {
      m.set(`c:${group.rep.id}`, group);
    }
    return m;
  }, [customRowGroups]);
  const hasBuckle = specMeta?.hasBuckle ?? false;
  const dressShoeSubType = specMeta?.dressShoeSubType ?? null;
  const comments = specMeta?.notes ?? "";
  // Use DB category override if set, otherwise fall back to static skuData category
  const effectiveCategory = dbCategory ?? entry.category;
  const isDressShoe = effectiveCategory === "Dress Shoe";

  const template = getTemplateForCategory(effectiveCategory, {
    hasBuckle,
    dressShoeSubType: isDressShoe ? dressShoeSubType : null,
    style: entry.style,
  });

  // Group components by section
  const sections = template.reduce<Record<string, SpecComponent[]>>((acc, comp) => {
    if (!acc[comp.section]) acc[comp.section] = [];
    acc[comp.section].push(comp);
    return acc;
  }, {});

  // Build unified row list — template rows get id "t:key", custom rows get id "c:id"
  // Order: saved rowKeys from server (or local override), falling back to template order + custom rows at end
  const unifiedRows = useMemo((): UnifiedRow[] => {
    const templateMap = new Map(template.map((c) => [`t:${c.key}`, c]));
    const savedKeys = localRowKeys ?? rowOrderData?.rowKeys ?? null;
    const available = [...Array.from(templateMap.keys()), ...Array.from(customRepMap.keys())];
    return getOrderedSpecRowKeys(available, savedKeys, customRowAliases).map((key): UnifiedRow => {
      const comp = templateMap.get(key);
      if (comp) return { kind: "template", id: key, comp };
      const group = customRepMap.get(key)!;
      return { kind: "custom", id: key, row: group.rep, rowGroup: group.colourMap };
    });
  }, [template, customRepMap, customRowAliases, rowOrderData, localRowKeys]);

  const unifiedRowIds = useMemo(() => unifiedRows.map((r) => r.id), [unifiedRows]);
  // Compute which rows have at least one value filled (for hide-empty-rows toggle)
  const rowHasValue = useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const uRow of unifiedRows) {
      if (uRow.kind === "template") {
        const comp = uRow.comp;
        const isPinned = comp.key === "upper_1";
        if (isPinned) { result[uRow.id] = true; continue; }
        const hasVal = entry.colours.some((colour, i) => {
          const colourKey = entry.colourLabels[i] ?? colour;
          return !!(specs[colourKey]?.[comp.key]?.trim());
        });
        result[uRow.id] = hasVal;
      } else {
        // Custom rows: check if any colour has a value
        const hasVal = entry.colours.some((colour, i) => {
          const row = findSpecColourMapValue(uRow.rowGroup, entry.colourLabels[i] ?? colour, colour) ?? uRow.rowGroup.get("__all__");
          return !!(row?.value?.trim());
        });
        result[uRow.id] = hasVal;
      }
    }
    return result;
  }, [unifiedRows, specs, entry.colours, entry.colourLabels]);
  // Rows to render (filtered when hideEmptyRows is on)
  const visibleRows = useMemo(() => {
    if (!hideEmptyRows) return unifiedRows;
    return unifiedRows.filter((r) => rowHasValue[r.id]);
  }, [unifiedRows, rowHasValue, hideEmptyRows]);
  const hiddenEmptyCount = unifiedRows.length - visibleRows.length;
  const activeRow = activeId ? unifiedRows.find((r) => r.id === activeId) ?? null : null;

  // Register a swapRowKey function with the parent so SpecsTab can replace old/temp row keys
  // with new/real ones without a full re-render cycle.
  // When localRowKeys is null (no saved order yet), we initialise from unifiedRowIds first
  // so the row stays in its current visual position instead of jumping to the bottom.
  // IMPORTANT: must be declared AFTER unifiedRowIds to avoid temporal dead zone errors.
  const unifiedRowIdsRef = useRef<string[]>([]);
  useEffect(() => { unifiedRowIdsRef.current = unifiedRowIds; }, [unifiedRowIds]);
  // Keep a ref to localRowKeys so the parent can read the current value synchronously
  const localRowKeysRef = useRef<string[] | null>(null);
  const savedRowKeysRef = useRef<string[] | null>(null);
  savedRowKeysRef.current = rowOrderData?.rowKeys ?? null;
  const rowAliasesRef = useRef(customRowAliases);
  rowAliasesRef.current = customRowAliases;
  unifiedRowIdsRef.current = unifiedRowIds;
  function getCurrentRowKeys() {
    return normalizeSpecRowLayout([...(localRowKeysRef.current ?? savedRowKeysRef.current ?? []), ...unifiedRowIdsRef.current], rowAliasesRef.current);
  }
  async function saveRowKeys(keys: string[]) {
    const normalized = normalizeSpecRowLayout(keys, rowAliasesRef.current);
    localRowKeysRef.current = normalized;
    setLocalRowKeys(normalized);
    try {
      await enqueueSpecRowSave(entry.style, () => upsertRowOrderMutation.mutateAsync({ style: entry.style, rowKeys: normalized }));
    } catch (error) {
      toast.error("Could not save row layout — use Save order to retry");
      throw error;
    }
  }
  const saveRowKeysRef = useRef(saveRowKeys);
  saveRowKeysRef.current = saveRowKeys;
  useEffect(() => {
    onRegisterReplaceRowKey?.((oldKey: string, newKey: string) => {
      const base = localRowKeysRef.current ?? mergeSpecRowOrder(unifiedRowIdsRef.current, savedRowKeysRef.current);
      void saveRowKeysRef.current(replaceSpecRowKey(base, oldKey, newKey)).catch(() => undefined);
    });
    onRegisterGetRowKeys?.(() => localRowKeysRef.current !== null ? getCurrentRowKeys() : null);
    onRegisterUpdateRowKeys?.((update) => saveRowKeysRef.current(update(getCurrentRowKeys())));
    return () => onRegisterGetRowKeys?.(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applySavedCopy(targetColours: string[], sourceSpecs: Record<string, string>, sourceCustomRows: CrossStyleCustomRowCopy[]) {
    const plan = planSavedSpecReplacement(entry.style, targetColours, sourceSpecs, template);
    // Current visible manual rows win over generated component aliases.
    const keyFor = (row: { section: string; title: string }) => `${row.section}\u0000${row.title.trim().replace(/\s+/g, " ").toUpperCase()}`;
    const incoming = new Map(plan.customRows.map(row => [keyFor(row), row]));
    for (const row of sourceCustomRows) incoming.set(keyFor(row), row);
    // Clear old custom cells only in the selected target columns. This removes
    // leftovers from an earlier copy while keeping unselected SKUs unchanged.
    const replacements = new Map<string, CrossStyleCustomRowCopy>();
    for (const group of groupSpecCustomRows(customRows)) {
      if (group.rep.title.trim()) replacements.set(keyFor(group.rep), { ...group.rep, value: "" });
    }
    for (const [key, row] of Array.from(incoming)) replacements.set(key, row);
    await onBulkCopy(plan.componentRows);
    if (replacements.size > 0) await onBulkCopyCustomRowsFromStyle(targetColours, Array.from(replacements.values()));
    // Copy updates the selected cells, not the target style's row visibility.
    // Explicitly removed components stay removed until the user chooses Restore.
    await saveRowKeys(getCurrentRowKeys());
  }

  async function handleCopyFrom(sourceColour: string, targetColours: string[]) {
    const i = entry.colourLabels.indexOf(sourceColour);
    const specRows = Object.entries(specs).flatMap(([colour, values]) => Object.entries(values).map(([component, value], id) => ({ id, colour, component, value })));
    const snapshot = buildSavedSpecCopySnapshot({ specRows, customRows, template, rowKeys: getCurrentRowKeys(), sourceColourLabel: sourceColour, sourceRawColour: entry.colours[i] ?? sourceColour });
    await applySavedCopy(targetColours, snapshot.components, snapshot.customRows);
    toast.success(`Copied saved specs to ${targetColours.length} colour(s) — Upper 1 kept`);
  }

  // Auto-fill upper_1 with the colour+leather label, and toe cap with the toe cap leather,
  // for each colour that has no saved value yet.
  // Uses a single bulk upsert call to avoid overwhelming the server with simultaneous mutations.
  const autoFillDoneRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const rows: Array<{ style: string; colour: string; component: string; value: string }> = [];
    entry.colours.forEach((colour, colIdx) => {
      // Use the full colourLabel as the unique key (e.g. "BLACK CAPRI" not "BLACK")
      const colourKey = entry.colourLabels[colIdx] ?? colour;
      const key = `${entry.style}:${colourKey}`;
      if (autoFillDoneRef.current.has(key)) return;
      autoFillDoneRef.current.add(key);
      // Auto-fill upper_1
      const existing = specs[colourKey]?.["upper_1"];
      if (!existing) {
        rows.push({ style: entry.style, colour: colourKey, component: "upper_1", value: colourKey });
      }
      // Auto-fill toe cap if this style has a toe cap component and the cell is empty
      const toeCapValue = toeCapsPerColour[colour];
      if (toeCapValue) {
        const toeCapKey = `${entry.style.toLowerCase()}_toe_cap`;
        const existingToeCap = specs[colourKey]?.[toeCapKey];
        if (!existingToeCap) {
          rows.push({ style: entry.style, colour: colourKey, component: toeCapKey, value: toeCapValue });
        }
      }
    });
    if (rows.length > 0) {
      onBulkAutoFill(rows);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.style, entry.colours.join(",")]);

  // Count filled cells (use colourLabels as the key to match how values are stored)
  const totalCells = template.length * entry.colours.length;
  const filledCells = entry.colours.reduce((sum, colour, colIdx) => {
    const colourKey = entry.colourLabels[colIdx] ?? colour;
    return sum + template.filter((c) => !!(specs[colourKey]?.[c.key])).length;
  }, 0);
  const pct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Style header */}
      <div className="flex items-start gap-4 pb-4 border-b">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{entry.style}</h2>
            {dbCategory ? (
              <Badge className="text-xs bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900 dark:text-violet-200">{dbCategory}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">{entry.category}</Badge>
            )}
            <Badge variant="outline" className="text-xs">{entry.last}</Badge>
            {entry.isAllNew && <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">New Pattern</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground">{entry.colours.length} colours · {entry.totalSKUs} SKUs</span>
            {hiddenColumns.size > 0 && (
              <button
                onClick={() => onShowColumn("__toggle__")}
                className="text-xs text-amber-600 hover:text-amber-700 underline underline-offset-2"
              >
                {showHiddenColumns ? `Showing ${hiddenColumns.size} hidden` : `${hiddenColumns.size} hidden`}
              </button>
            )}
            <button
              onClick={() => setShowAddSku((v) => !v)}
              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              <Plus className="w-3 h-3" />
              Add Colour/SKU
            </button>

          </div>
        </div>
      </div>

      {/* Add new SKU inline form */}
      {showAddSku && (
        <div className="flex flex-wrap items-end gap-2 p-3 bg-amber-50/60 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Colour</label>
            <Input
              value={newSkuColour}
              onChange={(e) => setNewSkuColour(e.target.value.toUpperCase())}
              placeholder="e.g. BLACK"
              className="h-8 w-36 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Leather</label>
            <Input
              value={newSkuLeather}
              onChange={(e) => setNewSkuLeather(e.target.value.toUpperCase())}
              placeholder="e.g. NAPPA"
              className="h-8 w-36 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!newSkuColour.trim()}
            onClick={() => {
              onAddSku(newSkuColour.trim(), newSkuLeather.trim());
              setNewSkuColour("");
              setNewSkuLeather("");
              setShowAddSku(false);
            }}
          >
            Add SKU
          </Button>
          <button onClick={() => setShowAddSku(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Factory-facing comments are always visible, rather than hidden in Settings. */}
      <div className="rounded-lg border bg-muted/20 p-3">
        <Label className="text-sm font-semibold block mb-1.5">Comments</Label>
        <SpecCommentsEditor
          key={entry.style}
          value={comments}
          onSave={(notes) => onMetaChange({ notes })}
        />
      </div>

      {/* Copy panels — collapsible */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowCopyPanel(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          <span>Copy specs from another colour or style</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCopyPanel ? "rotate-180" : ""}`} />
        </button>
      {showCopyPanel && <div className="flex flex-col gap-2 p-3">
        {entry.colours.length > 1 && (
          <ColourCopyPanel
            colours={entry.colours}
            colourLabels={entry.colourLabels}
            onCopy={handleCopyFrom}
          />
        )}
        <CrossStyleCopyPanel
          currentStyle={entry.style}
          currentColours={entry.colours}
          currentColourLabels={entry.colourLabels}
          allStyleEntries={allStyleEntries}
          onCopy={async (sourceColourLabel, _sourceRawColour, targetColours, sourceSpecs, sourceCustomRows) => {
            await applySavedCopy(targetColours, sourceSpecs, sourceCustomRows);
            toast.success(`Copied latest saved specs from ${sourceColourLabel} — Upper 1 kept`);
          }}
        />
      </div>}{/* end showCopyPanel */}
      </div>{/* end copy panel */}

      {/* Spec grid — unified drag-and-drop for ALL rows (template + custom) */}
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        accessibility={{ container: typeof document !== 'undefined' ? document.body : undefined }}
        onDragStart={({ active }) => setActiveId(active.id as string)}
        onDragEnd={(event) => {
          setActiveId(null);
          const { active, over } = event;
          if (!over || active.id === over.id) return;
          const oldIdx = unifiedRowIds.indexOf(active.id as string);
          let newIdx = unifiedRowIds.indexOf(over.id as string);
          if (oldIdx === -1 || newIdx === -1) return;
          // Upper 1 is always pinned at position 0 — never allow anything to be dragged before it
          if (newIdx === 0 && unifiedRowIds[0] === "t:upper_1") newIdx = 1;
          if (oldIdx === newIdx) return;
          const newKeys = arrayMove(unifiedRowIds, oldIdx, newIdx);
          void saveRowKeys(mergeSpecRowOrder(newKeys, getCurrentRowKeys())).catch(() => undefined);
        }}
        onDragCancel={() => setActiveId(null)}
      >
      <div
        ref={setTableScrollNode}
        className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-muted/40 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-thumb]:rounded-full"
        onWheel={(event) => {
          // Make a conventional mouse with Shift held as useful as a trackpad.
          if (!event.shiftKey || event.deltaY === 0) return;
          event.currentTarget.scrollLeft += event.deltaY;
          event.preventDefault();
        }}
      >
        <table ref={tableRef} className="w-max min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40 border-b">
                <div className="flex items-center gap-2">
                  <span>Component</span>
                  <button
                    onClick={() => setHideEmptyRows(v => !v)}
                   title={hideEmptyRows ? "Show all rows (including empty)" : "Hide empty rows"}
                   className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${hideEmptyRows ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" : "bg-muted text-muted-foreground border-border hover:bg-amber-50"}`}
                 >
                   {hideEmptyRows ? `${hiddenEmptyCount} hidden` : "Hide empty"}
                 </button>
                  <button
                    onClick={() => {
                      void saveRowKeys(getCurrentRowKeys()).then(() => toast.success("Row order saved")).catch(() => undefined);
                    }}
                    title="Save current row order to database"
                    className="text-xs px-1.5 py-0.5 rounded border transition-colors bg-muted text-muted-foreground border-border hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                  >
                    💾 Save order
                  </button>
               </div>
             </th>
              {entry.colours.map((colour, i) => (
                <th key={`${colour}-${i}`} className="text-left px-3 py-2 font-medium border-b min-w-[160px] group/col relative">
                  <div className="flex items-center gap-1 justify-between">
                    <span>{entry.colourLabels[i] ?? colour}</span>
                    {showHiddenColumns && hiddenColumns.has(colour) ? (
                      // Restore button for hidden columns (visible when showHiddenColumns is on)
                      <button
                        onClick={() => onShowColumn(colour)}
                        title={`Restore ${colour} column`}
                        className="flex-shrink-0 text-xs text-green-600 hover:text-green-700 font-medium px-1 py-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                      >
                        Restore
                      </button>
                    ) : editingSkuColour === colour ? (
                      // Inline edit form for custom SKU colour/leather
                      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={editSkuColour}
                          onChange={(e) => setEditSkuColour(e.target.value.toUpperCase())}
                          placeholder="Colour"
                          className="w-20 px-1.5 py-0.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const sku = editableCustomSkus[colour];
                              if (sku && editSkuColour.trim()) {
                                onEditSku(sku.id, editSkuColour.trim(), editSkuLeather.trim());
                                setEditingSkuColour(null);
                              }
                            }
                            if (e.key === "Escape") setEditingSkuColour(null);
                          }}
                        />
                        <input
                          value={editSkuLeather}
                          onChange={(e) => setEditSkuLeather(e.target.value.toUpperCase())}
                          placeholder="Leather"
                          className="w-20 px-1.5 py-0.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const sku = editableCustomSkus[colour];
                              if (sku && editSkuColour.trim()) {
                                onEditSku(sku.id, editSkuColour.trim(), editSkuLeather.trim());
                                setEditingSkuColour(null);
                              }
                            }
                            if (e.key === "Escape") setEditingSkuColour(null);
                          }}
                        />
                        <button
                          onClick={() => {
                            const sku = editableCustomSkus[colour];
                            if (sku && editSkuColour.trim()) {
                              onEditSku(sku.id, editSkuColour.trim(), editSkuLeather.trim());
                              setEditingSkuColour(null);
                            }
                          }}
                          className="p-0.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                          title="Save"
                        ><Check className="w-3 h-3" /></button>
                        <button
                          onClick={() => setEditingSkuColour(null)}
                          className="p-0.5 rounded text-muted-foreground hover:bg-accent"
                          title="Cancel"
                        ><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      // Reset + Hide buttons — only visible on hover; Edit also shown for custom SKUs
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-all">
                        {editableCustomSkus[colour] !== undefined && (
                          <button
                            onClick={() => {
                              const sku = editableCustomSkus[colour];
                              if (!sku) return;
                              setEditSkuColour(sku.colour);
                              setEditSkuLeather(sku.leather ?? "");
                              setEditingSkuColour(colour);
                            }}
                            title={`Edit colour/leather for ${colour}`}
                            className="flex-shrink-0 text-muted-foreground hover:text-blue-500 transition-all p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm(`Reset all spec values for ${colour}? This cannot be undone.`)) {
                              onResetColour(colour);
                            }
                          }}
                          title={`Reset all values for ${colour}`}
                          className="flex-shrink-0 text-muted-foreground hover:text-amber-600 transition-all p-0.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onHideColumn(colour)}
                          title={`Hide ${colour} column`}
                          className="flex-shrink-0 text-muted-foreground hover:text-red-500 transition-all p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SortableContext items={unifiedRowIds} strategy={verticalListSortingStrategy}>
              {visibleRows.map((uRow) => {
                if (uRow.kind === "template") {
                  const comp = uRow.comp;
                  return (
                    <UnifiedTemplateRow
                      key={uRow.id}
                      id={uRow.id}
                      comp={comp}
                      colours={entry.colours}
                      colourLabels={entry.colourLabels}
                      specs={specs}
                      allDropdownOptions={allDropdownOptions}
                      allDropdownOptionIds={allDropdownOptionIds}
                      allColourLeatherOptions={allColourLeatherOptions}
                      onUpsert={onUpsert}
                      onAddDropdownOption={onAddDropdownOption}
                      onDeleteDropdownOption={onDeleteDropdownOption}
                      onEditDropdownOption={onEditDropdownOption}
                      isActive={activeId === uRow.id}
                      onDelete={(id) => {
                        void saveRowKeys(hideSpecRow(getCurrentRowKeys(), id)).catch(() => undefined);
                      }}
                    />
                  );
                } else {
                  const row = uRow.row;
                  return (
                    <UnifiedCustomRow
                      key={uRow.id}
                      id={uRow.id}
                      row={row}
                      rowGroup={uRow.rowGroup}
                      colours={entry.colours}
                      colourLabels={entry.colourLabels}
                      onRename={onRenameCustomRow}
                      onUpdateForColour={onUpdateCustomRowForColour}
                      onDelete={(id) => {
                        void saveRowKeys(hideSpecRow(getCurrentRowKeys(), `c:${id}`)).catch(() => undefined);
                      }}
                      allTitles={allCustomRowTitles}
                      isActive={activeId === uRow.id}
                      allDropdownOptions={allDropdownOptions}
                      allDropdownOptionIds={allDropdownOptionIds}
                      onAddDropdownOption={onAddDropdownOption}
                      onDeleteDropdownOption={onDeleteDropdownOption}
                      onEditDropdownOption={onEditDropdownOption}
                    />
                  );
                }
              })}
            </SortableContext>
            {/* Single Add Row button + Restore hidden rows at the bottom */}
            <tr>
              <td colSpan={entry.colours.length + 1} className="px-3 py-2">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      // A new empty component must stay visible while its name and
                      // first colour value are being entered. Explicit row deletes
                      // remain excluded by the layout, even with empty rows shown.
                      setHideEmptyRows(false);
                      onAddCustomRow("components");
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-amber-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add row
                  </button>
                  {/* Restore hidden rows */}
                  {(() => {
                    const currentKeys = getCurrentRowKeys();
                    if (!currentKeys) return null;
                    const deletedEntries = currentKeys
                      .filter((k) => k.startsWith("deleted:"))
                      .map((k) => {
                        const inner = k.slice("deleted:".length);
                        if (inner.startsWith("t:")) {
                          const comp = template.find((c) => `t:${c.key}` === inner);
                          return comp ? { key: k, label: comp.label, inner, orphaned: false } : null;
                        } else if (inner.startsWith("c:")) {
                          const id = parseInt(inner.slice(2), 10);
                          const group = customRepMap.get(inner);
                          const title = group?.rep.title ?? customRows.find((r) => r.id === id)?.title;
                          return { key: k, label: title ?? inner, inner, orphaned: !title };
                        }
                        return null;
                      })
                      .filter(Boolean) as Array<{ key: string; label: string; inner: string; orphaned: boolean }>;
                    const orphanedKeys = deletedEntries.filter((e) => e.orphaned).map((e) => e.inner);
                    const visibleEntries = deletedEntries.filter((e) => !e.orphaned);
                    if (deletedEntries.length === 0) return null;
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-amber-600 transition-colors">
                            <RotateCcw className="w-3 h-3" />
                            {visibleEntries.length > 0 ? `${visibleEntries.length} hidden row${visibleEntries.length > 1 ? "s" : ""}` : `${orphanedKeys.length} orphaned row${orphanedKeys.length > 1 ? "s" : ""}`}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          {visibleEntries.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Hidden rows — click to restore</p>
                              <div className="flex flex-col gap-0.5">
                                {visibleEntries.map(({ key, label, inner }) => (
                                  <button
                                    key={key}
                                    onClick={() => {
                                      void saveRowKeys(restoreSpecRow(getCurrentRowKeys(), inner)).catch(() => undefined);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left w-full group transition-colors"
                                  >
                                    <RotateCcw className="w-3 h-3 text-muted-foreground/40 group-hover:text-amber-600 flex-shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                          {orphanedKeys.length > 0 && (
                            <div className={visibleEntries.length > 0 ? "mt-2 pt-2 border-t" : ""}>
                              <p className="text-xs text-muted-foreground px-1 mb-1">
                                {orphanedKeys.length} orphaned row{orphanedKeys.length > 1 ? "s" : ""} (no longer in database)
                              </p>
                              <button
                                onClick={() => purgeOrphanedMutation.mutate({ style: entry.style, orphanedKeys })}
                                disabled={purgeOrphanedMutation.isPending}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3 flex-shrink-0" />
                                {purgeOrphanedMutation.isPending ? "Cleaning up…" : `Permanently delete ${orphanedKeys.length} orphaned row${orphanedKeys.length > 1 ? "s" : ""}`}
                              </button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* DragOverlay — floating row shown while dragging */}
      <DragOverlay>
        {activeRow && (
          <table className="w-full text-xs border-collapse shadow-xl opacity-95">
            <tbody>
              {activeRow.kind === "template" ? (
                <tr className="bg-amber-50 dark:bg-amber-900/40 border border-amber-300">
                  <td className="px-3 py-1.5 font-medium text-muted-foreground align-middle w-40">
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-3.5 h-3.5 text-amber-500" />
                      {activeRow.comp.label}
                    </div>
                  </td>
                  {entry.colours.map((colour, i) => (
                    <td key={i} className="px-2 py-1 align-middle min-w-[160px]">
                      <div className="h-8 px-2 flex items-center text-xs rounded border border-amber-200 bg-amber-50/50">
                        {specs[colour]?.[activeRow.comp.key] ?? <span className="text-muted-foreground">— type —</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              ) : (
                <tr className="bg-amber-50 dark:bg-amber-900/40 border border-amber-300">
                  <td className="px-1 py-1.5 align-middle w-40">
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-amber-700">{activeRow.row.title || "(untitled)"}</span>
                    </div>
                  </td>
                  {entry.colours.map((colour, i) => (
                    <td key={i} className="px-2 py-1 align-middle min-w-[160px]">
                      <div className="h-8 px-2 flex items-center text-xs rounded border border-amber-200 bg-amber-50/50">
                        {activeRow.row.value ?? <span className="text-muted-foreground">— type —</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </DragOverlay>
      </DndContext>
      {/* Standard bottom scrollbar stays visible while the grid scrolls vertically. */}
      <BottomSpecScrollbar tableElement={tableScrollElement} />
    </div>
  );
}

// ─── Main SpecsTab ────────────────────────────────────────────────────────────

interface SpecsTabProps {}

export default function SpecsTab({}: SpecsTabProps) {
  const { mergedRawSkus, mergedStyles, customSkus } = useCustomSkus();
  const { season } = useSeason();

  // Build live Specs keys. Upper 2 is part of the SKU identity, so matching
  // Upper 1 rows remain separate when their Upper 2 differs.
  const SPEC_COLOUR_KEY_BY_SKU = useMemo(
    () => buildSpecColourKeyLookup(mergedRawSkus as Array<{
      style: string;
      colour: string;
      leather?: string | null;
      colour2?: string | null;
      leather2?: string | null;
    }>),
    [mergedRawSkus],
  );

  const COLOUR_LEATHER_MAP = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const sku of mergedRawSkus as any[]) {
      const style = normalizeSpecColourPart(sku.style as string);
      const colour = normalizeSpecColourPart(sku.colour as string);
      const leather = normalizeSpecColourPart((sku.leather as string) ?? "");
      const colour2 = normalizeSpecColourPart((sku.colour2 as string) ?? "");
      const leather2 = normalizeSpecColourPart((sku.leather2 as string) ?? "");
      if (!map[style]) map[style] = {};
      const key = SPEC_COLOUR_KEY_BY_SKU.get(getSpecSkuIdentity(style, colour, leather, colour2, leather2)) ?? colour;
      if (!map[style][key]) {
        map[style][key] = leather
          ? displayColourLeather(colour, leather, style, (sku as any).colour2, (sku as any).leather2)
          : colour;
      }
    }
    return map;
  }, [mergedRawSkus, SPEC_COLOUR_KEY_BY_SKU]);

  // All colour+leather combos (for upper_1 dropdown)
  const ALL_COLOUR_LEATHER_OPTIONS = useMemo(() => {
    const seen = new Set<string>();
    for (const sku of mergedRawSkus as any[]) {
      const colour = sku.colour as string;
      const leather = sku.leather as string;
      if (colour && leather) seen.add(displayColourLeather(colour, leather));
      else if (colour) seen.add(colour);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [mergedRawSkus]);

  // Build toe cap map: style → colour key → toe cap leather
  // Uses the same colour key logic as NEW_COLOURS_PER_STYLE ("COLOUR LEATHER" for multi-leather styles)
  const TOE_CAP_MAP = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const sku of mergedRawSkus as any[]) {
      const toeCap = (sku.toe_cap as string) ?? "";
      if (!toeCap) continue;
      const style = normalizeSpecColourPart(sku.style as string);
      const colour = normalizeSpecColourPart(sku.colour as string);
      const leather = normalizeSpecColourPart((sku.leather as string) ?? "");
      const colour2 = normalizeSpecColourPart((sku.colour2 as string) ?? "");
      const leather2 = normalizeSpecColourPart((sku.leather2 as string) ?? "");
      const key = SPEC_COLOUR_KEY_BY_SKU.get(getSpecSkuIdentity(style, colour, leather, colour2, leather2)) ?? colour;
      if (!map[style]) map[style] = {};
      map[style][key] = toeCap;
    }
    return map;
  }, [mergedRawSkus, SPEC_COLOUR_KEY_BY_SKU]);

  // Build new seasonal columns from the live merged SKU rows. This deliberately
  // uses the same key logic as the rendered Specs grid, so new By Style colours
  // remain visible even if an existing colour uses a different leather.
  const NEW_COLOURS_PER_STYLE = useMemo(() => {
    return buildNewSpecColourColumns(mergedRawSkus as Array<{
      style: string;
      colour: string;
      leather?: string | null;
      colour2?: string | null;
      leather2?: string | null;
      is_new?: boolean;
    }>);
  }, [mergedRawSkus]);

  // Build all active colour columns from live merged raw SKUs. A style with new
  // colours will use its new-only list below; carry-over/core styles use this
  // full active list so a spec can be created or edited for any style.
  const ACTIVE_COLOURS_PER_STYLE = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const sku of mergedRawSkus as any[]) {
      const style = normalizeSpecColourPart(sku.style as string);
      const colour = normalizeSpecColourPart(sku.colour as string);
      const leather = normalizeSpecColourPart((sku.leather as string) ?? "");
      const colour2 = normalizeSpecColourPart((sku.colour2 as string) ?? "");
      const leather2 = normalizeSpecColourPart((sku.leather2 as string) ?? "");
      const key = SPEC_COLOUR_KEY_BY_SKU.get(getSpecSkuIdentity(style, colour, leather, colour2, leather2)) ?? colour;
      const colours = result[style] ?? [];
      if (!colours.includes(key)) colours.push(key);
      result[style] = colours;
    }
    return result;
  }, [mergedRawSkus, SPEC_COLOUR_KEY_BY_SKU]);

  // Build the Specs list from every active style in the current season.
  const baseStyleList = useMemo(() => {
    const allStyles = mergedStyles as Array<typeof skuData.styles[number] & { _isCustomStyle?: boolean }>;
    return allStyles
      .map((s) => {
        const newColours: string[] = NEW_COLOURS_PER_STYLE[s.style] ?? [];
        const activeColours: string[] = ACTIVE_COLOURS_PER_STYLE[s.style] ?? [];
        const specColours = selectSpecColourColumns({ activeColours, newColours });
        return {
          style: s.style,
          last: s.last,
          category: s.category,
          imageUrl: (s as any).imageUrl,
          colours: specColours,
          colourLabels: specColours.map((c) => COLOUR_LEATHER_MAP[s.style]?.[c] ?? c),
          toeCapsPerColour: TOE_CAP_MAP[s.style] ?? {},
          isAllNew: s.isAllNew,
          hasNew: s.hasNew,
          totalSKUs: s.totalSKUs,
          newSKUs: s.newSKUs,
          _isCustomStyle: !!(s as any)._isCustomStyle,
        };
      })
      // Zero-colour custom styles stay available so specs can be prepared before colours are added.
      .filter((s) => s.colours.length > 0 || s._isCustomStyle)
      .sort((a, b) => a.style.localeCompare(b.style));
  }, [mergedStyles, NEW_COLOURS_PER_STYLE, ACTIVE_COLOURS_PER_STYLE, COLOUR_LEATHER_MAP, TOE_CAP_MAP]);

  const utils = trpc.useUtils();
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const activeStyleRef = useRef(selectedStyle);
  activeStyleRef.current = selectedStyle;
  const [search, setSearch] = useState("");
  const [upper2Search, setUpper2Search] = useState("");
  const [emailSpecOpen, setEmailSpecOpen] = useState(false);
  const [specExporting, setSpecExporting] = useState(false);
  const [importParsed, setImportParsed] = useState<ParsedSpecSheet | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importOverwrite, setImportOverwrite] = useState(true);
  const importFileRef = React.useRef<HTMLInputElement>(null);
  // Lifted ref for the spec table's horizontal scroll container — shared with the bottom scrollbar.
  const specTableScrollRef = useRef<HTMLDivElement>(null);
  const specPaneRef = useRef<HTMLDivElement>(null);

  // ── Bulk import state ────────────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const [bulkOverwrite, setBulkOverwrite] = useState(true);

  // Recursively collect all .xls/.xlsx files from a DataTransferItem (folder or file)
  async function collectFilesFromEntry(entry: FileSystemEntry): Promise<File[]> {
    if (entry.isFile) {
      const fe = entry as FileSystemFileEntry;
      if (!fe.name.match(/\.xlsx?$/i)) return [];
      return new Promise<File[]>((resolve) => fe.file((f) => resolve([f]), () => resolve([])));
    }
    if (entry.isDirectory) {
      const de = entry as FileSystemDirectoryEntry;
      const reader = de.createReader();
      const allEntries: FileSystemEntry[] = [];
      await new Promise<void>((resolve) => {
        function readBatch() {
          reader.readEntries((batch) => {
            if (batch.length === 0) { resolve(); return; }
            allEntries.push(...batch);
            readBatch();
          }, () => resolve());
        }
        readBatch();
      });
      const nested = await Promise.all(allEntries.map(collectFilesFromEntry));
      return nested.flat();
    }
    return [];
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const items = Array.from(e.dataTransfer.items);
    const allFiles: File[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        const files = await collectFilesFromEntry(entry);
        allFiles.push(...files);
      } else {
        const f = item.getAsFile();
        if (f && f.name.match(/\.xlsx?$/i)) allFiles.push(f);
      }
    }
    if (allFiles.length > 0) handleBulkImportFiles(allFiles);
  }

  interface BulkImportResult {
    fileName: string;
    styleName: string;
    matchedStyle: string | null;
    colourCount: number;
    valueCount: number;
    status: "pending" | "saving" | "done" | "error" | "unmatched";
    savedCount?: number;
    error?: string;
  }
  const [bulkResults, setBulkResults] = useState<BulkImportResult[]>([]);
  const [bulkParsed, setBulkParsed] = useState<{ result: BulkImportResult; parsed: ParsedSpecSheet }[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  // Manual style mapping for unmatched files: fileName → style
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const bulkFileRef = React.useRef<HTMLInputElement>(null);

  // ── Cancelled styles + cancelled SKUs + custom SKUs ─────────────────────
  const { data: cancelledStylesRaw = [] } = trpc.styles.listCancelled.useQuery({ season });
  const cancelledSet = useMemo(
    () => new Set((cancelledStylesRaw as any[]).map((r: any) => r.style as string)),
    [cancelledStylesRaw]
  );

  // Individually cancelled SKUs (style|colour|leather)
  const { data: cancelledSkusRaw = [] } = trpc.cancelledSku.list.useQuery({ season });

  // useCustomSkus already excludes exact physical cancellations and markdowns.
  // Only style-level cancellations remain; a second display-key cancellation
  // pass would wrongly hide BLACK NAPPA when BLACK SUPRA has been removed.
  const styleList = useMemo(() => {
    return excludeCancelledSpecStyles(baseStyleList, cancelledSet)
      // Keep zero-colour custom styles visible so their library entry is ready
      // before colours are confirmed.
      .filter((s) => s.colours.length > 0 || (s as any)._isCustomStyle);
  }, [baseStyleList, cancelledSet]);

  // The completion queue only applies to styles with new SKU columns. Existing
  // core/carry-over styles remain organised under their normal category.
  const { data: allSpecMeta = [], refetch: refetchAllSpecMeta } = trpc.specs.getAllMeta.useQuery({ season });
  const specStatusByStyle = useMemo(() => new Map(
    (allSpecMeta as Array<{ style: string; specStatus?: SpecCompletionStatus | null }>)
      .map((meta) => [meta.style, meta.specStatus ?? "not_started"]),
  ), [allSpecMeta]);

  const filtered = styleList.filter((s) => matchesSpecsStyleSearchFilters(s, {
    query: search,
    upper2Query: upper2Search,
  }));

  const stylesToComplete = useMemo(
    () => filtered.filter((entry) => isNewSpecStyleAwaitingCompletion({
      newSkus: entry.newSKUs,
      specStatus: specStatusByStyle.get(entry.style),
    })),
    [filtered, specStatusByStyle],
  );
  const stylesToCompleteSet = useMemo(
    () => new Set(stylesToComplete.map((entry) => entry.style)),
    [stylesToComplete],
  );
  const categorisedStyles = useMemo(
    () => filtered.filter((entry) => !stylesToCompleteSet.has(entry.style)),
    [filtered, stylesToCompleteSet],
  );

  const selectedEntryRaw = styleList.find((s) => s.style === selectedStyle) ?? null;

  // ── Hidden columns (per-style, persisted in DB) ───────────────────────────
  const { data: hiddenColumnsData, refetch: refetchHiddenColumns } = trpc.specHiddenColumns.getHidden.useQuery(
    { style: selectedStyle!, season },
    { enabled: !!selectedStyle }
  );
  const hiddenColumnsSet = useMemo(
    () => new Set<string>(hiddenColumnsData?.hidden ?? []),
    [hiddenColumnsData]
  );
  const [showHiddenColumns, setShowHiddenColumns] = useState(false);

  const hideColumnMutation = trpc.specHiddenColumns.hide.useMutation({
    onMutate: async ({ style, colour, season: targetSeason }) => {
      const input = { style, season: targetSeason };
      await utils.specHiddenColumns.getHidden.cancel(input);
      const prev = utils.specHiddenColumns.getHidden.getData(input);
      utils.specHiddenColumns.getHidden.setData(input, (old) => ({
        hidden: [...(old?.hidden ?? []), colour],
      }));
      return { prev };
    },
    onError: (_err, { style, season: targetSeason }, ctx) => {
      if (ctx?.prev !== undefined) utils.specHiddenColumns.getHidden.setData({ style, season: targetSeason }, ctx.prev);
      toast.error("Failed to hide column");
    },
    onSettled: (_data, _err, { style, season: targetSeason }) => {
      utils.specHiddenColumns.getHidden.invalidate({ style, season: targetSeason });
    },
  });

  const showColumnMutation = trpc.specHiddenColumns.show.useMutation({
    onMutate: async ({ style, colour, season: targetSeason }) => {
      const input = { style, season: targetSeason };
      await utils.specHiddenColumns.getHidden.cancel(input);
      const prev = utils.specHiddenColumns.getHidden.getData(input);
      utils.specHiddenColumns.getHidden.setData(input, (old) => ({
        hidden: (old?.hidden ?? []).filter((c) => c !== colour),
      }));
      return { prev };
    },
    onError: (_err, { style, season: targetSeason }, ctx) => {
      if (ctx?.prev !== undefined) utils.specHiddenColumns.getHidden.setData({ style, season: targetSeason }, ctx.prev);
      toast.error("Failed to restore column");
    },
    onSettled: (_data, _err, { style, season: targetSeason }) => {
      utils.specHiddenColumns.getHidden.invalidate({ style, season: targetSeason });
    },
  });

  function handleHideColumn(colour: string) {
    if (!selectedStyle) return;
    hideColumnMutation.mutate({ style: selectedStyle, colour, season });
  }

  function handleShowColumn(colour: string) {
    if (!selectedStyle) return;
    showColumnMutation.mutate({ style: selectedStyle, colour, season });
  }

  // ─── Reset Colour Column ──────────────────────────────────────────────────
  const resetColourMutation = trpc.specs.resetColour.useMutation({
    onSuccess: (_data, { style, colour }) => {
      toast.success(`Cleared all values for ${colour}`);
      // Invalidate both spec values and custom rows
      utils.specs.getForStyle.invalidate({ style });
      utils.specCustomRow.getByStyle.invalidate({ style });
    },
    onError: () => toast.error("Failed to reset column"),
  });

  function handleResetColour(colour: string) {
    if (!selectedStyle) return;
    resetColourMutation.mutate({ style: selectedStyle, colour });
  }
  // ─── Restore Cancelled Colours ────────────────────────────────────────────
  const restoreCancelledSkuMutation = trpc.cancelledSku.restore.useMutation({
    onSuccess: (_data, { colour, leather }) => {
      const label = leather ? `${colour} ${leather}` : colour;
      toast.success(`Restored ${label} — it will now appear in the spec sheet`);
      utils.cancelledSku.list.invalidate();
    },
    onError: () => toast.error("Failed to restore colour"),
  });
  function handleRestoreCancelledColour(style: string, colour: string, leather: string) {
    restoreCancelledSkuMutation.mutate({ style, colour, leather, season });
  }

  // Filter hidden columns from selectedEntry (unless showHiddenColumns is on)
  const selectedEntry = useMemo(() => {
    if (!selectedEntryRaw) return null;
    if (showHiddenColumns || hiddenColumnsSet.size === 0) return selectedEntryRaw;
    const filteredColours: string[] = [];
    const filteredLabels: string[] = [];
    for (let i = 0; i < selectedEntryRaw.colours.length; i++) {
      const colour = selectedEntryRaw.colours[i];
      if (!hiddenColumnsSet.has(colour)) {
        filteredColours.push(colour);
        filteredLabels.push(selectedEntryRaw.colourLabels[i]);
      }
    }
    const filteredToeCaps: Record<string, string> = {};
    for (const colour of filteredColours) {
      if (selectedEntryRaw.toeCapsPerColour[colour]) filteredToeCaps[colour] = selectedEntryRaw.toeCapsPerColour[colour];
    }
    return { ...selectedEntryRaw, colours: filteredColours, colourLabels: filteredLabels, toeCapsPerColour: filteredToeCaps };
  }, [selectedEntryRaw, hiddenColumnsSet, showHiddenColumns]);
  // Match editable custom SKUs to the exact Specs column key. Styles such as
  // TAMMY can have both BLACK NAPPA and BLACK MESH, which must edit separately.
  const editableCustomSkus = useMemo(
    () => buildEditableCustomSkuColumns(
      selectedStyle,
      mergedRawSkus as Array<{ style: string; colour: string; leather: string | null | undefined }>,
      customSkus as Array<{ id: number; style: string; colour: string; leather: string | null | undefined }>,
    ),
    [customSkus, mergedRawSkus, selectedStyle],
  );

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: rawSpecs = [], refetch: refetchSpecs } = trpc.specs.getForStyle.useQuery(
    { style: selectedStyle! },
    { enabled: !!selectedStyle }
  );

  const { data: rawMeta, refetch: refetchMeta } = trpc.specs.getMeta.useQuery(
    { style: selectedStyle!, season },
    { enabled: !!selectedStyle }
  );

  const { data: rawDropdownOptions = [], refetch: refetchDropdowns } = trpc.specs.getAllDropdownOptions.useQuery();

  // Spec counts moved up — see declaration near top of component
  // Spec status for all styles (for sidebar status badges)
  // specStatusMap and allSpecMeta declared near top of component
  // AP21 size ranges for all styles
  const { data: ap21SizeRangeMap = {}, refetch: refetchAp21SizeRanges } = trpc.ap21SizeRange.getAll.useQuery();
  const setAp21SizeRangeMutation = trpc.ap21SizeRange.set.useMutation({
    onSuccess: () => { refetchAp21SizeRanges(); toast.success("AP21 size range saved"); },
    onError: () => toast.error("Failed to save AP21 size range"),
  });
  // AP21 refs — style-level and colour-level reference fields for AP21 export
  const { data: ap21StyleRefsData, refetch: refetchAp21StyleRefs } = trpc.ap21Refs.getStyleRefs.useQuery(
    { style: selectedStyle ?? "" },
    { enabled: !!selectedStyle }
  );
  const { data: ap21ColourRefsData, refetch: refetchAp21ColourRefs } = trpc.ap21Refs.getColourRefs.useQuery(
    { style: selectedStyle ?? "" },
    { enabled: !!selectedStyle }
  );
  const upsertAp21StyleRefsMutation = trpc.ap21Refs.upsertStyleRefs.useMutation({
    onSuccess: () => { refetchAp21StyleRefs(); toast.success("AP21 style refs saved"); },
    onError: () => toast.error("Failed to save AP21 style refs"),
  });
  const upsertAp21ColourRefsMutation = trpc.ap21Refs.upsertColourRefs.useMutation({
    onSuccess: () => { refetchAp21ColourRefs(); toast.success("AP21 colour refs saved"); },
    onError: () => toast.error("Failed to save AP21 colour refs"),
  });
  const [showAp21RefsPanel, setShowAp21RefsPanel] = useState(false);
  // ── Derived data ──────────────────────────────────────────────────────────
  // specs: colour → component → value
  const specs: Record<string, Record<string, string>> = {};
  for (const row of rawSpecs) {
    const colourKey = normalizeStoredSpecColourKey(row.colour);
    if (!specs[colourKey]) specs[colourKey] = {};
    specs[colourKey][row.component] = row.value ?? "";
  }

  // allDropdownOptions: component → string[]
  const allDropdownOptions: Record<string, string[]> = {};
  // allDropdownOptionIds: component → { value: id } for edit support
  const allDropdownOptionIds: Record<string, Record<string, number>> = {};
  for (const opt of rawDropdownOptions) {
    // Normalise component key to lowercase so custom row suggestions are found
    // regardless of title case (e.g. "custom:WEDGE NAME" === "custom:wedge name")
    const normKey = opt.component.startsWith('custom:') ? opt.component.toLowerCase() : opt.component;
    if (!allDropdownOptions[normKey]) allDropdownOptions[normKey] = [];
    allDropdownOptions[normKey].push(opt.value);
    if (!allDropdownOptionIds[normKey]) allDropdownOptionIds[normKey] = {};
    allDropdownOptionIds[normKey][opt.value] = opt.id;
  }

  const specMeta = rawMeta
    ? {
        hasBuckle: rawMeta.hasBuckle ?? false,
        dressShoeSubType: rawMeta.dressShoeSubType as "court" | "sling" | null ?? null,
        notes: rawMeta.notes ?? null,
        specStatus: ((rawMeta as any).specStatus ?? "not_started") as "not_started" | "in_progress" | "complete",
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

  // ── Custom rows ──────────────────────────────────────────────────────────
  // Ref to SpecForm's localRowKeys setter — registered via onRegisterReplaceRowKey.
  // Used to swap temp/old row keys for real/new ones after mutations.
  // The registered function is provided by SpecForm and handles the case where
  // localRowKeys is null (no saved order) by initialising from unifiedRowIds first.
  const replaceRowKeySetterRef = useRef<((oldKey: string, newKey: string) => void) | null>(null);
  function swapLocalRowKey(oldKey: string, newKey: string) {
    replaceRowKeySetterRef.current?.(oldKey, newKey);
  }
  // Never let an unmounting/previous style provide the next style's export layout.
  const getRowKeysRef = useRef<RegisteredSpecRowLayout | null>(null);
  function getCurrentStyleRowKeys() {
    return getRowKeysRef.current?.style === selectedStyle ? getRowKeysRef.current.read() : null;
  }
  function getExportRowKeys(style: string) {
    return getLatestSpecExportLayout({
      style,
      readLocal: () => getRowKeysRef.current,
      waitForSaves: () => enqueueSpecRowSave(style, async () => undefined),
      loadSaved: async () => (await utils.specRowOrder.get.fetch({ style }, { staleTime: 0 })).rowKeys,
    });
  }
  const updateRowKeysRef = useRef<((update: (keys: string[]) => string[]) => Promise<void>) | null>(null);

  const { data: rawCustomRows = [], refetch: refetchCustomRows } = trpc.specCustomRow.getByStyle.useQuery(
    { style: selectedStyle! },
    { enabled: !!selectedStyle }
  );

  // ── Row order (for export — mirrors what SpecForm uses internally) ────────
  const { data: exportRowOrderData } = trpc.specRowOrder.get.useQuery(
    { style: selectedStyle! },
    { enabled: !!selectedStyle }
  );

  // All known custom row titles (for autocomplete) — derived from current style's rows
  const allCustomRowTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const row of rawCustomRows as any[]) {
      if (row.title) titles.add(row.title);
    }
    return Array.from(titles).sort();
  }, [rawCustomRows]);

  // Cancelled SKUs for the currently selected style (for restore panel)
  const cancelledSkusForCurrentStyle = useMemo(() => {
    if (!selectedStyle) return [];
    return (cancelledSkusRaw as Array<{ style: string; colour: string; leather: string }>)
      .filter((r) => r.style === selectedStyle);
  }, [cancelledSkusRaw, selectedStyle]);

  const [customRowIdentityTracker] = useState(createSpecCustomRowIdentityTracker);
  const renameCustomRowMutation = trpc.specCustomRow.rename.useMutation({
    onSuccess: (rows, vars) => {
      const renamedIds = new Set(rows.map(row => row.id));
      utils.specCustomRow.getByStyle.setData({ style: vars.style }, old =>
        old?.map(row => renamedIds.has(row.id) ? { ...row, title: vars.title } : row)
      );
    },
    onSettled: (_data, _error, vars) => {
      utils.specCustomRow.getByStyle.invalidate({ style: vars.style });
    },
  });
  function handleRenameCustomRow(id: number, title: string) {
    if (!selectedStyle) return;
    const style = selectedStyle;
    void enqueueSpecRowSave(style, async () => {
      const savedId = await customRowIdentityTracker.resolveId(id);
      await renameCustomRowMutation.mutateAsync({ id: savedId, style, title });
    }).catch(error => toast.error(`Could not save component name: ${error.message}`));
  }
  const addCustomRowMutation = trpc.specCustomRow.upsert.useMutation({
    onMutate: async (newRow) => {
      // Optimistic update: immediately add a placeholder row to the cache
      await utils.specCustomRow.getByStyle.cancel({ style: newRow.style });
      const prev = utils.specCustomRow.getByStyle.getData({ style: newRow.style });
      const tempId = customRowIdentityTracker.create();
      utils.specCustomRow.getByStyle.setData({ style: newRow.style }, (old) => [
        ...(old ?? []),
        { id: tempId, style: newRow.style, colour: newRow.colour ?? "__all__", section: newRow.section, title: newRow.title, value: newRow.value ?? "", sortOrder: newRow.sortOrder ?? 0, createdAt: new Date(), updatedAt: new Date() },
      ]);
      return { prev, tempId };
    },
    onSuccess: (realRow, vars, ctx) => {
      // Swap the temp key for the real key in SpecForm's localRowKeys so dragged
      // position is preserved after the server responds with the actual row id.
      const tempId = ctx?.tempId;
      if (tempId !== undefined && realRow?.id) {
        customRowIdentityTracker.saved(tempId, realRow.id);
        utils.specCustomRow.getByStyle.setData({ style: vars.style }, old =>
          old?.map(row => row.id === tempId ? realRow : row)
        );
      }
      if (vars.style === selectedStyle && tempId !== undefined && realRow?.id && realRow.id !== tempId) {
        swapLocalRowKey(`c:${tempId}`, `c:${realRow.id}`);
      }
    },
    onError: (_err, newRow, ctx) => {
      if (ctx?.tempId !== undefined) customRowIdentityTracker.failed(ctx.tempId, new Error("New component could not be added"));
      if (ctx?.prev !== undefined) utils.specCustomRow.getByStyle.setData({ style: newRow.style }, ctx.prev);
      toast.error("Failed to add custom row");
    },
    onSettled: (_data, _err, newRow) => {
      utils.specCustomRow.getByStyle.invalidate({ style: newRow.style });
    },
  });
  const deleteGroupMutation = trpc.specCustomRow.deleteGroup.useMutation({
    onMutate: async ({ style, section, title }) => {
      if (!selectedStyle) return;
      await utils.specCustomRow.getByStyle.cancel({ style: selectedStyle });
      const prev = utils.specCustomRow.getByStyle.getData({ style: selectedStyle });
      // Optimistically remove ALL rows for this style+section+title group
      utils.specCustomRow.getByStyle.setData({ style: selectedStyle }, (old) =>
        old ? old.filter((r) => !(r.style === style && r.section === section && r.title === title)) : old
      );
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev !== undefined && selectedStyle) {
        utils.specCustomRow.getByStyle.setData({ style: selectedStyle }, ctx.prev);
      }
      toast.error("Failed to delete custom row");
    },
    onSettled: () => {
      if (selectedStyle) utils.specCustomRow.getByStyle.invalidate({ style: selectedStyle });
    },
  });

  function handleAddCustomRow(section: string, afterSortOrder?: number) {
    if (!selectedStyle) return;
    const sectionRows = rawCustomRows.filter((r: any) => r.section === section);
    // If afterSortOrder is provided, insert after that position (shift later rows up)
    let nextOrder: number;
    if (afterSortOrder !== undefined) {
      // Insert after the row with this sortOrder: use afterSortOrder + 0.5 then renormalize
      nextOrder = afterSortOrder + 0.5;
    } else {
      nextOrder = sectionRows.length;
    }
    addCustomRowMutation.mutate({
      style: selectedStyle,
      colour: "__all__",
      section,
      title: "",
      value: "",
      sortOrder: nextOrder,
    });
  }

  function handleDeleteCustomRow(id: number) {
    if (!selectedStyle) return;
    // Find the representative row to get its section and title
    const repRow = rawCustomRows.find((r: any) => r.id === id) as any;
    if (!repRow) return;
    // Delete ALL rows for this style+section+title group (handles both __all__ and per-colour rows)
    deleteGroupMutation.mutate({ style: selectedStyle, section: repRow.section, title: repRow.title });
  }

  const upsertForColourMutation = trpc.specCustomRow.upsertForColour.useMutation({
    onSuccess: (result, vars) => {
      utils.specCustomRow.getByStyle.setData({ style: vars.style }, old => {
        const changedIds = new Set(result.rows.map(row => row.id));
        return [...(old ?? []).filter(row => !changedIds.has(row.id)), ...result.rows];
      });
      utils.specCustomRow.getByStyle.invalidate({ style: vars.style });
    },
    onError: () => toast.error("Failed to save spec value"),
  });

  const bulkCopyFromStyleMutation = trpc.specCustomRow.bulkCopyFromStyle.useMutation({
    onSettled: (_data, _err, vars) => {
      utils.specCustomRow.getByStyle.invalidate({ style: vars.targetStyle });
    },
    onError: () => toast.error("Failed to copy custom rows"),
  });

  // Separate mutation to update rowKeys after a colour explosion (used by upsertForColourMutation)
  const upsertRowOrderForColourExplosionMutation = trpc.specRowOrder.upsert.useMutation({
    onSettled: (_data, _err, vars) => {
      utils.specRowOrder.get.invalidate({ style: vars.style });
    },
  });

  function handleUpdateCustomRowForColour(
    representativeId: number,
    title: string,
    colour: string,
    newValue: string,
    currentSharedValue: string,
    section: string,
    sortOrder: number
  ) {
    if (!selectedStyle) return;
    // Use section and sortOrder passed directly from the component (avoids rawCustomRows timing issues)
    const style = selectedStyle;
    const allColours = (selectedEntryRaw?.colourLabels ?? selectedEntry?.colourLabels ?? []).map(normalizeStoredSpecColourKey);
    void enqueueSpecRowSave(style, async () => upsertForColourMutation.mutateAsync({
      allRowId: await customRowIdentityTracker.resolveId(representativeId),
      style,
      section,
      title,
      sortOrder,
      targetColour: normalizeStoredSpecColourKey(colour),
      newValue,
      currentSharedValue,
      // Retained for API compatibility. Persist one exact override, not a conversion
      // of shared rows into only the colours that happen to be visible this season.
      allColours,
    })).catch(error => toast.error(`Could not save component value: ${error.message}`));
  }

  const batchReorderMutation = trpc.specCustomRow.batchReorderCustomRows.useMutation({
    onMutate: async ({ orderedIds }) => {
      if (!selectedStyle) return;
      // Optimistic update: reorder the cache immediately so the UI doesn't snap back
      await utils.specCustomRow.getByStyle.cancel({ style: selectedStyle });
      const prev = utils.specCustomRow.getByStyle.getData({ style: selectedStyle });
      utils.specCustomRow.getByStyle.setData({ style: selectedStyle }, (old) => {
        if (!old) return old;
        // Assign new sortOrder based on orderedIds array position
        const orderMap = Object.fromEntries(orderedIds.map((id, idx) => [id, idx]));
        return old
          .map((r) => (orderMap[r.id] !== undefined ? { ...r, sortOrder: orderMap[r.id] } : r))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev !== undefined && selectedStyle) {
        utils.specCustomRow.getByStyle.setData({ style: selectedStyle }, ctx.prev);
      }
      toast.error("Failed to reorder rows");
    },
    onSettled: () => {
      if (selectedStyle) utils.specCustomRow.getByStyle.invalidate({ style: selectedStyle });
    },
  });
  function handleReorderCustomRows(_section: string, orderedIds: number[]) {
    if (!selectedStyle) return;
    batchReorderMutation.mutate({ orderedIds });
  }

  // ── Style category (DB-stored, overrides static skuData category) ──────────
  const { data: allStyleMeta = [] } = trpc.style.getAll.useQuery();
  const styleMetaMap = useMemo(
    () => Object.fromEntries(allStyleMeta.map((m: any) => [m.style, m])),
    [allStyleMeta]
  );
  const dbCategory: string | null = selectedStyle ? (styleMetaMap[selectedStyle]?.category ?? null) : null;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const upsertMutation = trpc.specs.upsert.useMutation({
    onMutate: async (input) => {
      // Optimistic update: immediately update the local cache so the UI doesn't wait for the server
      await utils.specs.getForStyle.cancel({ style: input.style });
      const prev = utils.specs.getForStyle.getData({ style: input.style });
      utils.specs.getForStyle.setData({ style: input.style }, (old) => {
        if (!old) return old;
        const existing = old.find((r) => r.colour === input.colour && r.component === input.component);
        if (existing) {
          return old.map((r) =>
            r.colour === input.colour && r.component === input.component
              ? { ...r, value: input.value }
              : r
          );
        }
        return [
          ...old,
          { id: -Date.now(), style: input.style, colour: input.colour, component: input.component, value: input.value, updatedAt: new Date(), season: "SS26" },
        ];
      });
      return { prev };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.prev !== undefined) utils.specs.getForStyle.setData({ style: input.style }, ctx.prev);
      toast.error("Failed to save spec value");
    },
    onSettled: (_data, _err, input) => {
      // Quietly sync in background — no blocking refetch
      utils.specs.getForStyle.invalidate({ style: input.style });
      utils.specs.getAllMeta.invalidate({ season: input.season });
    },
  });

  const bulkUpsertMutation = trpc.specs.bulkUpsert.useMutation({
    onSuccess: (data, input) => {
      // Invalidate specs for all affected styles
      const stylesSet = new Set(input.rows.map((r) => r.style));
      const styles = Array.from(stylesSet);
      for (const style of styles) {
        utils.specs.getForStyle.invalidate({ style });
      }
    },
    onError: () => toast.error("Bulk import failed"),
  });

  const addCustomSkuMutation = trpc.customSku.add.useMutation({
    onSuccess: (_data, vars) => {
      utils.customSku.getAll.invalidate();
      utils.specHiddenColumns.getHidden.invalidate({ style: vars.style, season: vars.season });
      utils.cancelledSku.list.invalidate({ season: vars.season });
      utils.specs.getAllMeta.invalidate({ season: vars.season });
      toast.success("Colour added to spec sheet");
    },
    onError: () => toast.error("Failed to add colour"),
  });

  function handleAddSku(colour: string, leather: string) {
    if (!selectedStyle) return;
    addCustomSkuMutation.mutate({ style: selectedStyle, colour, leather, season });
  }
  const updateCustomSkuMutation = trpc.customSku.update.useMutation({
    onSuccess: () => {
      utils.customSku.getAll.invalidate();
      toast.success('Colour updated');
    },
    onError: () => toast.error('Failed to update colour'),
  });
  function handleEditSku(id: number, colour: string, leather: string) {
    updateCustomSkuMutation.mutate({ id, colour, leather });
  }

  const addDropdownMutation = trpc.specs.addDropdownOption.useMutation({
    onSuccess: () => refetchDropdowns(),
    onError: () => toast.error("Failed to add dropdown option"),
  });

  const deleteDropdownMutation = trpc.specs.deleteDropdownOptionByValue.useMutation({
    onSuccess: () => refetchDropdowns(),
    onError: () => toast.error("Failed to remove dropdown option"),
  });

  const updateDropdownMutation = trpc.specs.updateDropdownOption.useMutation({
    onSuccess: () => refetchDropdowns(),
    onError: () => toast.error("Failed to update dropdown option"),
  });

  const upsertMetaMutation = trpc.specs.upsertMeta.useMutation({
    onSuccess: () => refetchMeta(),
    onError: () => toast.error("Failed to save style settings"),
  });
  const setSpecStatusMutation = trpc.specs.setStatus.useMutation({
    onSuccess: (_data, input) => {
      refetchMeta();
      refetchAllSpecMeta();
      toast.success(input.status === "complete" ? "New SKU specs marked complete" : "New SKU specs ready to complete");
    },
    onError: () => toast.error("Failed to update Specs completion status"),
  });

  function handleUpsert(colour: string, component: string, value: string) {
    if (!selectedStyle) return;
    // Pass colours + rowKeys so server can auto-check completion status
    const colours = (selectedEntry?.colours ?? []).map(normalizeStoredSpecColourKey);
    const rowKeys = getCurrentStyleRowKeys() ?? exportRowOrderData?.rowKeys ?? [];
    upsertMutation.mutate(
      { style: selectedStyle, colour: normalizeStoredSpecColourKey(colour), component, value, colours, rowKeys, season },
      {
        onSettled: () => {
          // Refresh status after save (server may have auto-promoted to complete)
          refetchMeta();
        },
      }
    );
  }
  // Batch auto-fill: sends all auto-fill rows in a single bulk upsert to avoid 502s from simultaneous mutations
  function handleBulkAutoFill(rows: Array<{ style: string; colour: string; component: string; value: string }>) {
    if (rows.length === 0) return;
    bulkUpsertMutation.mutate(
      { rows: rows.map((row) => ({ ...row, colour: normalizeStoredSpecColourKey(row.colour) })), overwrite: false },
      {
        onSuccess: () => {
          utils.specs.getForStyle.invalidate({ style: rows[0].style });
        },
      }
    );
  }

  // Bulk copy: same as auto-fill but with overwrite: true so existing values are replaced
  async function handleBulkCopy(rows: Array<{ style: string; colour: string; component: string; value: string }>) {
    if (rows.length === 0) return;
    await bulkUpsertMutation.mutateAsync({ rows: rows.map((row) => ({ ...row, colour: normalizeStoredSpecColourKey(row.colour) })), overwrite: true });
    await utils.specs.getForStyle.invalidate({ style: rows[0].style });
  }

  function handleAddDropdownOption(component: string, value: string) {
    addDropdownMutation.mutate({ component, value });
  }

  function handleDeleteDropdownOption(component: string, value: string) {
    deleteDropdownMutation.mutate({ component, value });
  }

  function handleEditDropdownOption(id: number, newValue: string) {
    updateDropdownMutation.mutate({ id, value: newValue });
  }

  function handleMetaChange(patch: Partial<{ hasBuckle: boolean; dressShoeSubType: "court" | "sling" | null; notes: string | null }>) {
    if (!selectedStyle) return;
    // Comments are already locally debounced by SpecCommentsEditor, while
    // other style settings should save immediately.
    upsertMetaMutation.mutate({ style: selectedStyle, season, ...patch });
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

  /** Build rows for bulk upsert from a parsed spec sheet */
  function buildBulkRows(
    parsed: ParsedSpecSheet,
    targetStyle: string
  ): { style: string; colour: string; component: string; value: string }[] {
    const styleColourMap = COLOUR_LEATHER_MAP[targetStyle] ?? {};
    const labelToRawColour: Record<string, string> = {};
    for (const [rawColour, label] of Object.entries(styleColourMap)) {
      labelToRawColour[label.toUpperCase()] = rawColour;
      labelToRawColour[rawColour.toUpperCase()] = rawColour;
    }
    const rows: { style: string; colour: string; component: string; value: string }[] = [];
    for (const [importedColour, compMap] of Object.entries(parsed.colourSpecs)) {
      const rawColour = labelToRawColour[importedColour.toUpperCase()] ?? importedColour;
      for (const [component, value] of Object.entries(compMap)) {
        if (!value.trim()) continue;
        rows.push({ style: targetStyle, colour: rawColour, component, value });
      }
    }
    return rows;
  }

  async function handleSaveImport() {
    if (!importParsed || !selectedStyle) return;
    setImportSaving(true);
    try {
      const rows = buildBulkRows(importParsed, selectedStyle);
      const result = await bulkUpsertMutation.mutateAsync({ rows, overwrite: importOverwrite });
      if (importParsed.comments.trim()) {
        await upsertMetaMutation.mutateAsync({ style: selectedStyle, season, notes: importParsed.comments.trim() });
      }
      toast.success(`Imported ${result.count} spec values for ${selectedStyle}${importParsed.comments.trim() ? " and saved Comments" : ""}`);
      setImportParsed(null);
    } catch {
      toast.error("Failed to save imported specs");
    } finally {
      setImportSaving(false);
    }
  }

  // ── Bulk import handlers ─────────────────────────────────────────────────
  async function handleBulkImportFiles(files: File[] | FileList) {
    setBulkLoading(true);
    setBulkResults([]);
    setBulkParsed([]);
    setManualMappings({});
    setShowBulkModal(true);
    const items: { result: BulkImportResult; parsed: ParsedSpecSheet }[] = [];
    const results: BulkImportResult[] = [];
    const fileArray = Array.from(files);
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const parsed = await parseSpecSheetFile(file);
        const matchedEntry = styleList.find(
          (s) => s.style.toLowerCase() === parsed.styleName.toLowerCase()
        );
        // Count total non-empty values
        let valueCount = 0;
        for (const compMap of Object.values(parsed.colourSpecs)) {
          for (const v of Object.values(compMap)) {
            if (v.trim()) valueCount++;
          }
        }
        const result: BulkImportResult = {
          fileName: file.name,
          styleName: parsed.styleName,
          matchedStyle: matchedEntry ? matchedEntry.style : null,
          colourCount: Object.keys(parsed.colourSpecs).length,
          valueCount,
          status: matchedEntry ? "pending" : "unmatched",
        };
        results.push(result);
        items.push({ result, parsed });
      } catch (e) {
        results.push({
          fileName: file.name,
          styleName: "?",
          matchedStyle: null,
          colourCount: 0,
          valueCount: 0,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    setBulkResults(results);
    setBulkParsed(items);
    setBulkLoading(false);
  }

  async function handleBulkSave() {
    setBulkSaving(true);
    const updatedResults = [...bulkResults];
    // Process all pending files (including those with manual mappings)
    for (const item of bulkParsed) {
      const effectiveStyle = item.result.matchedStyle ?? manualMappings[item.result.fileName] ?? null;
      if (!effectiveStyle) continue;
      const idx = updatedResults.findIndex((r) => r.fileName === item.result.fileName);
      if (idx === -1) continue;
      updatedResults[idx] = { ...updatedResults[idx], status: "saving", matchedStyle: effectiveStyle };
      setBulkResults([...updatedResults]);
      try {
        const rows = buildBulkRows(item.parsed, effectiveStyle);
        const result = await bulkUpsertMutation.mutateAsync({ rows, overwrite: bulkOverwrite });
        if (item.parsed.comments.trim()) {
          await upsertMetaMutation.mutateAsync({ style: effectiveStyle, season, notes: item.parsed.comments.trim() });
        }
        updatedResults[idx] = { ...updatedResults[idx], status: "done", savedCount: result.count };
        setBulkResults([...updatedResults]);
      } catch (e) {
        updatedResults[idx] = { ...updatedResults[idx], status: "error", error: e instanceof Error ? e.message : String(e) };
        setBulkResults([...updatedResults]);
      }
    }
    setBulkSaving(false);
    const doneCount = updatedResults.filter((r) => r.status === "done").length;
    const totalSaved = updatedResults.reduce((sum, r) => sum + (r.savedCount ?? 0), 0);
    const errCount = updatedResults.filter((r) => r.status === "error").length;
    toast.success(`Bulk import complete: ${doneCount} style${doneCount !== 1 ? "s" : ""} saved (${totalSaved} values)${errCount > 0 ? `, ${errCount} errors` : ""}`);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: style list */}
      <div className="w-64 flex-shrink-0 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Style, last or Upper 1…"
                aria-label="Search style, last, category or Upper 1"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wide text-purple-700">U2</span>
              <Input
                value={upper2Search}
                onChange={(e) => setUpper2Search(e.target.value)}
                placeholder="Filter by Upper 2…"
                aria-label="Filter results by Upper 2"
                title="Use with Upper 1 to find the exact two-upper SKU"
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          {(search || upper2Search) && (
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Upper 1 + Upper 2 match the same SKU.
            </p>
          )}
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {styleList.length} styles
            </p>
            {stylesToComplete.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-300 bg-amber-50 text-amber-800">
                {stylesToComplete.length} to complete
              </Badge>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const categories = new Map<string, StyleEntry[]>();
            for (const entry of categorisedStyles) {
              const category = entry.category?.trim() || "Uncategorised";
              const entries = categories.get(category) ?? [];
              entries.push(entry);
              categories.set(category, entries);
            }
            const categoryGroups = Array.from(categories.entries())
              .sort(([a], [b]) => a.localeCompare(b));

            function StyleRow({ entry }: { entry: StyleEntry }) {
              const isSelected = selectedStyle === entry.style;
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
                      {entry.newSKUs > 0 && (
                        <Badge className="h-4 px-1 text-[9px] font-medium bg-amber-100 text-amber-800 hover:bg-amber-100">
                          {entry.newSKUs} new
                        </Badge>
                      )}
                      {entry.isAllNew && entry.newSKUs === 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title="New pattern" />
                      )}
                    </div>
                  </div>
                </button>
              );
            }

            return (
              <>
                {stylesToComplete.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide bg-amber-100/80 text-amber-900 border-y border-amber-200 flex items-center justify-between">
                      <span>To Be Completed</span>
                      <span className="font-normal">{stylesToComplete.length}</span>
                    </div>
                    <div className="border-b border-amber-200/80 bg-amber-50/30">
                      {stylesToComplete.map((entry) => <StyleRow key={entry.style} entry={entry} />)}
                    </div>
                  </>
                )}
                {categoryGroups.map(([category, entries]) => (
                  <React.Fragment key={category}>
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide bg-muted/30 border-b flex items-center justify-between">
                      <span>{category}</span>
                      <span className="text-muted-foreground font-normal">{entries.length}</span>
                    </div>
                    {entries.map((entry) => <StyleRow key={entry.style} entry={entry} />)}
                  </React.Fragment>
                ))}

                {filtered.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">No styles match "{search}"</div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Right: spec form */}
      <div ref={specPaneRef} className="flex-1 overflow-hidden flex flex-col">
        {!selectedEntry ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">Select a style to view its spec sheet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {styleList.length} styles in the library this season
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Sticky top: Import/Export buttons + import banner */}
            <div className="flex-shrink-0 p-6 pb-2 space-y-4">
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
              <div className="flex justify-end gap-2">
                {selectedEntry.newSKUs > 0 && specMeta?.specStatus !== "complete" && (
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={setSpecStatusMutation.isPending}
                    onClick={() => {
                      if (!selectedStyle) return;
                      setSpecStatusMutation.mutate({
                        style: selectedStyle,
                        status: "complete",
                        season,
                      });
                    }}
                  >
                    <Check className="w-4 h-4" /> Mark New SKU Specs Complete
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setEmailSpecOpen(true)}
                >
                  <Mail className="w-4 h-4" />
                  Send by Email
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={specExporting}
                  onClick={async () => {
                    setSpecExporting(true);
                    try {
                      const rowKeys = await getExportRowKeys(selectedEntry.style);
                      await exportSpecSheet({
                        style: selectedEntry.style,
                        last: selectedEntry.last,
                        category: dbCategory ?? selectedEntry.category,
                        season: getSeasonDisplayLabel(season),
                        // Export uses the unfiltered entry so hidden columns are still exported
                        colours: selectedEntryRaw?.colours ?? selectedEntry.colours,
                        colourLabels: selectedEntryRaw?.colourLabels ?? selectedEntry.colourLabels,
                        specs,
                        hasBuckle: specMeta?.hasBuckle ?? false,
                        dressShoeSubType: specMeta?.dressShoeSubType ?? null,
                        imageUrl: imageOverrides[selectedEntry.style] ?? selectedEntry.imageUrl,
                        customRows: rawCustomRows as any[],
                        // Use the latest saved/local row order, including explicit hidden rows.
                        rowKeys,
                        comments: specMeta?.notes ?? null,
                      });
                      // Export is the hand-off point for a new SKU spec sheet.
                      // Only a successfully generated workbook completes the hand-off.
                      if (selectedEntry.newSKUs > 0 && specMeta?.specStatus !== "complete") {
                        setSpecStatusMutation.mutate({ style: selectedEntry.style, status: "complete", season });
                        toast.success(`Exported ${selectedEntry.style} and marked its new SKU specs complete`);
                      } else {
                        toast.success(`Exported ${selectedEntry.style} spec sheet`);
                      }
                    } catch (error) {
                      toast.error(`Could not export spec sheet: ${error instanceof Error ? error.message : "Please retry"}`);
                    } finally {
                      setSpecExporting(false);
                    }
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {specExporting ? "Exporting…" : "Export to Excel"}
                </Button>
              </div>
            </div>
            <EmailSpecDialog
              open={emailSpecOpen}
              onOpenChange={setEmailSpecOpen}
              style={selectedEntry.style}
              last={selectedEntry.last}
              category={selectedEntry.category}
              season={getSeasonDisplayLabel(season)}
              defaultSubject={`${selectedEntry.style.toUpperCase()} — TONY BIANCO DEV WINTER 2027`}
              buildAttachment={async () => buildSpecSheetAttachment({
                style: selectedEntry.style,
                last: selectedEntry.last,
                category: dbCategory ?? selectedEntry.category,
                season: getSeasonDisplayLabel(season),
                // The attachment includes all columns, including those temporarily hidden in the editor.
                colours: selectedEntryRaw?.colours ?? selectedEntry.colours,
                colourLabels: selectedEntryRaw?.colourLabels ?? selectedEntry.colourLabels,
                specs,
                hasBuckle: specMeta?.hasBuckle ?? false,
                dressShoeSubType: specMeta?.dressShoeSubType ?? null,
                imageUrl: imageOverrides[selectedEntry.style] ?? selectedEntry.imageUrl,
                customRows: rawCustomRows as any[],
                rowKeys: await getExportRowKeys(selectedEntry.style),
                comments: specMeta?.notes ?? null,
              })}
              onSent={() => {
                // Sending is also a completed hand-off for a new SKU Specs sheet.
                if (selectedEntry.newSKUs > 0 && specMeta?.specStatus !== "complete") {
                  setSpecStatusMutation.mutate({ style: selectedEntry.style, status: "complete", season });
                }
              }}
            />
            {/* The product image is intentionally centred beneath the toolbar so
                it can display the full shoe instead of being cropped into the
                small style header thumbnail. */}
            <div className="grid min-h-40 grid-cols-1 items-center gap-4 lg:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)]">
              <div className="space-y-4 self-start">
                {/* AP21 size range selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">AP21 Size Range:</span>
                  <Select
                    value={(ap21SizeRangeMap as Record<string, string>)[selectedStyle ?? ""] ?? "AU5-11"}
                    onValueChange={(val) => {
                      if (!selectedStyle) return;
                      setAp21SizeRangeMutation.mutate({ style: selectedStyle, sizeRange: val as any });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-36 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AU5-11" className="text-xs">AU 5–11 (half sizes)</SelectItem>
                      <SelectItem value="AU6-9" className="text-xs">AU 6–9 (half sizes)</SelectItem>
                      <SelectItem value="AU5-10" className="text-xs">AU 5–10 (full sizes)</SelectItem>
                      <SelectItem value="EU35-42" className="text-xs">EU 35–42</SelectItem>
                      <SelectItem value="EU35-41" className="text-xs">EU 36–41</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* AP21 Refs panel toggle */}
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAp21RefsPanel((v) => !v)}
                  >
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAp21RefsPanel ? "rotate-90" : ""}`} />
                    <span className="font-medium">AP21 Reference Fields</span>
                    {ap21StyleRefsData && Object.values(ap21StyleRefsData).some(v => v && typeof v === 'string' && v.length > 0) && (
                      <span className="text-xs text-green-600 dark:text-green-400">✓ saved</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="mx-auto h-40 w-full max-w-60 overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
                {(imageOverrides[selectedEntry.style] ?? selectedEntry.imageUrl) ? (
                  <img
                    src={imageOverrides[selectedEntry.style] ?? selectedEntry.imageUrl}
                    alt={`${selectedEntry.style} product reference`}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                    No product image yet
                  </div>
                )}
              </div>
              <div className="hidden lg:block" aria-hidden="true" />
            </div>
            {showAp21RefsPanel && selectedStyle && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                {/* Style-level refs */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Style References (Ref2–Ref14)</p>
                  {/* Ref3 Sub-category selector — also auto-determines Ref2 Division */}
                  <div className="mb-3">
                    <label className="text-xs text-muted-foreground block mb-1">Ref3 — Sub-category <span className="text-red-400">*</span> (also sets Ref2 Division)</label>
                    <select
                      className="h-7 text-xs w-full rounded-md border border-input bg-background px-2 py-0.5"
                      value={ap21StyleRefsData?.subCategory ?? ""}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        if (!selectedStyle) return; upsertAp21StyleRefsMutation.mutate({ style: selectedStyle, subCategory: val });
                      }}
                    >
                      <option value="">-- select sub-category --</option>
                      <optgroup label="Dress">
                        <option value="Dress Shoe">Dress Shoe</option>
                        <option value="Dress Sandal">Dress Sandal</option>
                      </optgroup>
                      <optgroup label="Casual">
                        <option value="Casual Shoe">Casual Shoe</option>
                        <option value="Casual Flat">Casual Flat</option>
                      </optgroup>
                      <optgroup label="Sandals">
                        <option value="Casual Sandal">Casual Sandal</option>
                        <option value="Flat Sandal">Flat Sandal</option>
                      </optgroup>
                      <optgroup label="Boots">
                        <option value="Dress Boot Ankle">Dress Boot Ankle</option>
                        <option value="Casual Boot Ankle">Casual Boot Ankle</option>
                        <option value="Dress Boot Calf">Dress Boot Calf</option>
                        <option value="Casual Boot Calf">Casual Boot Calf</option>
                        <option value="Dress Boot Long">Dress Boot Long</option>
                        <option value="Casual Boot Long">Casual Boot Long</option>
                      </optgroup>
                      <optgroup label="Wedges">
                        <option value="Dress Wedge">Dress Wedge</option>
                        <option value="Casual Wedge">Casual Wedge</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {([
                      { key: 'rangeType', label: 'Ref4 — Range Type', placeholder: 'e.g. Core, Fashion' },
                      { key: 'toeShape', label: 'Ref8 — Toe Shape', placeholder: 'e.g. Open, Closed, Peep' },
                      { key: 'upperHeight', label: 'Ref9 — Upper Height', placeholder: 'e.g. Ankle, Calf' },
                      { key: 'countryOfOrigin', label: 'Ref12 — Country of Origin', placeholder: 'e.g. China' },
                      { key: 'supplier', label: 'Ref13 — Supplier', placeholder: 'Factory name' },
                      { key: 'hsCode', label: 'Ref14 — HS Code', placeholder: 'HS code / barcode prefix' },
                      { key: 'season', label: 'Season (default for ColourRef4)', placeholder: 'e.g. Summer 2026' },
                    ] as { key: keyof typeof ap21StyleRefsData; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{label}</label>
                        <Input
                          className="h-7 text-xs"
                          placeholder={placeholder}
                          defaultValue={(ap21StyleRefsData as any)?.[key] ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value.trim() || null;
                            if (!selectedStyle) return; upsertAp21StyleRefsMutation.mutate({ style: selectedStyle, [key]: val });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <span className="font-medium">Auto-filled constants:</span> Ref1=Footwear, Ref2=Division (derived from Ref3), Ref5=Tony Bianco, Ref6=Last, Ref7=Heel Height, Ref10=Product, Ref11=FG
                  </p>
                </div>
                {/* Per-colour refs */}
                {selectedEntry && selectedEntry.colours.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Colour References (ColourRef1–ColourRef10) — per colour</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1 pr-3 text-muted-foreground font-medium w-32">Colour</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR1 Upper Material</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR2 Sole Material</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR3 Lining Material</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR4 Season</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR5 Product Status</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR6 Fabrication</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR7 Iconic</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR8 Web Colour Group</th>
                            <th className="text-left py-1 pr-2 text-muted-foreground font-medium">CR9 Occasion</th>
                            <th className="text-left py-1 text-muted-foreground font-medium">CR10 Web</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEntry.colours.map((colour, ci) => {
                            const label = selectedEntry.colourLabels[ci] ?? colour;
                            // colourKey for DB = colour name only (first word if compound)
                            const colourKey = colour;
                            const saved = (ap21ColourRefsData as any)?.[colourKey] ?? {};
                            const fields: { key: string; placeholder: string }[] = [
                              { key: 'upperMaterial', placeholder: 'e.g. Leather' },
                              { key: 'soleMaterial', placeholder: 'e.g. Rubber' },
                              { key: 'liningMaterial', placeholder: 'e.g. Man Made' },
                              { key: 'season', placeholder: ap21StyleRefsData?.season ?? 'e.g. Summer 2026' },
                              { key: 'productStatus', placeholder: '' },
                              { key: 'fabrication', placeholder: '' },
                              { key: 'iconic', placeholder: '' },
                              { key: 'webColourGroup', placeholder: '' },
                              { key: 'occasion', placeholder: '' },
                              { key: 'web', placeholder: '' },
                            ];
                            return (
                              <tr key={colour} className="border-b border-border/50">
                                <td className="py-1 pr-3 font-medium text-foreground">{label}</td>
                                {fields.map(({ key, placeholder }) => (
                                  <td key={key} className="py-1 pr-2">
                                    <Input
                                      className="h-6 text-xs min-w-[80px]"
                                      placeholder={placeholder}
                                      defaultValue={saved[key] ?? ""}
                                      onBlur={(e) => {
                                        const val = e.target.value.trim() || null;
                                        if (!selectedStyle) return; upsertAp21ColourRefsMutation.mutate({ style: selectedStyle, colourKey, [key]: val });
                                      }}
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Import preview banner */}
            {importParsed && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      Ready to import: {importParsed.styleName}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      {importParsed.detectedColours.length} colour{importParsed.detectedColours.length !== 1 ? "s" : ""} detected
                      {importParsed.unmatchedComponents.length > 0 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          · {importParsed.unmatchedComponents.length} unrecognised fields skipped
                        </span>
                      )}
                    </p>
                    {/* Colour preview: show detected colours with mapping arrows */}
                    <div className="mt-2 space-y-1">
                      {importParsed.detectedColours.map((detectedColour) => {
                        const styleColourMap = COLOUR_LEATHER_MAP[selectedStyle ?? ""] ?? {};
                        const labelToRaw: Record<string, string> = {};
                        for (const [raw, label] of Object.entries(styleColourMap)) {
                          labelToRaw[label.toUpperCase()] = raw;
                          labelToRaw[raw.toUpperCase()] = raw;
                        }
                        const rawColour = labelToRaw[detectedColour.toUpperCase()];
                        const valueCount = Object.values(importParsed.colourSpecs[detectedColour] ?? {}).filter(v => v.trim()).length;
                        return (
                          <div key={detectedColour} className="flex items-center gap-1.5 text-xs">
                            <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5 font-mono">{detectedColour}</span>
                            {rawColour && rawColour.toUpperCase() !== detectedColour.toUpperCase() && (
                              <>
                                <ArrowRight className="w-3 h-3 text-blue-400" />
                                <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded px-1.5 py-0.5 font-mono">{rawColour}</span>
                              </>
                            )}
                            <span className="text-muted-foreground">{valueCount} values</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={() => setImportParsed(null)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {importParsed.unmatchedComponents.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Skipped fields: {importParsed.unmatchedComponents.join(", ")}</span>
                  </div>
                )}
                {/* Overwrite toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    id="import-overwrite"
                    checked={importOverwrite}
                    onCheckedChange={setImportOverwrite}
                    className="scale-90"
                  />
                  <Label htmlFor="import-overwrite" className="text-xs text-muted-foreground cursor-pointer">
                    {importOverwrite ? "Overwrite existing values" : "Fill blanks only (keep existing values)"}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={importSaving || bulkUpsertMutation.isPending} onClick={handleSaveImport} className="gap-1.5">
                    {importSaving ? <><RefreshCw className="w-3 h-3 animate-spin" /> Saving…</> : "Save to dashboard"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setImportParsed(null)}>Cancel</Button>
                </div>
              </div>
            )}
            </div>{/* end sticky header */}

            {/* Scrollable spec grid body */}
            <div className="flex-1 overflow-y-auto px-6 pb-12">
            <SpecForm
              key={selectedEntry.style}
              tableScrollRef={specTableScrollRef}
              entry={selectedEntry}
              toeCapsPerColour={selectedEntry.toeCapsPerColour}
              specMeta={specMeta}
              specs={specs}
              allDropdownOptions={allDropdownOptions}
              allDropdownOptionIds={allDropdownOptionIds}
              allColourLeatherOptions={ALL_COLOUR_LEATHER_OPTIONS}
              customRows={rawCustomRows as any[]}
              onUpsert={handleUpsert}
              onBulkAutoFill={handleBulkAutoFill}
              onBulkCopy={handleBulkCopy}
              onAddDropdownOption={handleAddDropdownOption}
              onDeleteDropdownOption={handleDeleteDropdownOption}
              onEditDropdownOption={handleEditDropdownOption}
              onAddSku={handleAddSku}
              editableCustomSkus={editableCustomSkus}
              onEditSku={handleEditSku}
              onMetaChange={handleMetaChange}
              onAddCustomRow={handleAddCustomRow}
              onRenameCustomRow={handleRenameCustomRow}
              onUpdateCustomRowForColour={handleUpdateCustomRowForColour}
              onDeleteCustomRow={handleDeleteCustomRow}
              onReorderCustomRows={handleReorderCustomRows}
              dbCategory={dbCategory}
              allCustomRowTitles={allCustomRowTitles}
              allStyleEntries={styleList}
              onHideColumn={handleHideColumn}
              hiddenColumns={hiddenColumnsSet}
              showHiddenColumns={showHiddenColumns}
              onShowColumn={(colour) => {
                if (colour === "__toggle__") {
                  setShowHiddenColumns((v) => !v);
                } else {
                  handleShowColumn(colour);
                }
              }}
              onResetColour={handleResetColour}
              onBulkCopyCustomRowsFromStyle={async (targetColours, rows) => {
                if (!selectedStyle) return;
                const style = selectedStyle;
                const before = groupSpecCustomRows(utils.specCustomRow.getByStyle.getData({ style }) ?? []);
                const data = await bulkCopyFromStyleMutation.mutateAsync({
                    targetStyle: selectedStyle,
                    targetColours: targetColours.map(normalizeStoredSpecColourKey),
                    // Use the unfiltered style entry so hidden columns retain
                    // their existing custom-row values during a selected-SKU copy.
                    allColours: (selectedEntryRaw?.colourLabels ?? selectedEntry.colourLabels).map(normalizeStoredSpecColourKey),
                    rows,
                });
                const sameRow = (a: { section: string; title: string }, b: { section: string; title: string }) => a.section === b.section && a.title.trim().toUpperCase() === b.title.trim().toUpperCase();
                const update = (current: string[]) => {
                  let keys = current;
                  for (const returned of data.rowIds) {
                    const newKey = `c:${returned.newId}`;
                    for (const group of before.filter(group => sameRow(group.rep, returned))) {
                      for (const member of group.rows) keys = replaceSpecRowKey(keys, `c:${member.id}`, newKey);
                    }
                    // A populated copied cell must not resurrect an explicitly hidden target row.
                    if (!keys.includes(newKey) && !keys.includes(`deleted:${newKey}`)) keys = [...keys, newKey];
                  }
                  return normalizeSpecRowLayout(keys);
                };
                if (activeStyleRef.current === style && updateRowKeysRef.current) {
                  await updateRowKeysRef.current(update);
                } else {
                  await enqueueSpecRowSave(style, async () => {
                    const order = await utils.specRowOrder.get.fetch({ style }, { staleTime: 0 });
                    await upsertRowOrderForColourExplosionMutation.mutateAsync({ style, rowKeys: update(order.rowKeys ?? []) });
                  });
                }
                await utils.specCustomRow.getByStyle.invalidate({ style });
              }}
              onRegisterReplaceRowKey={(swapFn) => {
                replaceRowKeySetterRef.current = swapFn;
              }}
              onRegisterGetRowKeys={(getFn) => {
                if (getFn) getRowKeysRef.current = { style: selectedEntry.style, read: getFn };
                else if (getRowKeysRef.current?.style === selectedEntry.style) getRowKeysRef.current = null;
              }}
              onRegisterUpdateRowKeys={(updateFn) => {
                updateRowKeysRef.current = updateFn;
              }}
            />
            </div>{/* end scrollable body */}
          </div>
        )}
      </div>

      {/* ── Bulk Import Modal ─────────────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => { if (!bulkLoading && !bulkSaving) setShowBulkModal(false); }}>
          <div className="w-[600px] max-w-full mx-4 rounded-2xl shadow-2xl bg-card overflow-hidden" style={{ border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="font-bold text-base text-foreground">Bulk Spec Import</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bulkResults.length} file{bulkResults.length !== 1 ? "s" : ""} · {bulkResults.filter(r => r.status === "pending" || manualMappings[r.fileName]).length} ready · {bulkResults.filter(r => r.status === "done").length} saved
                </p>
              </div>
              {!bulkLoading && !bulkSaving && (
                <button onClick={() => setShowBulkModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Overwrite toggle */}
            {!bulkLoading && bulkResults.length > 0 && (
              <div className="px-6 py-3 border-b flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
                <Switch
                  id="bulk-overwrite"
                  checked={bulkOverwrite}
                  onCheckedChange={setBulkOverwrite}
                  disabled={bulkSaving}
                  className="scale-90"
                />
                <Label htmlFor="bulk-overwrite" className="text-xs text-muted-foreground cursor-pointer">
                  {bulkOverwrite ? "Overwrite existing values" : "Fill blanks only (keep existing values)"}
                </Label>
              </div>
            )}

            <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
              {bulkLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Parsing files…
                </div>
              )}
              {!bulkLoading && bulkResults.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">No files parsed yet.</div>
              )}
              {bulkResults.map((r) => {
                const parsed = bulkParsed.find(p => p.result.fileName === r.fileName)?.parsed;
                const manualStyle = manualMappings[r.fileName];
                const effectiveStyle = r.matchedStyle ?? manualStyle ?? null;
                return (
                  <div key={r.fileName} className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{r.fileName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {effectiveStyle ? (
                            <><span className="text-green-600 dark:text-green-400 font-medium">{effectiveStyle}</span> · {r.colourCount} colour{r.colourCount !== 1 ? "s" : ""} · {r.valueCount} values</>
                          ) : r.styleName !== "?" ? (
                            <span className="text-amber-600 dark:text-amber-400">"{r.styleName}" — not found in spec list</span>
                          ) : (
                            <span className="text-red-500">Parse error</span>
                          )}
                        </p>
                        {r.error && <p className="text-xs text-red-500 mt-0.5">{r.error}</p>}
                        {/* Colour preview for matched/manually-mapped files */}
                        {effectiveStyle && parsed && r.status !== "done" && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {parsed.detectedColours.map((c) => (
                              <span key={c} className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono">{c}</span>
                            ))}
                          </div>
                        )}
                        {r.status === "done" && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ {r.savedCount ?? 0} values saved</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 mt-0.5">
                        {r.status === "pending" && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Ready</span>}
                        {r.status === "saving" && <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" />Saving</span>}
                        {r.status === "done" && <span className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full">✓ Done</span>}
                        {r.status === "unmatched" && !manualStyle && <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">Unmatched</span>}
                        {r.status === "error" && <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">Error</span>}
                      </div>
                    </div>
                    {/* Manual style mapping for unmatched files */}
                    {(r.status === "unmatched" || (r.status === "pending" && !r.matchedStyle)) && r.styleName !== "?" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0">Map to:</span>
                        <select
                          className="flex-1 text-xs rounded border border-border bg-background px-2 py-1 text-foreground"
                          value={manualStyle ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualMappings(prev => val ? { ...prev, [r.fileName]: val } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== r.fileName)));
                          }}
                        >
                          <option value="">— select style —</option>
                          {styleList.map(s => (
                            <option key={s.style} value={s.style}>{s.style}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!bulkLoading && bulkResults.length > 0 && (
              <div className="px-6 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs text-muted-foreground">
                  {bulkResults.filter((r) => r.status === "pending" || (r.status === "unmatched" && manualMappings[r.fileName])).length} ready ·{" "}
                  {bulkResults.filter((r) => r.status === "unmatched" && !manualMappings[r.fileName]).length} unmatched ·{" "}
                  {bulkResults.filter((r) => r.status === "done").length} saved
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowBulkModal(false)} disabled={bulkSaving}>Close</Button>
                  {(bulkResults.some((r) => r.status === "pending") || bulkResults.some((r) => r.status === "unmatched" && manualMappings[r.fileName])) && (
                    <Button size="sm" onClick={handleBulkSave} disabled={bulkSaving} className="gap-1.5">
                      {bulkSaving ? <><RefreshCw className="w-3 h-3 animate-spin" /> Saving…</> : `Save ${bulkResults.filter((r) => r.status === "pending" || (r.status === "unmatched" && manualMappings[r.fileName])).length} Spec${bulkResults.filter((r) => r.status === "pending" || (r.status === "unmatched" && manualMappings[r.fileName])).length !== 1 ? "s" : ""}`}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
