/**
 * AP21ColourCodeModal
 *
 * Shown when the AP21 export encounters colour descriptions that don't yet
 * have a code in the colour_codes table. For each missing description the
 * modal:
 *   1. Fires a server-side AI suggestion (colourCode.suggestCode)
 *   2. Pre-fills the editable input with the suggestion
 *   3. Lets the user override any code before saving
 *   4. On "Save & Export" → upserts all codes then calls onConfirm()
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Wand2, Check, Loader2, AlertCircle } from "lucide-react";

interface Props {
  /** UPPERCASE colour descriptions that have no code yet */
  missingDescriptions: string[];
  /** Called after all codes are saved — triggers the actual CSV download */
  onConfirm: () => void;
  onCancel: () => void;
}

interface CodeEntry {
  description: string;
  code: string;
  suggested: string;
  loadingSuggestion: boolean;
  saved: boolean;
}

export default function AP21ColourCodeModal({ missingDescriptions, onConfirm, onCancel }: Props) {
  const [entries, setEntries] = useState<CodeEntry[]>(() =>
    missingDescriptions.map((d) => ({
      description: d,
      code: "",
      suggested: "",
      loadingSuggestion: true,
      saved: false,
    }))
  );
  const [saving, setSaving] = useState(false);
  const upsertMutation = trpc.colourCode.upsert.useMutation();
  const utils = trpc.useUtils();

  // Fire suggestCode queries for each description
  // We do this imperatively so we can handle individual loading states
  const suggestFired = useRef(false);

  useEffect(() => {
    if (suggestFired.current) return;
    suggestFired.current = true;

    // Fire suggestions sequentially to avoid hammering the LLM
    (async () => {
      for (let i = 0; i < missingDescriptions.length; i++) {
        const desc = missingDescriptions[i];
        try {
          const result = await utils.colourCode.suggestCode.fetch({ description: desc });
          const suggested = result?.code ?? "";
          setEntries((prev) =>
            prev.map((e, idx) =>
              idx === i
                ? { ...e, code: suggested, suggested, loadingSuggestion: false }
                : e
            )
          );
        } catch {
          // Fallback: deterministic abbreviation
          const fallback = buildFallbackCode(desc);
          setEntries((prev) =>
            prev.map((e, idx) =>
              idx === i
                ? { ...e, code: fallback, suggested: fallback, loadingSuggestion: false }
                : e
            )
          );
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function buildFallbackCode(desc: string): string {
    const parts = desc.replace(/[^A-Z0-9 ]/g, " ").trim().split(/\s+/);
    if (parts.length >= 2) {
      const colourPart = parts.slice(0, parts.length - 1).join("").slice(0, 5);
      const materialPart = parts[parts.length - 1].slice(0, 4);
      return `${colourPart}-${materialPart}`;
    }
    return parts[0]?.slice(0, 6) ?? "UNK";
  }

  function updateCode(index: number, value: string) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, code: value.toUpperCase() } : e))
    );
  }

  function resetToSuggestion(index: number) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, code: e.suggested } : e))
    );
  }

  async function handleSaveAndExport() {
    // Validate all codes are filled
    const empty = entries.filter((e) => !e.code.trim());
    if (empty.length > 0) {
      toast.error(`Please fill in all colour codes before exporting.`);
      return;
    }

    setSaving(true);
    try {
      for (const entry of entries) {
        await upsertMutation.mutateAsync({
          description: entry.description,
          code: entry.code.trim(),
        });
      }
      // Invalidate so the export can pick up the new codes
      await utils.colourCode.getAll.invalidate();
      toast.success(`Saved ${entries.length} colour code${entries.length !== 1 ? "s" : ""}`);
      onConfirm();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save colour codes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const allLoaded = entries.every((e) => !e.loadingSuggestion);
  const allFilled = entries.every((e) => e.code.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl flex flex-col"
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "oklch(0.25 0.05 30 / 0.15)" }}
          >
            <AlertCircle className="w-5 h-5" style={{ color: "oklch(0.55 0.18 30)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-base text-foreground">Missing Colour Codes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {entries.length} colour{entries.length !== 1 ? "s" : ""} need a code before the AP21 export can be generated.
              AI-suggested codes are pre-filled — edit any that don't look right.
            </p>
          </div>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {entries.map((entry, i) => (
            <div
              key={entry.description}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              {/* Description */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{entry.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Colour description</p>
              </div>

              {/* Code input */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {entry.loadingSuggestion ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Suggesting…</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={entry.code}
                      onChange={(e) => updateCode(i, e.target.value)}
                      placeholder="e.g. BLK-SDE"
                      maxLength={20}
                      className="w-28 px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg text-center uppercase"
                      style={{
                        background: "var(--background)",
                        border: `1px solid ${entry.code !== entry.suggested && entry.suggested ? "oklch(0.55 0.18 30)" : "var(--border)"}`,
                        color: "var(--foreground)",
                        outline: "none",
                      }}
                    />
                    {entry.suggested && entry.code !== entry.suggested && (
                      <button
                        onClick={() => resetToSuggestion(i)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors"
                        style={{ background: "oklch(0.25 0.05 30 / 0.1)", color: "oklch(0.55 0.18 30)" }}
                        title={`Reset to AI suggestion: ${entry.suggested}`}
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>{entry.suggested}</span>
                      </button>
                    )}
                    {entry.code === entry.suggested && entry.suggested && (
                      <div className="flex items-center gap-1 px-2 py-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        <Wand2 className="w-3 h-3" />
                        <span>AI</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs text-muted-foreground">
            {allLoaded
              ? allFilled
                ? `All ${entries.length} codes ready`
                : `${entries.filter((e) => !e.code.trim()).length} code${entries.filter((e) => !e.code.trim()).length !== 1 ? "s" : ""} still empty`
              : "Generating AI suggestions…"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-muted disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndExport}
              disabled={!allLoaded || !allFilled || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: "oklch(0.30 0.08 145)" }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save &amp; Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
