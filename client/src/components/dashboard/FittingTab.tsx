import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Upload, X, ImageIcon, Download, CheckCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const NEW_LASTS = [
  "DAZIE", "SIA", "SALLY", "TIANA", "BILLIE", "MATISSE",
  "EDGY", "EMBER", "TILDA", "LUCY", "ENVY", "FINCH",
  "HARLEY", "JAYDE", "ROXIE", "VIVA", "PIXIE",
];

export const FIT_LABELS: Record<string, string> = {
  tts: "True to Size",
  runs_small: "Runs Small",
  runs_large: "Runs Large",
};

export const FIT_COLOURS: Record<string, string> = {
  tts: "bg-green-100 text-green-800 border-green-200",
  runs_small: "bg-amber-100 text-amber-800 border-amber-200",
  runs_large: "bg-blue-100 text-blue-800 border-blue-200",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface StyleEntry {
  style: string;
  last: string;
  category: string;
  imageUrl?: string;
  hasNew: boolean;
  isAllNew: boolean;
  newSKUs: number;
  totalSKUs: number;
}

// ─── Build style list: all styles on new lasts ───────────────────────────────

function buildStyleList(): StyleEntry[] {
  return skuData.styles
    .filter((s) => {
      const lastUpper = s.last?.toUpperCase() ?? "";
      return NEW_LASTS.some((nl) => lastUpper.includes(nl));
    })
    .map((s) => ({
      style: s.style,
      last: s.last,
      category: s.category,
      imageUrl: s.imageUrl,
      hasNew: s.hasNew,
      isAllNew: s.isAllNew,
      newSKUs: s.newSKUs,
      totalSKUs: s.totalSKUs,
    }))
    .sort((a, b) => a.last.localeCompare(b.last) || a.style.localeCompare(b.style));
}

// ─── Style Row ────────────────────────────────────────────────────────────────

function StyleFitRow({
  entry,
  styleMeta,
  allImages,
  onFitUpdate,
  onImageUpload,
  onImageDelete,
  onApprove,
  onUndoApproval,
}: {
  entry: StyleEntry;
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null }>;
  allImages: Array<{ id: number; style: string; imageUrl: string; fileKey: string }>;
  onFitUpdate: (style: string, fitRating: string | null, notes: string | null) => void;
  onImageUpload: (style: string, file: File) => void;
  onImageDelete: (id: number) => void;
  onApprove: (style: string) => void;
  onUndoApproval: (style: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localFit, setLocalFit] = useState<string | null | undefined>(undefined);
  const [localNotes, setLocalNotes] = useState<string | null | undefined>(undefined);
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meta = styleMeta[entry.style];
  const fitRating = localFit !== undefined ? localFit : (meta?.fitRating ?? null);
  const fittingNotes = localNotes !== undefined ? localNotes : (meta?.fittingNotes ?? "");
  const isApproved = meta?.fitApproved ?? false;
  const images = allImages.filter((img) => img.style === entry.style);
  const hasFitData = !!(fitRating || fittingNotes || images.length > 0);

  const handleFitChange = (val: string) => {
    const newVal = val === "none" ? null : val;
    setLocalFit(newVal);
    onFitUpdate(entry.style, newVal, fittingNotes || null);
  };

  const handleNotesChange = (val: string) => {
    setLocalNotes(val);
    if (notesTimer) clearTimeout(notesTimer);
    const t = setTimeout(() => {
      onFitUpdate(entry.style, fitRating || null, val || null);
    }, 800);
    setNotesTimer(t);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageUpload(entry.style, file);
    e.target.value = "";
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${isApproved ? "border-green-200 bg-green-50/30" : "border-border bg-card"}`}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        {entry.imageUrl && (
          <img src={entry.imageUrl} alt={entry.style} className="w-10 h-10 object-cover rounded" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{entry.style}</span>
            <span className="text-xs text-muted-foreground">{entry.last}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{entry.category}</span>
            {entry.isAllNew && (
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">All New</Badge>
            )}
            {!entry.isAllNew && entry.hasNew && (
              <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">{entry.newSKUs} New</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isApproved && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
              <CheckCircle className="w-3 h-3" /> Approved
            </span>
          )}
          {fitRating && !isApproved && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${FIT_COLOURS[fitRating]}`}>
              {FIT_LABELS[fitRating]}
            </span>
          )}
          {images.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="w-3 h-3" />{images.length}
            </span>
          )}
          {hasFitData && !fitRating && !isApproved && (
            <span className="text-[10px] text-muted-foreground italic">Has notes</span>
          )}
        </div>
      </button>

      {/* Expanded fit panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fit Rating */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fit Rating</label>
              <Select value={fitRating ?? "none"} onValueChange={handleFitChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select fit rating..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No rating —</SelectItem>
                  <SelectItem value="tts">True to Size</SelectItem>
                  <SelectItem value="runs_small">Runs Small</SelectItem>
                  <SelectItem value="runs_large">Runs Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fitting Images</label>
              <div className="flex items-center gap-2 flex-wrap">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.imageUrl}
                      alt="Fitting"
                      className="w-14 h-14 object-cover rounded border border-border"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); onImageDelete(img.id); }}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="w-14 h-14 border-2 border-dashed border-border rounded flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-[9px] mt-0.5">Add</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </div>
            </div>
          </div>

          {/* Fitting Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fitting Notes</label>
            <Textarea
              value={fittingNotes ?? ""}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Enter fitting notes, measurements, adjustments needed..."
              className="text-sm min-h-[80px] resize-none"
            />
          </div>

          {/* Approve / Undo buttons */}
          <div className="flex items-center justify-end pt-1 border-t border-border">
            {!isApproved ? (
              <Button
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={(e) => { e.stopPropagation(); onApprove(entry.style); setExpanded(false); }}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve Fit
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); onUndoApproval(entry.style); }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo Approval
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FittingTab() {
  const [exportOpen, setExportOpen] = useState(false);
  const [fitModel, setFitModel] = useState("");
  const [fitDate, setFitDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [exporting, setExporting] = useState(false);
  const [approvedSectionOpen, setApprovedSectionOpen] = useState(false);

  const styleList = buildStyleList();

  // Data queries
  const { data: styleMetaList = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery();
  const { data: allImages = [], refetch: refetchImages } = trpc.styleFitting.getAll.useQuery();

  const styleMeta = styleMetaList.reduce<Record<string, { fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null; rrp?: number | null }>>(
    (acc, m) => { acc[m.style] = m; return acc; }, {}
  );

  // Split into active (not approved) and approved
  const activeStyles = styleList.filter((s) => !styleMeta[s.style]?.fitApproved);
  const approvedStyles = styleList.filter((s) => styleMeta[s.style]?.fitApproved);

  // Group active by last
  const byLast = activeStyles.reduce<Record<string, StyleEntry[]>>((acc, s) => {
    if (!acc[s.last]) acc[s.last] = [];
    acc[s.last].push(s);
    return acc;
  }, {});
  const sortedLasts = Object.keys(byLast).sort();

  // Mutations
  const updateFit = trpc.styleFitting.updateFit.useMutation({
    onSuccess: () => { refetchStyleMeta(); },
  });

  const uploadImage = trpc.styleFitting.uploadImage.useMutation({
    onSuccess: () => refetchImages(),
    onError: () => toast.error("Upload failed"),
  });

  const deleteImage = trpc.styleFitting.deleteImage.useMutation({
    onSuccess: () => refetchImages(),
  });

  const handleFitUpdate = useCallback((style: string, fitRating: string | null, notes: string | null) => {
    updateFit.mutate({ style, fitRating: fitRating as "tts" | "runs_small" | "runs_large" | null, fittingNotes: notes });
  }, [updateFit]);

  const handleApprove = useCallback((style: string) => {
    const meta = styleMetaList.find((m) => m.style === style);
    updateFit.mutate({
      style,
      fitRating: (meta?.fitRating ?? null) as "tts" | "runs_small" | "runs_large" | null,
      fittingNotes: meta?.fittingNotes ?? null,
      fitApproved: true,
    });
    toast.success(`${style} fit approved`);
  }, [updateFit, styleMetaList]);

  const handleUndoApproval = useCallback((style: string) => {
    const meta = styleMetaList.find((m) => m.style === style);
    updateFit.mutate({
      style,
      fitRating: (meta?.fitRating ?? null) as "tts" | "runs_small" | "runs_large" | null,
      fittingNotes: meta?.fittingNotes ?? null,
      fitApproved: false,
    });
    toast.success(`${style} approval undone`);
  }, [updateFit, styleMetaList]);

  const handleImageUpload = useCallback((style: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      uploadImage.mutate({ style, imageData, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }, [uploadImage]);

  const handleImageDelete = useCallback((id: number) => {
    deleteImage.mutate({ id });
  }, [deleteImage]);

  // Export fitting report
  const handleExport = async () => {
    setExporting(true);
    try {
      const stylesWithData = styleList.filter((s) => {
        const meta = styleMeta[s.style];
        return meta?.fitRating || meta?.fittingNotes;
      });

      if (stylesWithData.length === 0) {
        toast.error("No fitting data to export", { description: "Add fit ratings or notes to at least one style first." });
        setExporting(false);
        return;
      }

      const rows = stylesWithData.map((s) => {
        const meta = styleMeta[s.style];
        const imgs = allImages.filter((img) => img.style === s.style);
        const fitLabel = meta?.fitRating ? FIT_LABELS[meta.fitRating] : "—";
        const notes = meta?.fittingNotes ?? "—";
        const approvedBadge = meta?.fitApproved
          ? `<span style="display:inline-block;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">✓ Approved</span>`
          : "";
        const imgHtml = imgs.length > 0
          ? imgs.map((img) => `<img src="${img.imageUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;margin:2px;" />`).join("")
          : "<span style='color:#999;font-size:12px;'>No images</span>";

        const fitColour = meta?.fitRating === "tts" ? "#166534" : meta?.fitRating === "runs_small" ? "#92400e" : meta?.fitRating === "runs_large" ? "#1e40af" : "#666";

        return `
          <tr style="border-bottom:1px solid #eee;page-break-inside:avoid;">
            <td style="padding:12px 8px;vertical-align:top;width:90px;">
              ${s.imageUrl ? `<img src="${s.imageUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;" />` : "<span style='color:#999;font-size:12px;'>No image</span>"}
            </td>
            <td style="padding:12px 8px;vertical-align:top;width:130px;">
              <strong style="font-size:13px;">${s.style}</strong><br/>
              <span style="font-size:11px;color:#666;">${s.last} · ${s.category}</span><br/>
              <div style="margin-top:4px;">${approvedBadge}</div>
            </td>
            <td style="padding:12px 8px;vertical-align:top;width:110px;">
              <span style="font-size:12px;font-weight:600;color:${fitColour};">${fitLabel}</span>
            </td>
            <td style="padding:12px 8px;vertical-align:top;">
              <span style="font-size:12px;color:#333;">${notes}</span>
            </td>
            <td style="padding:12px 8px;vertical-align:top;width:200px;">${imgHtml}</td>
          </tr>
        `;
      }).join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <title>Fitting Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .meta { font-size: 13px; color: #555; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; padding: 8px; border-bottom: 2px solid #ddd; }
            @media print { body { margin: 16px; } }
          </style>
        </head>
        <body>
          <h1>Fitting Report</h1>
          <div class="meta">
            ${fitModel ? `<strong>Fit Model:</strong> ${fitModel} &nbsp;&nbsp;` : ""}
            ${fitDate ? `<strong>Date:</strong> ${fitDate}` : ""}
            &nbsp;&nbsp;<strong>Approved:</strong> ${approvedStyles.length} / ${styleList.length} styles
          </div>
          <table>
            <thead>
              <tr>
                <th>Style Image</th>
                <th>Style</th>
                <th>Fit Rating</th>
                <th>Fitting Notes</th>
                <th>Fitting Images</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Fitting_Report_${fitDate || "export"}.html`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${stylesWithData.length} styles`, { description: "Open in browser and use Print → Save as PDF." });
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };

  const stylesWithFitData = styleList.filter((s) => {
    const meta = styleMeta[s.style];
    return meta?.fitRating || meta?.fittingNotes;
  }).length;

  const rowProps = {
    styleMeta,
    allImages: allImages as Array<{ id: number; style: string; imageUrl: string; fileKey: string }>,
    onFitUpdate: handleFitUpdate,
    onImageUpload: handleImageUpload,
    onImageDelete: handleImageDelete,
    onApprove: handleApprove,
    onUndoApproval: handleUndoApproval,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fitting</h2>
          <p className="text-sm text-muted-foreground">
            {styleList.length} styles on new lasts.
            {approvedStyles.length > 0 && ` ${approvedStyles.length} approved, ${activeStyles.length} remaining.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Export dialog */}
      {exportOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-base">Export Fitting Report</h3>
            <p className="text-sm text-muted-foreground">
              Exports all styles with fit ratings or notes. Open as HTML and print to PDF.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fit Model (optional)</label>
                <input
                  type="text"
                  value={fitModel}
                  onChange={(e) => setFitModel(e.target.value)}
                  placeholder="e.g. Sarah, Size 38"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={fitDate}
                  onChange={(e) => setFitDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setExportOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting..." : `Export ${stylesWithFitData} Styles`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active styles grouped by last */}
      {activeStyles.length === 0 && approvedStyles.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm font-medium text-green-700">All styles have been approved!</p>
          <p className="text-xs mt-1">See the Approved section below to review or make changes.</p>
        </div>
      )}

      {sortedLasts.map((last) => (
        <div key={last} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{last}</h3>
            <span className="text-xs text-muted-foreground">({byLast[last].length} styles)</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {byLast[last].map((entry) => (
              <StyleFitRow key={entry.style} entry={entry} {...rowProps} />
            ))}
          </div>
        </div>
      ))}

      {activeStyles.length === 0 && approvedStyles.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No styles found on new lasts.</p>
        </div>
      )}

      {/* Approved section — collapsed by default */}
      {approvedStyles.length > 0 && (
        <div className="border border-green-200 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-green-50/60 hover:bg-green-50 transition-colors"
            onClick={() => setApprovedSectionOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">
                Approved ({approvedStyles.length} {approvedStyles.length === 1 ? "style" : "styles"})
              </span>
              <span className="text-xs text-green-600">— fit confirmed, notes saved</span>
            </div>
            {approvedSectionOpen
              ? <ChevronDown className="w-4 h-4 text-green-600" />
              : <ChevronRight className="w-4 h-4 text-green-600" />}
          </button>

          {approvedSectionOpen && (
            <div className="p-4 space-y-2 bg-green-50/20">
              {approvedStyles.map((entry) => (
                <StyleFitRow key={entry.style} entry={entry} {...rowProps} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
