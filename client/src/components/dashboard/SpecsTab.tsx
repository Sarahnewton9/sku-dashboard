import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { displayColourLeather } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  ChevronDown, ChevronRight, Search, CheckCircle, FileSpreadsheet, Copy, Upload, AlertCircle, Check, ChevronsUpDown, Plus, Trash2, X, ArrowRight, RefreshCw, GripVertical, RotateCcw, Pencil,
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
import { exportSpecSheet } from "@/lib/exportSpecSheet";
import { parseSpecSheetFile, type ParsedSpecSheet } from "@/lib/importSpecSheet";

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Custom Free Type Cell (for custom rows — no SpecComponent dependency) ──────
interface CustomFreeTypeCellProps {
  value: string;
  options: string[];
  optionIds?: Record<string, number>;
  onSave: (val: string) => void;
  onAddOption: (val: string) => void;
  onDeleteOption: (val: string) => void;
  onEditOption?: (id: number, newValue: string) => void;
  /** Used for Tab navigation: "rowId:colIdx" */
  cellId?: string;
}
function CustomFreeTypeCell({ value, options, optionIds, onSave, onAddOption, onDeleteOption, onEditOption, cellId }: CustomFreeTypeCellProps) {
  const allOptions = Array.from(new Set(options)).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const [draft, setDraft] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Track whether the user is actively typing (vs just focused with existing value)
  const [isTyping, setIsTyping] = useState(false);
  const [editingOpt, setEditingOpt] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);

  useEffect(() => { setDraft(value); }, [value]);

  // Auto-resize textarea height to fit content
  useEffect(() => {
    const el = inputRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [draft]);

  // When typing, filter options by the draft. On initial focus (not typing), show all options.
  const filtered = isTyping && draft.trim()
    ? allOptions.filter((o) => o.toLowerCase().includes(draft.toLowerCase()))
    : allOptions;

  // The "Save as suggestion" row should show whenever the draft is a new value (not in options)
  const isNewValue = draft.trim() !== "" && !allOptions.some((o) => o.toLowerCase() === draft.trim().toLowerCase());

  function commit(val: string) {
    const trimmed = val.trim();
    onSave(trimmed);
    setDraft(trimmed);
    setShowSuggestions(false);
    setIsTyping(false);
  }

  function handleSelect(opt: string) {
    committedRef.current = true;
    commit(opt);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && !e.shiftKey && cellId) {
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
    if (e.key === "Escape") { setDraft(value); setShowSuggestions(false); setIsTyping(false); inputRef.current?.blur(); }
  }

  function handleBlur() {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        if (!committedRef.current) commit(draft);
        committedRef.current = false;
        setShowSuggestions(false);
        setIsTyping(false);
      }
    }, 150);
  }

  // The dropdown shows if there are options to display OR if the draft is a new value to save
  const shouldShowDropdown = showSuggestions && (filtered.length > 0 || isNewValue);

  return (
    <div ref={containerRef} className="relative min-w-[140px] w-full">
      <textarea
        ref={inputRef}
        value={draft}
        rows={1}
        data-spec-cell={cellId}
        onChange={(e) => { setDraft(e.target.value); setIsTyping(true); setShowSuggestions(true); }}
        onFocus={() => { setIsTyping(false); setShowSuggestions(true); }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="— type —"
        className="w-full px-2 py-1.5 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground resize-none overflow-hidden min-h-[32px]"
        style={{ lineHeight: "1.4" }}
      />
      {shouldShowDropdown && (
        <div className="absolute z-50 top-full left-0 mt-0.5 w-64 max-h-52 overflow-y-auto bg-popover border border-border rounded shadow-md">
          {filtered.map((opt) => {
            const optId = optionIds?.[opt];
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
                      if (editDraft.trim() && optId !== undefined) onEditOption?.(optId, editDraft.trim());
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
                <span className="flex items-center gap-0.5 opacity-0 group-hover/opt:opacity-100 flex-shrink-0">
                  {onEditOption && optId !== undefined && (
                    <button
                      className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditingOpt(opt); setEditDraft(opt); }}
                      title="Edit suggestion"
                    ><Pencil className="w-2.5 h-2.5" /></button>
                  )}
                  <button
                    className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteOption(opt); }}
                    title="Remove suggestion"
                  ><X className="w-2.5 h-2.5" /></button>
                </span>
              </div>
            );
          })}
          {/* Always show Save-as-option when the draft is a new value, regardless of filtered length */}
          {isNewValue && (
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
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
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 text-muted-foreground/30 hover:text-amber-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Drag to reorder"
            tabIndex={-1}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs">{comp.label}</span>
          <button
            onClick={() => onDelete(id)}
            className="ml-auto p-0.5 text-muted-foreground/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            title="Hide row"
            tabIndex={-1}
          >
            <X className="w-3 h-3" />
          </button>
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
  /** Called when the title or value of the __all__ row changes (still-shared row). */
  onUpdate: (id: number, title: string, value: string) => void;
  /** Called when a specific colour cell is edited. Triggers explosion of __all__ into per-colour rows. */
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
function UnifiedCustomRow({ id, row, rowGroup, colours, onUpdate, onUpdateForColour, onDelete, allTitles, isActive, allDropdownOptions, allDropdownOptionIds, onAddDropdownOption, onDeleteDropdownOption, onEditDropdownOption }: UnifiedCustomRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.15 : 1,
  };
  const isAllRow = row.colour === "__all__";
  // Shared value (used for seeding other colours when exploding __all__)
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
            value={isAllRow ? (row.value ?? "") : ""}
            onUpdate={onUpdate}
            onDelete={onDelete}
            allTitles={allTitles}
          />
        </div>
      </td>
      {colours.map((colour, colIdx) => {
        // Get the value for this specific colour
        let cellValue: string;
        if (isAllRow) {
          cellValue = row.value ?? "";
        } else {
          const colourRow = rowGroup.get(colour);
          cellValue = colourRow ? (colourRow.value ?? "") : "";
        }
        const optKey = `custom:${row.title}`;
        const opts = allDropdownOptions[optKey] ?? [];
        const optIds = allDropdownOptionIds?.[optKey] ?? {};
        return (
          <td key={`${colour}-${colIdx}`} className="px-2 py-1 align-middle">
            <CustomFreeTypeCell
              value={cellValue}
              options={opts}
              optionIds={optIds}
              onSave={(v) => {
                if (isAllRow) {
                  onUpdateForColour(row.id, row.title, colour, v, sharedValue, row.section, row.sortOrder);
                } else {
                  const colourRow = rowGroup.get(colour);
                  if (colourRow) {
                    onUpdate(colourRow.id, colourRow.title, v);
                  } else {
                    onUpdateForColour(row.id, row.title, colour, v, "", row.section, row.sortOrder);
                  }
                }
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
  onCopy: (source: string, targets: string[]) => void;
}

function ColourCopyPanel({ colours, colourLabels, onCopy }: ColourCopyPanelProps) {
  // Use full colour labels as the copy keys (e.g. "BLACK CAPRI" not "BLACK")
  const labels = colourLabels.length === colours.length ? colourLabels : colours;
  const [source, setSource] = useState<string | null>(null);
  const [targets, setTargets] = useState<Set<string>>(new Set());

  function toggleTarget(label: string) {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
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

// ─── Custom Row Title Input (local state to avoid lag) ──────────────────────────

interface CustomRowTitleInputProps {
  id: number;
  initialTitle: string;
  value: string;
  onUpdate: (id: number, title: string, value: string) => void;
  onDelete: (id: number) => void;
  allTitles: string[]; // known titles for autocomplete
}

function CustomRowTitleInput({ id, initialTitle, value, onUpdate, onDelete, allTitles }: CustomRowTitleInputProps) {
  // Helper: convert stored title to proper case for display (e.g. "BUCKLE" → "Buckle")
  function toProperCase(s: string) {
    return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  const [localTitle, setLocalTitle] = useState(toProperCase(initialTitle));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Sync if the DB title changes from outside (e.g. on first load)
  useEffect(() => { setLocalTitle(toProperCase(initialTitle)); }, [initialTitle]);

  const suggestions = allTitles
    .filter((t) => t && t.toLowerCase().includes(localTitle.toLowerCase()) && t !== localTitle)
    .slice(0, 6);

  function handleChange(val: string) {
    setLocalTitle(val);
    onUpdate(id, val, value);
  }

  function handleSelect(val: string) {
    setLocalTitle(val);
    onUpdate(id, val, value);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1.5 relative">
      <input
        className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-transparent border-0 border-b border-dashed border-amber-300 dark:border-amber-700 focus:outline-none focus:border-amber-500 w-full min-w-0 placeholder:text-amber-400/60"
        value={localTitle}
        placeholder="Field name…"
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md min-w-[180px] py-1">
          {suggestions.map((s) => (
            <button
              key={s}
              className="w-full text-left text-xs px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => onDelete(id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 flex-shrink-0"
        title="Delete this row"
      >
        <Trash2 className="w-3 h-3" />
      </button>
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
  imageOverride?: string;
  customRows: CustomRowData[];
  onUpsert: (colour: string, component: string, value: string) => void;
  onBulkAutoFill: (rows: Array<{ style: string; colour: string; component: string; value: string }>) => void;
  onAddDropdownOption: (component: string, value: string) => void;
  onDeleteDropdownOption: (component: string, value: string) => void;
  onEditDropdownOption: (id: number, newValue: string) => void;
  onMetaChange: (meta: Partial<{ hasBuckle: boolean; dressShoeSubType: "court" | "sling" | null; notes: string | null }>) => void;
  onAddSku: (colour: string, leather: string) => void;
  onAddCustomRow: (section: string, afterSortOrder?: number) => void;
  onUpdateCustomRow: (id: number, title: string, value: string) => void;
  onUpdateCustomRowForColour: (representativeId: number, title: string, colour: string, newValue: string, currentSharedValue: string, section: string, sortOrder: number) => void;
  onDeleteCustomRow: (id: number) => void;
  onReorderCustomRows: (section: string, orderedIds: number[]) => void;
  dbCategory: string | null;
  onSetCategory: (category: string | null) => void;
  allCustomRowTitles: string[]; // for autocomplete
  allStyleEntries: StyleEntry[]; // for cross-style copy
  onHideColumn: (colour: string) => void;
  hiddenColumns: Set<string>; // for showing restore buttons when showHiddenColumns is on
  showHiddenColumns: boolean;
  onShowColumn: (colour: string) => void;
  onResetColour: (colour: string) => void;
  tableScrollRef?: React.RefObject<HTMLDivElement | null>; // lifted up for external sticky scrollbar
  onBulkCopyCustomRowsFromStyle: (targetColours: string[], rows: Array<{ section: string; title: string; value: string; sortOrder: number }>) => void;
}

const STYLE_CATEGORIES = [
  "Dress Sandal",
  "Dress Shoe",
  "Casual Flat",
  "Dress Wedge",
  "Casual Wedge",
  "Casual Ankle Boot",
  "Dress Ankle Boot",
  "Dress Calf Boot",
  "Casual Calf Boot",
  "Casual Sandal",
  "Flat Sandal",
];

// ─── Sticky Phantom Scrollbar ───────────────────────────────────────────────
// Renders a thin scrollbar that stays stuck to the bottom of the viewport while
// the user scrolls the spec grid vertically. Scroll position is kept in sync
// bidirectionally with the real overflow-x-auto container via event listeners.

interface StickyScrollBarProps {
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
}

function StickyScrollBar({ tableScrollRef }: StickyScrollBarProps) {
  const phantomRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false); // prevent feedback loops

  // Keep the phantom inner width equal to the table scroll width
  useLayoutEffect(() => {
    const table = tableScrollRef.current;
    const inner = innerRef.current;
    if (!table || !inner) return;

    function updateWidth() {
      if (table && inner) inner.style.width = table.scrollWidth + "px";
    }
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(table);
    return () => ro.disconnect();
  }, [tableScrollRef]);

  // Bidirectional scroll sync
  useEffect(() => {
    const table = tableScrollRef.current;
    const phantom = phantomRef.current;
    if (!table || !phantom) return;

    function onTableScroll() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (phantom) phantom.scrollLeft = table!.scrollLeft;
      syncingRef.current = false;
    }
    function onPhantomScroll() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (table) table.scrollLeft = phantom!.scrollLeft;
      syncingRef.current = false;
    }

    table.addEventListener("scroll", onTableScroll, { passive: true });
    phantom.addEventListener("scroll", onPhantomScroll, { passive: true });
    return () => {
      table.removeEventListener("scroll", onTableScroll);
      phantom.removeEventListener("scroll", onPhantomScroll);
    };
  }, [tableScrollRef]);

  return (
    <div
      ref={phantomRef}
      className="flex-shrink-0 overflow-x-auto border-t border-border/40 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-muted/20 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-thumb]:rounded-full"
      style={{ scrollbarWidth: "thin" }}
    >
      <div ref={innerRef} style={{ height: "1px" }} />
    </div>
  );
}

// ─── Cross-Style Copy Panel ──────────────────────────────────────────────────

interface CrossStyleCopyPanelProps {
  currentStyle: string;
  currentColours: string[];
  currentColourLabels: string[];
  allStyleEntries: StyleEntry[];
  template: SpecComponent[];
  onCopy: (sourceColour: string, targetColours: string[], sourceSpecs: Record<string, string>, sourceCustomRows: CustomRowData[]) => void;
}

function CrossStyleCopyPanel({ currentStyle, currentColours, currentColourLabels, allStyleEntries, template, onCopy }: CrossStyleCopyPanelProps) {
  const [open, setOpen] = useState(false);
  const [sourceStyle, setSourceStyle] = useState<string | null>(null);
  const [sourceColour, setSourceColour] = useState<string | null>(null);
  const [targets, setTargets] = useState<Set<string>>(new Set());

  const sourceEntry = allStyleEntries.find((s) => s.style === sourceStyle);

  // Fetch specs for the selected source style
  const { data: sourceSpecsRaw = [] } = trpc.specs.getForStyle.useQuery(
    { style: sourceStyle! },
    { enabled: !!sourceStyle }
  );

  // Fetch custom rows for the selected source style
  const { data: sourceCustomRowsRaw = [] } = trpc.specCustomRow.getByStyle.useQuery(
    { style: sourceStyle! },
    { enabled: !!sourceStyle }
  );

  // Build a colour → component → value map from raw specs (keyed by full colour label)
  const sourceSpecsMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const row of sourceSpecsRaw as any[]) {
      if (!map[row.colour]) map[row.colour] = {};
      if (row.value) map[row.colour][row.component] = row.value;
    }
    return map;
  }, [sourceSpecsRaw]);

  function toggleTarget(colour: string) {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(colour)) next.delete(colour); else next.add(colour);
      return next;
    });
  }

  function handleCopy() {
    if (!sourceStyle || !sourceColour || targets.size === 0) return;
    const sourceValues = sourceSpecsMap[sourceColour] ?? {};
    onCopy(sourceColour, Array.from(targets), sourceValues, sourceCustomRowsRaw as CustomRowData[]);
    setOpen(false);
    setSourceStyle(null);
    setSourceColour(null);
    setTargets(new Set());
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
        <span className="font-medium text-amber-900 dark:text-amber-200">Copy specs from another style</span>
        <button onClick={() => { setOpen(false); setSourceStyle(null); setSourceColour(null); setTargets(new Set()); }} className="text-muted-foreground hover:text-foreground text-sm leading-none">×</button>
      </div>
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
        {sourceEntry && (
          <>
            <span className="text-muted-foreground">colour:</span>
            <Select value={sourceColour ?? ""} onValueChange={(v) => { setSourceColour(v); setTargets(new Set()); }}>
              <SelectTrigger className="h-7 w-44 text-xs">
                <SelectValue placeholder="Select colour…" />
              </SelectTrigger>
              <SelectContent>
                {sourceEntry.colours.map((c, i) => {
                  // Use the full label as the value so sourceSpecsMap lookup works correctly
                  const label = sourceEntry.colourLabels[i] ?? c;
                  return <SelectItem key={label} value={label} className="text-xs">{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      {sourceColour && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-muted-foreground whitespace-nowrap">Copy into:</span>
          {currentColours.map((c, i) => {
            // Use full label as the target key
            const label = currentColourLabels[i] ?? c;
            return (
              <button
                key={label}
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
      {targets.size > 0 && (
        <Button size="sm" onClick={handleCopy} className="h-7 text-xs bg-amber-600 hover:bg-amber-700">
          Copy {targets.size} colour{targets.size > 1 ? "s" : ""}
        </Button>
      )}
    </div>
  );
}

// ─── Unified Row type for drag-and-drop ──────────────────────────────────────
type UnifiedRow =
  | { kind: "template"; id: string; comp: SpecComponent }
  | { kind: "custom"; id: string; row: CustomRowData; rowGroup: Map<string, CustomRowData> };

function SpecForm({
  entry, toeCapsPerColour, specMeta, specs, allDropdownOptions, allDropdownOptionIds, allColourLeatherOptions, imageOverride, customRows,
  onUpsert, onBulkAutoFill, onAddDropdownOption, onDeleteDropdownOption, onEditDropdownOption, onMetaChange, onAddSku, onAddCustomRow, onUpdateCustomRow, onUpdateCustomRowForColour, onDeleteCustomRow, onReorderCustomRows,
  dbCategory, onSetCategory, allCustomRowTitles, allStyleEntries,
  onHideColumn, hiddenColumns, showHiddenColumns, onShowColumn, onResetColour,
  tableScrollRef: externalTableScrollRef,
  onBulkCopyCustomRowsFromStyle,
}: SpecFormProps) {
  const [showAddSku, setShowAddSku] = useState(false);
  const [newSkuColour, setNewSkuColour] = useState("");
  const [newSkuLeather, setNewSkuLeather] = useState("");
  // Refs for the sticky phantom scrollbar
  // Use the externally-lifted ref if provided (so parent can render StickyScrollBar outside the scroll container)
  const internalTableScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = externalTableScrollRef ?? internalTableScrollRef;
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
    for (const r of allCustomRowsSorted) {
      const key = r.title;
      if (!groups.has(key)) {
        groups.set(key, { rep: r, colourMap: new Map([[r.colour, r]]) });
      } else {
        groups.get(key)!.colourMap.set(r.colour, r);
      }
    }
    return groups;
  }, [allCustomRowsSorted]);

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
  const notes = specMeta?.notes ?? "";
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
    if (savedKeys && savedKeys.length > 0) {
      // Use saved order, adding any new rows not in saved order at the end
      const result: UnifiedRow[] = [];
      const usedKeys = new Set<string>();
      for (const key of savedKeys) {
        if (key.startsWith("deleted:")) continue; // skip deleted template rows
        if (key.startsWith("t:") && templateMap.has(key)) {
          result.push({ kind: "template", id: key, comp: templateMap.get(key)! });
          usedKeys.add(key);
        } else if (key.startsWith("c:") && customRepMap.has(key)) {
          const group = customRepMap.get(key)!;
          result.push({ kind: "custom", id: key, row: group.rep, rowGroup: group.colourMap });
          usedKeys.add(key);
        }
      }
      // Add any template rows not in saved order (new template rows added after order was saved)
      for (const [key, comp] of Array.from(templateMap)) {
        if (!usedKeys.has(key)) result.push({ kind: "template", id: key, comp });
      }
      // Add any custom rows not in saved order (newly added custom rows — use rep key)
      for (const [key, group] of Array.from(customRepMap)) {
        if (!usedKeys.has(key)) result.push({ kind: "custom", id: key, row: group.rep, rowGroup: group.colourMap });
      }
      return result;
    }
    // Default: template rows in template order, then custom rows (one row per title group)
    const result: UnifiedRow[] = [
      ...template.map((c): UnifiedRow => ({ kind: "template", id: `t:${c.key}`, comp: c })),
      ...Array.from(customRepMap).map(([key, group]): UnifiedRow => ({ kind: "custom", id: key, row: group.rep, rowGroup: group.colourMap })),
    ];
    return result;
  }, [template, customRepMap, rowOrderData, localRowKeys]);

  const unifiedRowIds = useMemo(() => unifiedRows.map((r) => r.id), [unifiedRows]);
  const activeRow = activeId ? unifiedRows.find((r) => r.id === activeId) ?? null : null;

  function handleCopyFrom(sourceColour: string, targetColours: string[]) {
    const sourceValues = specs[sourceColour] ?? {};
    for (const colour of targetColours) {
      // Copy template rows
      for (const comp of template) {
        // Never copy Upper 1 — each colour has its own upper material
        if (comp.key === "upper_1") continue;
        const val = sourceValues[comp.key];
        if (val) onUpsert(colour, comp.key, val);
      }
      // Copy custom (manually added) rows
      for (const [, group] of Array.from(customRowGroups)) {
        const { rep, colourMap } = group;
        // Get the value for the source colour, falling back to the shared __all__ value
        const sourceRow = colourMap.get(sourceColour) ?? colourMap.get("__all__");
        const sourceVal = sourceRow?.value ?? null;
        if (!sourceVal) continue; // nothing to copy
        // Current shared value (used by server to decide whether to explode __all__ row)
        const sharedRow = colourMap.get("__all__");
        const currentSharedValue = sharedRow?.value ?? "";
        onUpdateCustomRowForColour(rep.id, rep.title, colour, sourceVal, currentSharedValue, rep.section, rep.sortOrder);
      }
    }
    toast.success(`Copied specs from ${sourceColour} to ${targetColours.length} colour(s) (Upper 1 kept per-colour)`);
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
        {(imageOverride || entry.imageUrl) && (
          <img src={imageOverride ?? entry.imageUrl} alt={entry.style} className="w-16 h-16 object-cover rounded-lg border" />
        )}
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
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{pct}% complete</span>
            </div>
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

      {/* Style-level settings */}
      <div className="flex flex-wrap gap-6 items-start p-3 bg-muted/30 rounded-lg border">
        {/* Category selector */}
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium whitespace-nowrap">Category:</Label>
          <Select
            value={dbCategory ?? "__none__"}
            onValueChange={(v) => onSetCategory(v === "__none__" ? null : v)}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="— not set —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs text-muted-foreground">— not set —</SelectItem>
              {STYLE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      <div className="flex flex-col gap-2">
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
          template={template}
          onCopy={(sourceColour, targetColours, sourceSpecs, sourceCustomRows) => {
            // Copy template rows for each target colour
            for (const colour of targetColours) {
              for (const comp of template) {
                // Never copy Upper 1 — each colour has its own upper material
                if (comp.key === "upper_1") continue;
                const val = sourceSpecs[comp.key];
                if (val) onUpsert(colour, comp.key, val);
              }
            }
            // Copy custom rows from source style using the dedicated bulk procedure
            // This correctly handles rows that don't exist in the target style yet
            if (sourceCustomRows.length > 0) {
              // Build a deduplicated list of rows (one per title, preferring the source colour's value)
              const seen = new Map<string, { section: string; title: string; value: string; sortOrder: number }>();
              for (const r of sourceCustomRows) {
                const val = r.value;
                if (!val) continue;
                const key = `${r.section}||${r.title}`;
                // Prefer the source colour's specific row over the __all__ row
                if (!seen.has(key) || r.colour === sourceColour) {
                  seen.set(key, { section: r.section, title: r.title, value: val, sortOrder: r.sortOrder });
                }
              }
              const rowsToCopy = Array.from(seen.values());
              if (rowsToCopy.length > 0) {
                onBulkCopyCustomRowsFromStyle(targetColours, rowsToCopy);
              }
            }
            toast.success(`Copied specs from ${sourceColour} to ${targetColours.length} colour(s) (Upper 1 kept per-colour)`);
          }}
        />
      </div>

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
          const newIdx = unifiedRowIds.indexOf(over.id as string);
          if (oldIdx === -1 || newIdx === -1) return;
          const newKeys = arrayMove(unifiedRowIds, oldIdx, newIdx);
          setLocalRowKeys(newKeys);
          upsertRowOrderMutation.mutate({ style: entry.style, rowKeys: newKeys });
        }}
        onDragCancel={() => setActiveId(null)}
      >
      <div ref={tableScrollRef} className="overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <table ref={tableRef} className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40 border-b">Colour</th>
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
                    ) : (
                      // Reset + Hide buttons — only visible on hover
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-all">
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
              {unifiedRows.map((uRow) => {
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
                        // Hide this template row by saving order with it removed
                        const newKeys = unifiedRowIds.filter((k) => k !== id);
                        setLocalRowKeys(newKeys);
                        upsertRowOrderMutation.mutate({ style: entry.style, rowKeys: newKeys });
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
                      onUpdate={onUpdateCustomRow}
                      onUpdateForColour={onUpdateCustomRowForColour}
                      onDelete={onDeleteCustomRow}
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
            {/* Single Add Row button at the bottom */}
            <tr>
              <td colSpan={entry.colours.length + 1} className="px-3 py-2">
                <button
                  onClick={() => onAddCustomRow("components")}
                  className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-amber-600 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add row
                </button>
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
    </div>
  );
}

// ─── Main SpecsTab ────────────────────────────────────────────────────────────

interface SpecsTabProps {}

export default function SpecsTab({}: SpecsTabProps) {
  const { mergedRawSkus, mergedStyles } = useCustomSkus();

  // Build colour+leather lookup from live merged raw SKUs
  // For styles with duplicate colours (different leathers), the key is "COLOUR LEATHER"
  const COLOUR_LEATHER_MAP = useMemo(() => {
    // First pass: count leathers per colour per style
    const leatherCount: Record<string, Record<string, Set<string>>> = {};
    for (const sku of mergedRawSkus as any[]) {
      const style = sku.style as string;
      const colour = sku.colour as string;
      const leather = (sku.leather as string) ?? "";
      if (!leatherCount[style]) leatherCount[style] = {};
      if (!leatherCount[style][colour]) leatherCount[style][colour] = new Set();
      leatherCount[style][colour].add(leather);
    }
    // Second pass: build the map
    const map: Record<string, Record<string, string>> = {};
    for (const sku of mergedRawSkus as any[]) {
      const style = sku.style as string;
      const colour = sku.colour as string;
      const leather = (sku.leather as string) ?? "";
      if (!map[style]) map[style] = {};
      const hasDuplicates = (leatherCount[style]?.[colour]?.size ?? 0) > 1;
      const key = hasDuplicates && leather ? `${colour} ${leather}` : colour;
      if (!map[style][key]) {
        map[style][key] = leather ? displayColourLeather(colour, leather, style) : colour;
      }
    }
    return map;
  }, [mergedRawSkus]);

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
    // First pass: detect multi-leather styles
    const leatherCount: Record<string, Record<string, Set<string>>> = {};
    for (const sku of mergedRawSkus as any[]) {
      const style = sku.style as string;
      const colour = sku.colour as string;
      const leather = (sku.leather as string) ?? "";
      if (!leatherCount[style]) leatherCount[style] = {};
      if (!leatherCount[style][colour]) leatherCount[style][colour] = new Set();
      leatherCount[style][colour].add(leather);
    }
    // Second pass: build map
    const map: Record<string, Record<string, string>> = {};
    for (const sku of mergedRawSkus as any[]) {
      const toeCap = (sku.toe_cap as string) ?? "";
      if (!toeCap) continue;
      const style = sku.style as string;
      const colour = sku.colour as string;
      const leather = (sku.leather as string) ?? "";
      const hasDuplicates = (leatherCount[style]?.[colour]?.size ?? 0) > 1;
      const key = hasDuplicates && leather ? `${colour} ${leather}` : colour;
      if (!map[style]) map[style] = {};
      map[style][key] = toeCap;
    }
    return map;
  }, [mergedRawSkus]);

  // Build new colours per style from live merged raw SKUs
  // When a colour appears with multiple leathers (e.g. TILDA BLACK/CRINKLE + BLACK/SPECKLE),
  // emit "COLOUR LEATHER" as the unique key so both get their own spec row.
  const NEW_COLOURS_PER_STYLE = useMemo(() => {
    // First pass: detect which styles have duplicate colours across different leathers
    const colourLeatherMap: Record<string, Record<string, Set<string>>> = {}; // style → colour → Set<leather>
    for (const sku of mergedRawSkus as any[]) {
      if (!sku.is_new) continue;
      const style = sku.style as string;
      const colour = sku.colour as string;
      const leather = (sku.leather as string) ?? "";
      if (!colourLeatherMap[style]) colourLeatherMap[style] = {};
      if (!colourLeatherMap[style][colour]) colourLeatherMap[style][colour] = new Set();
      colourLeatherMap[style][colour].add(leather);
    }

    // Second pass: build ordered colour key list per style
    const result: Record<string, string[]> = {};
    for (const s of mergedStyles as typeof skuData.styles) {
      const leathersByColour = colourLeatherMap[s.style];
      if (!leathersByColour) { result[s.style] = []; continue; }
      // Deduplicate colours first — custom styles can have duplicate colour entries
      // when the same colour appears with multiple leathers (e.g. XENA BLACK NAPPA + BLACK TUSCON).
      // The leathersByColour Set already captures all leathers, so we only need to visit each colour once.
      const allColours: string[] = (s as any).colours ?? [];
      const seenColours = new Set<string>();
      const keys: string[] = [];
      for (const colour of allColours) {
        if (seenColours.has(colour)) continue; // skip duplicate colour entries
        seenColours.add(colour);
        const leathers = leathersByColour[colour];
        if (!leathers) continue;
        if (leathers.size > 1) {
          // Multiple leathers for same colour — emit one key per leather
          for (const leather of Array.from(leathers).sort()) {
            keys.push(leather ? `${colour} ${leather}` : colour);
          }
        } else {
          keys.push(colour);
        }
      }
      result[s.style] = keys;
    }
    return result;
  }, [mergedRawSkus, mergedStyles]);

  // Build base style list from live merged styles
  const baseStyleList = useMemo(() => {
    const allStyles = mergedStyles as Array<typeof skuData.styles[number] & { _isCustomStyle?: boolean }>;
    return allStyles
      .filter((s) => {
        // Custom styles always appear regardless of last name
        if ((s as any)._isCustomStyle) return true;
        const lastUpper = (s.last ?? "").toUpperCase();
        const isOnNewLast = NEW_LASTS.some((nl) => lastUpper.includes(nl));
        return isOnNewLast || s.isAllNew;
      })
      .map((s) => {
        const newColours: string[] = NEW_COLOURS_PER_STYLE[s.style] ?? [];
        return {
          style: s.style,
          last: s.last,
          category: s.category,
          imageUrl: (s as any).imageUrl,
          colours: newColours,
          colourLabels: newColours.map((c) => COLOUR_LEATHER_MAP[s.style]?.[c] ?? c),
          toeCapsPerColour: TOE_CAP_MAP[s.style] ?? {},
          isAllNew: s.isAllNew,
          hasNew: s.hasNew,
          totalSKUs: s.totalSKUs,
          newSKUs: s.newSKUs,
          _isCustomStyle: !!(s as any)._isCustomStyle,
        };
      })
      // Custom styles appear even with 0 colours (they can have specs added)
      .filter((s) => s.colours.length > 0 || s._isCustomStyle)
      .sort((a, b) => a.style.localeCompare(b.style));
  }, [mergedStyles, NEW_COLOURS_PER_STYLE, COLOUR_LEATHER_MAP, TOE_CAP_MAP]);

  const utils = trpc.useUtils();
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [importParsed, setImportParsed] = useState<ParsedSpecSheet | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importOverwrite, setImportOverwrite] = useState(true);
  const importFileRef = React.useRef<HTMLInputElement>(null);
  // Lifted ref for the spec table's horizontal scroll container — shared with StickyScrollBar
  const specTableScrollRef = useRef<HTMLDivElement>(null);

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

  // Build a map: style → colourKey (as used in SpecsTab, e.g. "BLACK SPECKLE") → isCancelled
  // This is needed because SpecsTab uses compound colour keys ("BLACK SPECKLE") for multi-leather styles,
  // but cancelledSkuSet stores raw style|colour|leather ("DONTE|BLACK|SPECKLE").
  const cancelledColourKeySet = useMemo(() => {
    // Build style → colour → Set<leather> from mergedRawSkus (same logic as NEW_COLOURS_PER_STYLE)
    const leatherCount: Record<string, Record<string, Set<string>>> = {};
    for (const sku of mergedRawSkus as any[]) {
      const style = sku.style as string;
      const colour = sku.colour as string;
      const leather = (sku.leather as string) ?? "";
      if (!leatherCount[style]) leatherCount[style] = {};
      if (!leatherCount[style][colour]) leatherCount[style][colour] = new Set();
      leatherCount[style][colour].add(leather);
    }
    // Now build a set of "style|colourKey" strings for cancelled SKUs
    const set = new Set<string>();
    for (const row of cancelledSkusRaw as any[]) {
      const style = row.style as string;
      const colour = row.colour as string;
      const leather = (row.leather as string) ?? "";
      const isMultiLeather = (leatherCount[style]?.[colour]?.size ?? 0) > 1;
      const colourKey = isMultiLeather && leather ? `${colour} ${leather}` : colour;
      set.add(`${style}|${colourKey}`);
    }
    return set;
  }, [cancelledSkusRaw, mergedRawSkus]);

  // Filter cancelled styles + cancelled SKUs from the base list
  // (custom SKUs are already merged into baseStyleList via mergedRawSkus)
  const styleList = useMemo(() => {
    return baseStyleList
      .filter((s) => !cancelledSet.has(s.style))
      .map((s) => {
        // Filter out individually cancelled colours using compound-key-aware lookup
        const filteredColours: string[] = [];
        const filteredLabels: string[] = [];
        for (let i = 0; i < s.colours.length; i++) {
          const colour = s.colours[i]; // may be compound key like "BLACK SPECKLE"
          if (!cancelledColourKeySet.has(`${s.style}|${colour}`)) {
            filteredColours.push(colour);
            filteredLabels.push(s.colourLabels[i]);
          }
        }
        // Also filter toeCapsPerColour to only include non-cancelled colours
        const filteredToeCaps: Record<string, string> = {};
        for (const colour of filteredColours) {
          if (s.toeCapsPerColour[colour]) filteredToeCaps[colour] = s.toeCapsPerColour[colour];
        }
        return {
          ...s,
          colours: filteredColours,
          colourLabels: filteredLabels,
          toeCapsPerColour: filteredToeCaps,
        };
      })
      .filter((s) => s.colours.length > 0);
  }, [baseStyleList, cancelledSet, cancelledColourKeySet]);

  const filtered = styleList.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.style.toLowerCase().includes(q) || s.last.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  const selectedEntryRaw = styleList.find((s) => s.style === selectedStyle) ?? null;

  // ── Hidden columns (per-style, persisted in DB) ───────────────────────────
  const { data: hiddenColumnsData, refetch: refetchHiddenColumns } = trpc.specHiddenColumns.getHidden.useQuery(
    { style: selectedStyle! },
    { enabled: !!selectedStyle }
  );
  const hiddenColumnsSet = useMemo(
    () => new Set<string>(hiddenColumnsData?.hidden ?? []),
    [hiddenColumnsData]
  );
  const [showHiddenColumns, setShowHiddenColumns] = useState(false);

  const hideColumnMutation = trpc.specHiddenColumns.hide.useMutation({
    onMutate: async ({ style, colour }) => {
      await utils.specHiddenColumns.getHidden.cancel({ style });
      const prev = utils.specHiddenColumns.getHidden.getData({ style });
      utils.specHiddenColumns.getHidden.setData({ style }, (old) => ({
        hidden: [...(old?.hidden ?? []), colour],
      }));
      return { prev };
    },
    onError: (_err, { style }, ctx) => {
      if (ctx?.prev !== undefined) utils.specHiddenColumns.getHidden.setData({ style }, ctx.prev);
      toast.error("Failed to hide column");
    },
    onSettled: (_data, _err, { style }) => {
      utils.specHiddenColumns.getHidden.invalidate({ style });
    },
  });

  const showColumnMutation = trpc.specHiddenColumns.show.useMutation({
    onMutate: async ({ style, colour }) => {
      await utils.specHiddenColumns.getHidden.cancel({ style });
      const prev = utils.specHiddenColumns.getHidden.getData({ style });
      utils.specHiddenColumns.getHidden.setData({ style }, (old) => ({
        hidden: (old?.hidden ?? []).filter((c) => c !== colour),
      }));
      return { prev };
    },
    onError: (_err, { style }, ctx) => {
      if (ctx?.prev !== undefined) utils.specHiddenColumns.getHidden.setData({ style }, ctx.prev);
      toast.error("Failed to restore column");
    },
    onSettled: (_data, _err, { style }) => {
      utils.specHiddenColumns.getHidden.invalidate({ style });
    },
  });

  function handleHideColumn(colour: string) {
    if (!selectedStyle) return;
    hideColumnMutation.mutate({ style: selectedStyle, colour });
  }

  function handleShowColumn(colour: string) {
    if (!selectedStyle) return;
    showColumnMutation.mutate({ style: selectedStyle, colour });
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
    restoreCancelledSkuMutation.mutate({ style, colour, leather });
  }
  // ─── Spec Status ──────────────────────────────────────────────────────────
  // ─── Bulk Status ─────────────────────────────────────────────────────────────
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  const bulkSetStatusMutation = trpc.specs.bulkSetStatus.useMutation({
    onSuccess: (_data, { styles, status }) => {
      refetchAllSpecMeta();
      setSelectedStyles(new Set());
      setBulkSelectMode(false);
      const label = status === "complete" ? "Complete" : status === "in_progress" ? "In Progress" : "Not Started";
      toast.success(`Marked ${styles.length} style${styles.length === 1 ? "" : "s"} as ${label}`);
    },
    onError: () => toast.error("Failed to update spec status"),
  });

  function handleBulkSetStatus(status: "not_started" | "in_progress" | "complete") {
    if (selectedStyles.size === 0) return;
    bulkSetStatusMutation.mutate({ styles: Array.from(selectedStyles), status });
  }

  function toggleStyleSelection(style: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(style)) next.delete(style); else next.add(style);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedStyles.size === filtered.length) {
      setSelectedStyles(new Set());
    } else {
      setSelectedStyles(new Set(filtered.map((e) => e.style)));
    }
  }

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
  // Spec status for all styles (for sidebar status badges)
  const { data: allSpecMeta = [], refetch: refetchAllSpecMeta } = trpc.specs.getAllMeta.useQuery();
  const specStatusMap = Object.fromEntries(
    allSpecMeta.map((m) => [m.style, (m as any).specStatus as "not_started" | "in_progress" | "complete"])
  );

  // ── Derived data ──────────────────────────────────────────────────────────
  // specs: colour → component → value
  const specs: Record<string, Record<string, string>> = {};
  for (const row of rawSpecs) {
    if (!specs[row.colour]) specs[row.colour] = {};
    specs[row.colour][row.component] = row.value ?? "";
  }

  // allDropdownOptions: component → string[]
  const allDropdownOptions: Record<string, string[]> = {};
  // allDropdownOptionIds: component → { value: id } for edit support
  const allDropdownOptionIds: Record<string, Record<string, number>> = {};
  for (const opt of rawDropdownOptions) {
    if (!allDropdownOptions[opt.component]) allDropdownOptions[opt.component] = [];
    allDropdownOptions[opt.component].push(opt.value);
    if (!allDropdownOptionIds[opt.component]) allDropdownOptionIds[opt.component] = {};
    allDropdownOptionIds[opt.component][opt.value] = opt.id;
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

   const upsertCustomRowMutation = trpc.specCustomRow.upsert.useMutation({
    onMutate: async (updated) => {
      if (!selectedStyle) return;
      await utils.specCustomRow.getByStyle.cancel({ style: updated.style });
      const prev = utils.specCustomRow.getByStyle.getData({ style: updated.style });
      utils.specCustomRow.getByStyle.setData({ style: updated.style }, (old) =>
        old
          ? old.map((r) =>
              r.id === updated.id
                ? { ...r, title: updated.title, value: updated.value ?? r.value, colour: updated.colour ?? r.colour }
                : r
            )
          : old
      );
      return { prev };
    },
    onError: (_err, updated, ctx) => {
      if (ctx?.prev !== undefined) utils.specCustomRow.getByStyle.setData({ style: updated.style }, ctx.prev);
      toast.error("Failed to save custom row");
    },
    onSettled: (_data, _err, updated) => {
      utils.specCustomRow.getByStyle.invalidate({ style: updated.style });
    },
  });
  const addCustomRowMutation = trpc.specCustomRow.upsert.useMutation({
    onMutate: async (newRow) => {
      // Optimistic update: immediately add a placeholder row to the cache
      await utils.specCustomRow.getByStyle.cancel({ style: newRow.style });
      const prev = utils.specCustomRow.getByStyle.getData({ style: newRow.style });
      utils.specCustomRow.getByStyle.setData({ style: newRow.style }, (old) => [
        ...(old ?? []),
        { id: -Date.now(), style: newRow.style, colour: newRow.colour ?? "__all__", section: newRow.section, title: newRow.title, value: newRow.value ?? "", sortOrder: newRow.sortOrder ?? 0, createdAt: new Date(), updatedAt: new Date() },
      ]);
      return { prev };
    },
    onError: (_err, newRow, ctx) => {
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

  // Debounced custom row title/value save
  const customRowTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

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

  function handleUpdateCustomRow(id: number, title: string, value: string) {
    if (!selectedStyle) return;
    // Optimistic update in the cache via refetch after debounce
    if (customRowTimers.current[id]) clearTimeout(customRowTimers.current[id]);
    customRowTimers.current[id] = setTimeout(() => {
      const row = rawCustomRows.find((r: any) => r.id === id);
      if (!row) return;
      upsertCustomRowMutation.mutate({
        id,
        style: (row as any).style,
        colour: (row as any).colour,
        section: (row as any).section,
        title,
        value,
        sortOrder: (row as any).sortOrder,
      });
    }, 600);
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
      // If the __all__ row was exploded into per-colour rows, the old row id is gone.
      // Update the saved rowKeys to replace the old c:{allRowId} with c:{newRepId} so the
      // export can still find the custom row.
      if (result.wasExploded && result.newRepId !== null && result.newRepId !== vars.allRowId && selectedStyle) {
        const oldKey = `c:${vars.allRowId}`;
        const newKey = `c:${result.newRepId}`;
        // Update localRowKeys in SpecForm — but upsertForColourMutation is in the outer SpecsTab.
        // We update the DB rowKeys directly here.
        const currentKeys = exportRowOrderData?.rowKeys ?? null;
        if (currentKeys && currentKeys.includes(oldKey)) {
          const updatedKeys = currentKeys.map((k) => k === oldKey ? newKey : k);
          upsertRowOrderForColourExplosion({ style: selectedStyle, rowKeys: updatedKeys });
        }
      }
    },
    onSettled: () => {
      if (selectedStyle) utils.specCustomRow.getByStyle.invalidate({ style: selectedStyle });
    },
    onError: () => toast.error("Failed to save spec value"),
  });

  const bulkCopyFromStyleMutation = trpc.specCustomRow.bulkCopyFromStyle.useMutation({
    onSettled: () => {
      if (selectedStyle) utils.specCustomRow.getByStyle.invalidate({ style: selectedStyle });
    },
    onError: () => toast.error("Failed to copy custom rows"),
  });

  // Separate mutation to update rowKeys after a colour explosion (used by upsertForColourMutation)
  const upsertRowOrderForColourExplosionMutation = trpc.specRowOrder.upsert.useMutation({
    onSettled: (_data, _err, vars) => {
      utils.specRowOrder.get.invalidate({ style: vars.style });
    },
  });
  function upsertRowOrderForColourExplosion(args: { style: string; rowKeys: string[] }) {
    upsertRowOrderForColourExplosionMutation.mutate(args);
  }

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
    upsertForColourMutation.mutate({
      allRowId: representativeId,
      style: selectedStyle,
      section,
      title,
      sortOrder,
      targetColour: colour,
      newValue,
      currentSharedValue,
      // IMPORTANT: use the UNFILTERED colours list so that hidden columns are still included
      // in the per-colour row explosion. Using selectedEntry.colours (filtered) would omit
      // hidden colours and cause their values to never be saved.
      allColours: selectedEntryRaw?.colours ?? selectedEntry?.colours ?? [],
    });
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
  const { data: allStyleMeta = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery();
  const styleMetaMap = useMemo(
    () => Object.fromEntries(allStyleMeta.map((m: any) => [m.style, m])),
    [allStyleMeta]
  );
  const dbCategory: string | null = selectedStyle ? (styleMetaMap[selectedStyle]?.category ?? null) : null;

  const setCategoryMutation = trpc.style.setCategory.useMutation({
    onSuccess: () => { refetchStyleMeta(); },
    onError: () => toast.error("Failed to save category"),
  });

  function handleSetCategory(category: string | null) {
    if (!selectedStyle) return;
    setCategoryMutation.mutate({ style: selectedStyle, category });
  }

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
          { id: -Date.now(), style: input.style, colour: input.colour, component: input.component, value: input.value, updatedAt: new Date() },
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
      utils.specHiddenColumns.getHidden.invalidate({ style: vars.style });
      utils.cancelledSku.list.invalidate();
      toast.success("Colour added to spec sheet");
    },
    onError: () => toast.error("Failed to add colour"),
  });

  function handleAddSku(colour: string, leather: string) {
    if (!selectedStyle) return;
    addCustomSkuMutation.mutate({ style: selectedStyle, colour, leather });
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

  // Debounced notes save
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleUpsert(colour: string, component: string, value: string) {
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
  }
  // Batch auto-fill: sends all auto-fill rows in a single bulk upsert to avoid 502s from simultaneous mutations
  function handleBulkAutoFill(rows: Array<{ style: string; colour: string; component: string; value: string }>) {
    if (rows.length === 0) return;
    bulkUpsertMutation.mutate(
      { rows, overwrite: false },
      {
        onSuccess: () => {
          utils.specs.getForStyle.invalidate({ style: rows[0].style });
        },
      }
    );
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
      toast.success(`Imported ${result.count} spec values for ${selectedStyle}`);
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

  // Completion stats — uses live rawSpecs for selected style, DB counts for others
  function getCompletionPct(entry: StyleEntry): number {
    const template = getTemplateForCategory(entry.category, {
      hasBuckle: false,
      dressShoeSubType: null,
      style: entry.style,
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
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {styleList.length} styles
            </p>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => { setBulkSelectMode((v) => !v); setSelectedStyles(new Set()); }}
            >
              {bulkSelectMode ? "Cancel" : "Select"}
            </button>
          </div>
          {/* Bulk action toolbar */}
          {bulkSelectMode && selectedStyles.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 items-center">
              <span className="text-xs text-muted-foreground mr-1">{selectedStyles.size} selected:</span>
              <button
                className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60 font-medium"
                onClick={() => handleBulkSetStatus("complete")}
                disabled={bulkSetStatusMutation.isPending}
              >✓ Complete</button>
              <button
                className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60 font-medium"
                onClick={() => handleBulkSetStatus("in_progress")}
                disabled={bulkSetStatusMutation.isPending}
              >In Progress</button>
              <button
                className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 font-medium"
                onClick={() => handleBulkSetStatus("not_started")}
                disabled={bulkSetStatusMutation.isPending}
              >Not Started</button>
            </div>
          )}
          {bulkSelectMode && (
            <button
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleSelectAll}
            >
              {selectedStyles.size === filtered.length ? "Deselect all" : "Select all"}
            </button>
          )}
          {/* Drag-and-drop folder zone */}
          <input
            ref={bulkFileRef}
            type="file"
            accept=".xls,.xlsx"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleBulkImportFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div
            className={`mt-2 rounded-lg border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 py-3 px-2 text-center ${
              isDragOver
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => bulkFileRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            <p className="text-xs font-medium leading-tight">
              {isDragOver ? "Drop to import" : "Bulk Import"}
            </p>
            <p className="text-[10px] leading-tight opacity-70">
              Drop folder or click to select files
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const notStarted = filtered.filter((e) => (specStatusMap[e.style] ?? "not_started") === "not_started");
            const inProgress = filtered.filter((e) => (specStatusMap[e.style] ?? "not_started") === "in_progress");
            const completed = filtered.filter((e) => (specStatusMap[e.style] ?? "not_started") === "complete");

            function StyleRow({ entry }: { entry: StyleEntry }) {
              const isSelected = selectedStyle === entry.style;
              const isBulkChecked = selectedStyles.has(entry.style);
              const status = specStatusMap[entry.style] ?? "not_started";
              const statusBadge = status === "complete"
                ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex-shrink-0">Done</span>
                : status === "in_progress"
                ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex-shrink-0">In Progress</span>
                : null;
              return (
                <button
                  key={entry.style}
                  onClick={() => bulkSelectMode ? toggleStyleSelection(entry.style, { stopPropagation: () => {} } as React.MouseEvent) : setSelectedStyle(entry.style)}
                  className={`w-full text-left px-3 py-2.5 border-b transition-colors hover:bg-muted/50 ${
                    isSelected && !bulkSelectMode ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  } ${isBulkChecked ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {bulkSelectMode && (
                      <Checkbox
                        checked={isBulkChecked}
                        onCheckedChange={() => toggleStyleSelection(entry.style, { stopPropagation: () => {} } as React.MouseEvent)}
                        className="flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {!bulkSelectMode && (entry.imageUrl || imageOverrides[entry.style]) && (
                      <img src={imageOverrides[entry.style] ?? entry.imageUrl} alt={entry.style} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs truncate">{entry.style}</div>
                      <div className="text-xs text-muted-foreground truncate">{entry.category} · {entry.last}</div>
                      <div className="text-xs text-muted-foreground">{entry.colours.length} colours</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!bulkSelectMode && entry.isAllNew && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title="New pattern" />
                      )}
                      {!bulkSelectMode && statusBadge}
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
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-950/20 border-b flex items-center justify-between">
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
                {/* Complete section */}
                {completed.length > 0 && (
                  <>
                    <button
                      className="w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide bg-green-50 dark:bg-green-950/20 border-b flex items-center justify-between hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors"
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
            );
          })()}
        </div>
      </div>

      {/* Right: spec form */}
      <div className="flex-1 overflow-hidden flex flex-col">
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
                      // Export uses the unfiltered entry so hidden columns are still exported
                      colours: selectedEntryRaw?.colours ?? selectedEntry.colours,
                      colourLabels: selectedEntryRaw?.colourLabels ?? selectedEntry.colourLabels,
                      specs,
                      hasBuckle: specMeta?.hasBuckle ?? false,
                      dressShoeSubType: specMeta?.dressShoeSubType ?? null,
                      imageUrl: imageOverrides[selectedEntry.style] ?? selectedEntry.imageUrl,
                      customRows: rawCustomRows as any[],
                      // Pass saved row order so export respects on-screen order and omits deleted rows
                      rowKeys: exportRowOrderData?.rowKeys ?? null,
                    });
                    toast.success(`Exported ${selectedEntry.style} spec sheet`);
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export to Excel
                </Button>
              </div>
            </div>
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
            <div className="flex-1 overflow-y-auto px-6 pb-6">
            <SpecForm
              tableScrollRef={specTableScrollRef}
              entry={selectedEntry}
              toeCapsPerColour={selectedEntry.toeCapsPerColour}
              specMeta={specMeta}
              specs={specs}
              allDropdownOptions={allDropdownOptions}
              allDropdownOptionIds={allDropdownOptionIds}
              allColourLeatherOptions={ALL_COLOUR_LEATHER_OPTIONS}
              imageOverride={imageOverrides[selectedEntry.style]}
              customRows={rawCustomRows as any[]}
              onUpsert={handleUpsert}
              onBulkAutoFill={handleBulkAutoFill}
              onAddDropdownOption={handleAddDropdownOption}
              onDeleteDropdownOption={handleDeleteDropdownOption}
              onEditDropdownOption={handleEditDropdownOption}
              onAddSku={handleAddSku}
              onMetaChange={handleMetaChange}
              onAddCustomRow={handleAddCustomRow}
              onUpdateCustomRow={handleUpdateCustomRow}
              onUpdateCustomRowForColour={handleUpdateCustomRowForColour}
              onDeleteCustomRow={handleDeleteCustomRow}
              onReorderCustomRows={handleReorderCustomRows}
              dbCategory={dbCategory}
              onSetCategory={handleSetCategory}
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
              onBulkCopyCustomRowsFromStyle={(targetColours, rows) => {
                if (!selectedStyle) return;
                bulkCopyFromStyleMutation.mutate({ targetStyle: selectedStyle, targetColours, rows });
              }}
            />
            </div>{/* end scrollable body */}
            {/* Sticky phantom scrollbar — always visible at the bottom of the pane */}
            {selectedEntry && <StickyScrollBar tableScrollRef={specTableScrollRef} />}
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
