/**
 * PptxSyncModal — Upload a range review PPTX, parse it, review the diff,
 * and apply changes (cancel red SKUs, mark specked SKUs).
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload, X, CheckCircle, XCircle, AlertCircle, FileText,
  ChevronDown, ChevronUp, Loader2, RefreshCw
} from "lucide-react";

type DiffItem = {
  last: string;
  style: string;
  colour: string;
  leather: string;
  pptxStatus: string;
  currentStatus: string;
  action: string;
};

type ParseResult = {
  slideCount: number;
  toCancel: DiffItem[];
  toMarkSpecked: DiffItem[];
  toMarkSpeckedNoSample: DiffItem[];
  missingFromDb: DiffItem[];
  alreadyCancelled: DiffItem[];
};

type Props = {
  onClose: () => void;
  onApplied: () => void;
};

function DiffSection({
  title,
  items,
  colour,
  icon,
  defaultOpen = false,
}: {
  title: string;
  items: DiffItem[];
  colour: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: colour + "40" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
        style={{ background: colour + "10" }}
      >
        <span style={{ color: colour }}>{icon}</span>
        <span className="font-semibold text-sm flex-1" style={{ color: colour }}>
          {title}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: colour + "20", color: colour }}
        >
          {items.length}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="divide-y" style={{ borderColor: colour + "20" }}>
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2 text-xs"
            >
              <span className="text-muted-foreground w-20 flex-shrink-0 font-mono">{item.last}</span>
              <span className="font-semibold text-foreground w-24 flex-shrink-0">{item.style}</span>
              <span className="text-foreground flex-1">
                {item.colour} {item.leather}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PptxSyncModal({ onClose, onApplied }: Props) {
  const [step, setStep] = useState<"upload" | "parsing" | "review" | "applying" | "done">("upload");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildDiffMutation = trpc.pptxSync.buildDiff.useMutation();

  const applyMutation = trpc.pptxSync.applyChanges.useMutation({
    onSuccess: (data) => {
      setStep("done");
      toast.success(
        `Sync applied: ${data.cancelled} cancelled, ${data.specked} marked specked, ${data.speckedNoSample} marked specked (no sample)`
      );
      onApplied();
    },
    onError: (err) => {
      toast.error(`Apply failed: ${err.message}`);
      setStep("review");
    },
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".pptx")) {
      toast.error("Please select a .pptx file");
      return;
    }
    setFileName(file.name);
    setStep("parsing");

    try {
      // Use multipart upload to handle large PPTX files (>10MB)
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pptx-upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Upload failed");
      }
      const { parsed } = await res.json();

      // Build diff via tRPC mutation (POST) to handle large parsed payloads
      const data = await buildDiffMutation.mutateAsync({ parsed });
      if (!data) throw new Error("Failed to build diff");
      setResult(data);
      setStep("review");
    } catch (err: any) {
      toast.error(`Parse failed: ${err.message}`);
      setStep("upload");
    }
  }

  function handleApply() {
    if (!result) return;
    setStep("applying");
    applyMutation.mutate({
      cancelSkus: result.toCancel.map((i) => ({
        style: i.style,
        colour: i.colour,
        leather: i.leather,
      })),
      markSpecked: result.toMarkSpecked.map((i) => ({
        style: i.style,
        colour: i.colour,
        leather: i.leather,
      })),
      markSpeckedNoSample: result.toMarkSpeckedNoSample.map((i) => ({
        style: i.style,
        colour: i.colour,
        leather: i.leather,
      })),
    });
  }

  const totalChanges = result
    ? result.toCancel.length + result.toMarkSpecked.length + result.toMarkSpeckedNoSample.length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl bg-card overflow-hidden flex flex-col"
        style={{ border: "1px solid var(--border)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "oklch(0.92 0.06 260)" }}
          >
            <FileText className="w-5 h-5" style={{ color: "oklch(0.40 0.14 260)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-foreground">Sync from Range Review PPTX</p>
            <p className="text-xs text-muted-foreground">
              Upload your range review PowerPoint to auto-cancel red SKUs and update sample status
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Upload step */}
          {step === "upload" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-4 p-10 rounded-xl border-2 border-dashed transition-all hover:bg-muted/20"
                style={{ borderColor: "oklch(0.75 0.10 260)" }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "oklch(0.92 0.06 260)" }}
                >
                  <Upload className="w-7 h-7" style={{ color: "oklch(0.40 0.14 260)" }} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">Click to select your range review PPTX</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The file will be parsed locally on the server — no data leaves your system
                  </p>
                </div>
              </button>
              <div className="mt-4 rounded-xl p-4 text-xs space-y-1.5" style={{ background: "oklch(0.97 0.02 260)", border: "1px solid oklch(0.88 0.04 260)" }}>
                <p className="font-semibold text-foreground mb-2">Highlight colour key</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#FF00FF" }} />
                    <span className="text-muted-foreground">Magenta — specked, sample here</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#00FFFF" }} />
                    <span className="text-muted-foreground">Cyan — specked, no sample yet</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#FFFF00", border: "1px solid #ccc" }} />
                    <span className="text-muted-foreground">Yellow — not specked yet</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#FF0000" }} />
                    <span className="text-muted-foreground">Red — cancelled</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "transparent", border: "1px solid #ccc" }} />
                    <span className="text-muted-foreground">No highlight — carry over</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Parsing step */}
          {step === "parsing" && (
            <div className="flex flex-col items-center gap-6 py-10">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: "oklch(0.40 0.14 260)" }} />
              <div className="text-center">
                <p className="font-semibold text-foreground">Parsing {fileName}…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Reading slides, extracting styles, SKUs, and highlight colours
                </p>
              </div>
            </div>
          )}

          {/* Review step */}
          {step === "review" && result && (
            <div className="space-y-3">
              {/* Summary */}
              <div
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: "oklch(0.96 0.02 260)", border: "1px solid oklch(0.88 0.04 260)" }}
              >
                <FileText className="w-8 h-8 flex-shrink-0" style={{ color: "oklch(0.40 0.14 260)" }} />
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.slideCount} slides parsed · {totalChanges} changes to apply
                  </p>
                </div>
                {totalChanges === 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "oklch(0.50 0.15 145)" }}>
                    <CheckCircle className="w-4 h-4" />
                    Already in sync
                  </div>
                )}
              </div>

              {totalChanges === 0 && result.alreadyCancelled.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No changes needed — the dashboard already reflects the PPTX.
                </div>
              )}

              <DiffSection
                title="SKUs to cancel (red in PPTX)"
                items={result.toCancel}
                colour="#EF4444"
                icon={<XCircle className="w-4 h-4" />}
                defaultOpen={true}
              />
              <DiffSection
                title="SKUs to mark as specked — sample here (magenta)"
                items={result.toMarkSpecked}
                colour="#A855F7"
                icon={<CheckCircle className="w-4 h-4" />}
                defaultOpen={true}
              />
              <DiffSection
                title="SKUs to mark as specked — no sample yet (cyan)"
                items={result.toMarkSpeckedNoSample}
                colour="#06B6D4"
                icon={<AlertCircle className="w-4 h-4" />}
                defaultOpen={false}
              />
              <DiffSection
                title="Already cancelled (no action needed)"
                items={result.alreadyCancelled}
                colour="#6B7280"
                icon={<CheckCircle className="w-4 h-4" />}
                defaultOpen={false}
              />
            </div>
          )}

          {/* Applying step */}
          {step === "applying" && (
            <div className="flex flex-col items-center gap-6 py-10">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: "oklch(0.40 0.14 260)" }} />
              <div className="text-center">
                <p className="font-semibold text-foreground">Applying changes…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cancelling SKUs and updating sample status
                </p>
              </div>
            </div>
          )}

          {/* Done step */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-6 py-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "oklch(0.92 0.10 145)" }}
              >
                <CheckCircle className="w-9 h-9" style={{ color: "oklch(0.45 0.18 145)" }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-foreground text-lg">Sync complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All changes have been applied. The dashboard will refresh automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t gap-3" style={{ borderColor: "var(--border)" }}>
          {step === "review" && (
            <button
              onClick={() => {
                setStep("upload");
                setResult(null);
                setFileName("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-muted"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Upload different file
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {step === "done" ? "Close" : "Cancel"}
          </button>
          {step === "review" && totalChanges > 0 && (
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
              style={{ background: "oklch(0.40 0.14 260)", color: "white" }}
            >
              Apply {totalChanges} change{totalChanges !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
