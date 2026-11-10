import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";

export interface SpecCustomValueCellProps {
  value: string;
  options: string[];
  optionIds?: Record<string, number>;
  onSave: (val: string) => void;
  onAddOption: (val: string) => void;
  onDeleteOption: (val: string) => void;
  onEditOption?: (id: number, newValue: string) => void;
  /** Used for Tab navigation: "rowId:colIdx". */
  cellId?: string;
}

/** A locally responsive custom-row value editor; persistence belongs to its parent. */
export function SpecCustomValueCell({
  value, options, optionIds, onSave, onAddOption, onDeleteOption, onEditOption, cellId,
}: SpecCustomValueCellProps) {
  const allOptions = Array.from(new Set(options)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const [draft, setDraft] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [editingOpt, setEditingOpt] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(value);
  const baselineRef = useRef(value);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  const onSaveRef = useRef(onSave);
  // Cleanup and delayed blur must use the latest render's callback, not the
  // closure from the render that first mounted or blurred this cell.
  valueRef.current = value;
  onSaveRef.current = onSave;

  useEffect(() => {
    // Also protect the brief pending-blur interval (and an inline option edit).
    // A refetch is not a user edit and must never make the cell dirty.
    if (dirtyRef.current) return;
    baselineRef.current = value;
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [draft]);

  const clearBlurTimer = useCallback(() => {
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    if (!dirtyRef.current) return;
    const nextValue = draftRef.current.trim();
    const changed = nextValue !== baselineRef.current.trim();
    // Clear before invoking the parent: Enter, selection, blur and unmount can
    // all reach this function, but a single edit should be sent only once.
    dirtyRef.current = false;
    baselineRef.current = nextValue;
    draftRef.current = nextValue;
    if (mountedRef.current) setDraft(nextValue);
    if (changed) onSaveRef.current(nextValue);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearBlurTimer();
      flush();
    };
  }, [clearBlurTimer, flush]);

  const filtered = isTyping && draft.trim()
    ? allOptions.filter((opt) => opt.toLowerCase().includes(draft.toLowerCase()))
    : allOptions;
  const isNewValue = draft.trim() !== "" && !allOptions.some((opt) => opt.toLowerCase() === draft.trim().toLowerCase());

  function commit() {
    clearBlurTimer();
    flush();
    setShowSuggestions(false);
    setIsTyping(false);
  }

  function handleSelect(opt: string) {
    draftRef.current = opt;
    dirtyRef.current = opt !== baselineRef.current;
    setDraft(opt);
    commit();
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && !e.shiftKey && cellId) {
      const colPart = cellId.split(":").pop();
      const colIdx = parseInt(colPart ?? "0", 10);
      const allCells = Array.from(document.querySelectorAll<HTMLTextAreaElement>("[data-spec-cell]"))
        .filter((el) => {
          const parts = el.getAttribute("data-spec-cell")?.split(":") ?? [];
          return parseInt(parts[parts.length - 1] ?? "0", 10) === colIdx;
        });
      const currentIdx = allCells.indexOf(inputRef.current!);
      const nextCell = currentIdx >= 0 ? allCells[currentIdx + 1] : undefined;
      if (nextCell) {
        e.preventDefault();
        commit();
        nextCell.focus();
        return;
      }
    }
    if (e.key === "Enter" && e.ctrlKey && isNewValue) {
      e.preventDefault();
      onAddOption(draftRef.current.trim());
      commit();
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      clearBlurTimer();
      // Cancel before blur so neither its timer nor unmount can save the draft.
      dirtyRef.current = false;
      baselineRef.current = valueRef.current;
      draftRef.current = valueRef.current;
      setDraft(valueRef.current);
      setShowSuggestions(false);
      setIsTyping(false);
      inputRef.current?.blur();
    }
  }

  function handleBlur() {
    clearBlurTimer();
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      if (!containerRef.current?.contains(document.activeElement)) {
        flush();
        setShowSuggestions(false);
        setIsTyping(false);
      }
    }, 150);
  }

  const shouldShowDropdown = showSuggestions && (filtered.length > 0 || isNewValue);

  return (
    <div
      ref={containerRef}
      className="relative min-w-[140px] w-full"
      onFocusCapture={clearBlurTimer}
      // Capture focus leaving the inline suggestion editor as well as the cell.
      onBlurCapture={handleBlur}
    >
      <textarea
        ref={inputRef}
        value={draft}
        rows={1}
        data-spec-cell={cellId}
        onChange={(e) => {
          draftRef.current = e.target.value;
          dirtyRef.current = e.target.value !== baselineRef.current;
          setDraft(e.target.value);
          setIsTyping(true);
          setShowSuggestions(true);
        }}
        onFocus={() => { setIsTyping(false); setShowSuggestions(true); }}
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
                        e.preventDefault();
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
          {isNewValue && (
            <div
              className="px-2 py-1.5 text-xs text-blue-600 font-medium hover:bg-accent cursor-pointer border-t border-border"
              onMouseDown={(e) => {
                e.preventDefault();
                onAddOption(draftRef.current.trim());
                commit();
              }}
            >
              + Save "{draft.trim()}" as suggestion
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface SpecCustomTitleInputProps {
  id: number;
  initialTitle: string;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  allTitles: string[];
}

function toProperCase(title: string) {
  return title.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/** Title-only editor: debounce locally; the parent owns database persistence. */
export function SpecCustomTitleInput({
  id, initialTitle, onRename, onDelete, allTitles,
}: SpecCustomTitleInputProps) {
  const [localTitle, setLocalTitle] = useState(() => toProperCase(initialTitle));
  const [open, setOpen] = useState(false);
  const titleRef = useRef(toProperCase(initialTitle));
  const idRef = useRef(id);
  const focusedRef = useRef(false);
  // dirty includes edits already sent while focused; an old response must not
  // replace those either. pending is only the edit waiting to be sent.
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const lastSentRef = useRef(toProperCase(initialTitle));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRenameRef = useRef(onRename);
  onRenameRef.current = onRename;

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    clearSaveTimer();
    if (!pendingRef.current) return;
    const title = titleRef.current;
    pendingRef.current = false;
    if (title === lastSentRef.current) return;
    lastSentRef.current = title;
    onRenameRef.current(idRef.current, title);
  }, [clearSaveTimer]);

  useEffect(() => {
    const changedIdentity = idRef.current !== id;
    if (!changedIdentity && (pendingRef.current || (focusedRef.current && dirtyRef.current))) return;
    if (changedIdentity) flush();
    idRef.current = id;
    dirtyRef.current = false;
    pendingRef.current = false;
    titleRef.current = toProperCase(initialTitle);
    lastSentRef.current = titleRef.current;
    setLocalTitle(titleRef.current);
  }, [id, initialTitle, flush]);

  const clearBlurTimer = useCallback(() => {
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearBlurTimer();
    flush();
  }, [clearBlurTimer, flush]);

  const suggestions = allTitles
    .filter((title) => title && title.toLowerCase().includes(localTitle.toLowerCase()) && title !== localTitle)
    .slice(0, 6);

  function handleChange(title: string) {
    if (title === titleRef.current) return;
    titleRef.current = title;
    dirtyRef.current = true;
    pendingRef.current = title !== lastSentRef.current;
    setLocalTitle(title);
    // Do not send a captured value alongside the title. The parent merges a
    // rename with the latest row values; typing stays entirely local for 500ms.
    clearSaveTimer();
    if (pendingRef.current) saveTimerRef.current = setTimeout(flush, 500);
  }

  return (
    <div className="flex items-center gap-1.5 relative">
      <input
        className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-transparent border-0 border-b border-dashed border-amber-300 dark:border-amber-700 focus:outline-none focus:border-amber-500 w-full min-w-0 placeholder:text-amber-400/60"
        value={localTitle}
        placeholder="Field name…"
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { clearBlurTimer(); focusedRef.current = true; setOpen(true); }}
        onBlur={() => {
          clearBlurTimer();
          // Stage the rename synchronously, before parent navigation/unmount.
          flush();
          blurTimerRef.current = setTimeout(() => {
            blurTimerRef.current = null;
            focusedRef.current = false;
            dirtyRef.current = false;
            setOpen(false);
          }, 150);
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md min-w-[180px] py-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="w-full text-left text-xs px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => { e.preventDefault(); handleChange(suggestion); flush(); setOpen(false); }}
            >
              {suggestion}
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
