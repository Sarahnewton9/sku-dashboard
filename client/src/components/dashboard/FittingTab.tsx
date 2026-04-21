import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { skuData } from "@/lib/skuData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Upload, X, ImageIcon, Download } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const NEW_LASTS = [
  "DAZIE", "SIA", "SALLY", "TIANA", "BILLIE", "MATISSE",
  "EDGY", "EMBER", "TILDA", "LUCY", "ENVY", "FINCH",
  "HARLEY", "JAYDE", "ROXIE", "VIVA", "PIXIE",
];

const FIT_LABELS: Record<string, string> = {
  tts: "True to Size",
  runs_small: "Runs Small",
  runs_large: "Runs Large",
};

const FIT_COLOURS: Record<string, string> = {
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
}: {
  entry: StyleEntry;
  styleMeta: Record<string, { fitRating?: string | null; fittingNotes?: string | null; rrp?: number | null }>;
  allImages: Array<{ id: number; style: string; imageUrl: string; fileKey: string }>;
  onFitUpdate: (style: string, fitRating: string | null, notes: string | null) => void;
  onImageUpload: (style: string, file: File) => void;
  onImageDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localFit, setLocalFit] = useState<string | null | undefined>(undefined);
  const [localNotes, setLocalNotes] = useState<string | null | undefined>(undefined);
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meta = styleMeta[entry.style];
  const fitRating = localFit !== undefined ? localFit : (meta?.fitRating ?? null);
  const fittingNotes = localNotes !== undefined ? localNotes : (meta?.fittingNotes ?? "");
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
    <div className="border border-border rounded-lg overflow-hidden bg-card">
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
          {fitRating && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${FIT_COLOURS[fitRating]}`}>
              {FIT_LABELS[fitRating]}
            </span>
          )}
          {images.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="w-3 h-3" />{images.length}
            </span>
          )}
          {hasFitData && !fitRating && (
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
                      onClick={() => onImageDelete(img.id)}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
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

  const styleList = buildStyleList();

  // Group by last
  const byLast = styleList.reduce<Record<string, StyleEntry[]>>((acc, s) => {
    if (!acc[s.last]) acc[s.last] = [];
    acc[s.last].push(s);
    return acc;
  }, {});
  const sortedLasts = Object.keys(byLast).sort();

  // Data queries
  const { data: styleMetaList = [] } = trpc.style.getAll.useQuery();
  const { data: allImages = [], refetch: refetchImages } = trpc.styleFitting.getAll.useQuery();

  const styleMeta = styleMetaList.reduce<Record<string, { fitRating?: string | null; fittingNotes?: string | null; rrp?: number | null }>>(
    (acc, m) => { acc[m.style] = m; return acc; }, {}
  );

  // Mutations
  const updateFit = trpc.styleFitting.updateFit.useMutation({
    onSuccess: () => trpc.useUtils().style.getAll.invalidate(),
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

  // Export fitting report as CSV/text summary (PDF generation in browser)
  const handleExport = async () => {
    setExporting(true);
    try {
      const stylesWithData = styleList.filter((s) => {
        const meta = styleMeta[s.style];
        const imgs = allImages.filter((img) => img.style === s.style);
        return meta?.fitRating || meta?.fittingNotes || imgs.length > 0;
      });

      if (stylesWithData.length === 0) {
        toast.error("No fitting data to export", { description: "Add fit ratings or notes to at least one style first." });
        setExporting(false);
        return;
      }

      // Build HTML for print/PDF
      const rows = stylesWithData.map((s) => {
        const meta = styleMeta[s.style];
        const imgs = allImages.filter((img) => img.style === s.style);
        const fitLabel = meta?.fitRating ? FIT_LABELS[meta.fitRating] : "—";
        const notes = meta?.fittingNotes ?? "—";
        const imgHtml = imgs.length > 0
          ? imgs.map((img) => `<img src="${img.imageUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;margin:2px;" />`).join("")
          : "<span style='color:#999;font-size:12px;'>No images</span>";

        return `
          <tr style="border-bottom:1px solid #eee;page-break-inside:avoid;">
            <td style="padding:12px 8px;vertical-align:top;width:90px;">
              ${s.imageUrl ? `<img src="${s.imageUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;" />` : "<span style='color:#999;font-size:12px;'>No image</span>"}
            </td>
            <td style="padding:12px 8px;vertical-align:top;width:120px;">
              <strong style="font-size:13px;">${s.style}</strong><br/>
              <span style="font-size:11px;color:#666;">${s.last} · ${s.category}</span>
            </td>
            <td style="padding:12px 8px;vertical-align:top;width:110px;">
              <span style="font-size:12px;font-weight:600;color:${meta?.fitRating === 'tts' ? '#166534' : meta?.fitRating === 'runs_small' ? '#92400e' : meta?.fitRating === 'runs_large' ? '#1e40af' : '#666'};">
                ${fitLabel}
              </span>
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

      toast.success(`Exported ${stylesWithData.length} styles`, { description: "Open the downloaded file in a browser and use Print → Save as PDF." });
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };

  const stylesWithFitData = styleList.filter((s) => {
    const meta = styleMeta[s.style];
    const imgs = allImages.filter((img) => img.style === s.style);
    return meta?.fitRating || meta?.fittingNotes || imgs.length > 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fitting</h2>
          <p className="text-sm text-muted-foreground">
            All styles on new lasts — {styleList.length} styles across {sortedLasts.length} lasts.
            {stylesWithFitData > 0 && ` ${stylesWithFitData} with fit data.`}
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
              Exports all styles with fit ratings, notes, or images. Opens as HTML — print to PDF from your browser.
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

      {/* Styles grouped by last */}
      {sortedLasts.map((last) => (
        <div key={last} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{last}</h3>
            <span className="text-xs text-muted-foreground">({byLast[last].length} styles)</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {byLast[last].map((entry) => (
              <StyleFitRow
                key={entry.style}
                entry={entry}
                styleMeta={styleMeta}
                allImages={allImages as Array<{ id: number; style: string; imageUrl: string; fileKey: string }>}
                onFitUpdate={handleFitUpdate}
                onImageUpload={handleImageUpload}
                onImageDelete={handleImageDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {styleList.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No styles found on new lasts.</p>
        </div>
      )}
    </div>
  );
}
