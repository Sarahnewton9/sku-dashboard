import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Camera, CheckCircle2, ImageIcon, Layers3, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSeason } from "@/contexts/SeasonContext";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { useStyleCategories } from "@/hooks/useStyleCategories";
import { displayColourLeather } from "@/lib/utils";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";
import { getStyleComparisonOverlap, summariseStyleForComparison, type StyleCompareSku } from "@shared/styleCompare";

type ActiveSku = StyleCompareSku & {
  style: string;
  colour: string;
  leather: string;
  colour2?: string | null;
  leather2?: string | null;
  is_new: boolean;
};

type BuyQuantity = {
  totalAu?: number;
  totalUsa?: number;
  totalNyc?: number;
  totalLa?: number;
  total?: number;
};

type StyleSelection = {
  style: string;
  last: string;
  category: string;
  imageUrl?: string;
  skus: ActiveSku[];
  rrp: number | null;
  fitRating: string | null;
  fittingNotes: string | null;
  sizeRecommendation: string | null;
  fobValues: number[];
  units: number;
};

function money(value: number | null | undefined, currency: "AUD" | "USD" = "AUD"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFobRange(values: number[]): string {
  if (!values.length) return "—";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return Math.abs(min - max) < 0.005 ? money(min, "USD") : `${money(min, "USD")} – ${money(max, "USD")}`;
}

function fitLabel(fitRating: string | null, sizeRecommendation: string | null): string {
  const fitLabels: Record<string, string> = {
    tts: "True to size",
    runs_small: "Runs small",
    runs_large: "Runs large",
  };
  const sizeLabels: Record<string, string> = {
    half_size_up: "Size up ½",
    full_size_up: "Size up 1",
    half_size_down: "Size down ½",
    full_size_down: "Size down 1",
  };
  if (!fitRating) return "Not set";
  return [fitLabels[fitRating] ?? fitRating, sizeRecommendation ? sizeLabels[sizeRecommendation] ?? sizeRecommendation : ""].filter(Boolean).join(" · ");
}

function StylePicker({
  label,
  value,
  onChange,
  options,
  listId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  listId: string;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          list={listId}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="Search a style…"
          className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm font-semibold uppercase outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        />
        <datalist id={listId}>
          {options.map((style) => <option key={style} value={style} />)}
        </datalist>
      </div>
    </label>
  );
}

function StyleImage({
  style,
  imageUrl,
  onUploaded,
}: {
  style: string;
  imageUrl?: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => setImageFailed(false), [imageUrl]);

  const upload = trpc.styleImage.upload.useMutation({
    onSuccess: () => {
      onUploaded();
      toast.success(`Image updated for ${style}`);
    },
    onError: (error) => toast.error(`Could not update image: ${error.message}`),
  });

  const handleFile = useCallback((file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      upload.mutate({
        style,
        imageBase64: String(reader.result).split(",")[1] ?? "",
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  }, [style, upload]);

  const hasImage = Boolean(imageUrl) && !imageFailed;

  return (
    <div
      className="group relative aspect-[4/3] overflow-hidden rounded-t-xl border-b border-border bg-gradient-to-br from-stone-100 to-stone-50"
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {hasImage ? (
        <img src={imageUrl} alt={style} className="h-full w-full object-contain p-3" onError={() => setImageFailed(true)} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
          {upload.isPending ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImageIcon className="h-9 w-9 opacity-45" />}
          <span className="text-xs font-medium">{upload.isPending ? "Uploading image…" : "No style image"}</span>
        </div>
      )}
      {(isDragging || !hasImage) && !upload.isPending && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-amber-50/90 text-amber-900">
          <Upload className="h-5 w-5" />
          <span className="text-xs font-semibold">Drop image to add</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="absolute right-3 top-3 flex h-8 items-center gap-1.5 rounded-md bg-white/95 px-2.5 text-[11px] font-semibold text-stone-800 shadow-sm transition-opacity hover:bg-white disabled:cursor-wait md:opacity-0 md:group-hover:opacity-100"
        title="Replace style image"
      >
        <Camera className="h-3.5 w-3.5" />
        {hasImage ? "Replace" : "Add image"}
      </button>
    </div>
  );
}

function CompareCard({
  selection,
  imageUrl,
  quantities,
  seasonCostMap,
  onImageUploaded,
}: {
  selection: StyleSelection | null;
  imageUrl?: string;
  quantities: Record<string, BuyQuantity>;
  seasonCostMap: Map<string, number>;
  onImageUploaded: () => void;
}) {
  if (!selection) {
    return (
      <section className="overflow-hidden rounded-xl border border-dashed border-border bg-card">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
          <Layers3 className="h-9 w-9 opacity-40" />
          <div>
            <p className="font-semibold text-foreground">Choose a style to compare</p>
            <p className="mt-1 text-sm">Use the style search above to load its image, product details and live SKU range.</p>
          </div>
        </div>
      </section>
    );
  }

  const summary = summariseStyleForComparison(selection.skus);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <StyleImage style={selection.style} imageUrl={imageUrl ?? selection.imageUrl} onUploaded={onImageUploaded} />
      <div className="space-y-5 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">{selection.style}</h2>
            {summary.newSkuCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                {summary.newSkuCount === summary.skuCount ? "All new" : `${summary.newSkuCount} new`}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{selection.last || "No last set"} <span className="mx-1">·</span> {selection.category || "No category set"}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SKUs</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{summary.skuCount}</p>
          </div>
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bought</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{selection.units.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RRP AUD</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{money(selection.rrp)}</p>
          </div>
        </div>

        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 gap-y-2 border-y border-border py-4 text-sm">
          <dt className="text-muted-foreground">FOB range (USD)</dt><dd className="text-right font-medium">{formatFobRange(selection.fobValues)}</dd>
          <dt className="text-muted-foreground">Fit</dt><dd className="text-right font-medium">{fitLabel(selection.fitRating, selection.sizeRecommendation)}</dd>
          <dt className="text-muted-foreground">Materials</dt><dd className="text-right font-medium">{summary.materialLabels.length ? summary.materialLabels.join(", ") : "—"}</dd>
        </dl>

        {selection.fittingNotes && (
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Fitting note</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{selection.fittingNotes}</p>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active SKU range</h3>
            <span className="text-xs text-muted-foreground">{summary.newSkuCount} new · {summary.existingSkuCount} carry-over</span>
          </div>
          <div className="max-h-[360px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-stone-100 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Colour / material</th>
                  <th className="px-2 py-2 text-right font-semibold">FOB</th>
                  <th className="px-3 py-2 text-right font-semibold">Bought</th>
                </tr>
              </thead>
              <tbody>
                {selection.skus.map((sku) => {
                  const identity = getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2);
                  const bought = quantities[identity]?.total ?? 0;
                  const fob = seasonCostMap.get(identity);
                  return (
                    <tr key={identity} className="border-t border-border/70 align-top hover:bg-amber-50/30">
                      <td className="px-3 py-2.5 font-medium">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{displayColourLeather(sku.colour, sku.leather, sku.style, sku.colour2, sku.leather2)}</span>
                          {sku.is_new && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">New</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{fob == null ? "—" : money(fob, "USD")}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{bought.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StyleCompareTab() {
  const { season } = useSeason();
  const { mergedRawSkus, mergedStyles, refetchImageOverrides } = useCustomSkus();
  const { cancelledSet: cancelledStyleSet } = useCancelledStyles(season);
  const { getCategory } = useStyleCategories();
  const { data: cancelledSkuRows = [] } = trpc.cancelledSku.list.useQuery({ season });
  const { data: allSessionQtys = {} } = trpc.buy.getAllSessionQtys.useQuery({ season });
  const { data: seasonCostRows = [] } = trpc.sku.getSeasonCosts.useQuery({ season });
  const { data: styleMetaRows = [] } = trpc.style.getAll.useQuery();
  const { data: styleFittingImages = [] } = trpc.styleFitting.getAll.useQuery();
  const { data: fittingSessions = [] } = trpc.fittingSession.getAll.useQuery({ season });

  const [leftStyle, setLeftStyle] = useState("MACK");
  const [rightStyle, setRightStyle] = useState("MADDI");

  const cancelledSkuSet = useMemo(() => new Set(
    (cancelledSkuRows as Array<{ style: string; colour: string; leather: string }>).map((row) => `${row.style}|${row.colour}|${row.leather}`),
  ), [cancelledSkuRows]);

  const activeSkus = useMemo(() => (mergedRawSkus as ActiveSku[]).filter((sku) => {
    if (cancelledStyleSet.has(sku.style)) return false;
    return !cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`);
  }), [cancelledSkuSet, cancelledStyleSet, mergedRawSkus]);

  const styleInfoMap = useMemo(() => new Map(
    (mergedStyles as Array<{ style: string; last: string; category: string; imageUrl?: string }>).map((row) => [row.style.toUpperCase(), row]),
  ), [mergedStyles]);

  const styleOptions = useMemo(() => Array.from(styleInfoMap.values())
    .filter((row) => !cancelledStyleSet.has(row.style))
    .map((row) => row.style.toUpperCase())
    .sort((a, b) => a.localeCompare(b)), [cancelledStyleSet, styleInfoMap]);

  const styleMetaMap = useMemo(() => new Map(
    (styleMetaRows as Array<{ style: string; rrp?: number | null; fitRating?: string | null; fittingNotes?: string | null; sizeRecommendation?: string | null }>).map((row) => [row.style.toUpperCase(), row]),
  ), [styleMetaRows]);

  const seasonCostMap = useMemo(() => new Map(
    (seasonCostRows as Array<{ style: string; colour: string; leather: string; colour2?: string | null; leather2?: string | null; cost: number }>).map((row) => [
      getSkuCompositeIdentity(row.style, row.colour, row.leather, row.colour2, row.leather2),
      Number(row.cost),
    ]),
  ), [seasonCostRows]);

  const fallbackImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const image of styleFittingImages as Array<{ style: string; imageUrl: string }>) {
      if (!map.has(image.style.toUpperCase())) map.set(image.style.toUpperCase(), image.imageUrl);
    }
    for (const session of fittingSessions as Array<{ style: string; images: Array<{ imageUrl: string }> }>) {
      const image = session.images[0]?.imageUrl;
      if (image && !map.has(session.style.toUpperCase())) map.set(session.style.toUpperCase(), image);
    }
    return map;
  }, [fittingSessions, styleFittingImages]);

  const buildSelection = useCallback((styleName: string): StyleSelection | null => {
    const normalized = styleName.trim().toUpperCase();
    const info = styleInfoMap.get(normalized);
    if (!info) return null;
    const skus = activeSkus
      .filter((sku) => sku.style.toUpperCase() === normalized)
      .sort((a, b) => displayColourLeather(a.colour, a.leather, a.style, a.colour2, a.leather2).localeCompare(displayColourLeather(b.colour, b.leather, b.style, b.colour2, b.leather2)));
    const meta = styleMetaMap.get(normalized);
    const fobValues = skus
      .map((sku) => seasonCostMap.get(getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2)))
      .filter((value): value is number => value != null && Number.isFinite(value));
    const units = skus.reduce((total, sku) => total + ((allSessionQtys as Record<string, BuyQuantity>)[getSkuCompositeIdentity(sku.style, sku.colour, sku.leather, sku.colour2, sku.leather2)]?.total ?? 0), 0);

    return {
      style: info.style,
      last: info.last,
      category: getCategory(info.style, info.category),
      imageUrl: info.imageUrl,
      skus,
      rrp: meta?.rrp ?? null,
      fitRating: meta?.fitRating ?? null,
      fittingNotes: meta?.fittingNotes ?? null,
      sizeRecommendation: meta?.sizeRecommendation ?? null,
      fobValues,
      units,
    };
  }, [activeSkus, allSessionQtys, getCategory, seasonCostMap, styleInfoMap, styleMetaMap]);

  const left = useMemo(() => buildSelection(leftStyle), [buildSelection, leftStyle]);
  const right = useMemo(() => buildSelection(rightStyle), [buildSelection, rightStyle]);
  const overlap = useMemo(() => getStyleComparisonOverlap(left?.skus ?? [], right?.skus ?? []), [left?.skus, right?.skus]);
  const sameLast = left?.last && right?.last && left.last === right.last;
  const sameCategory = left?.category && right?.category && left.category === right.category;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Side-by-side range review</p>
            <h1 className="mt-1 font-display text-xl font-bold tracking-tight">Compare styles</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Review real style imagery, active colourways, factory FOBs, RRP, fit notes and bought units together. The comparison follows the selected {season} range.</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <StylePicker label="Style A" value={leftStyle} onChange={setLeftStyle} options={styleOptions} listId="compare-style-a" />
            <button
              type="button"
              onClick={() => { setLeftStyle(rightStyle); setRightStyle(leftStyle); }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800"
              title="Swap styles"
              aria-label="Swap styles"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <StylePicker label="Style B" value={rightStyle} onChange={setRightStyle} options={styleOptions} listId="compare-style-b" />
          </div>
        </div>
      </section>

      {(left || right) && (
        <section className="rounded-xl border border-amber-100 bg-amber-50/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-700">
            <span className="font-semibold text-amber-900">Comparison cues</span>
            {sameLast && <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Same last: <strong>{left?.last}</strong></span>}
            {sameCategory && <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Same category: <strong>{left?.category}</strong></span>}
            {overlap.sharedMaterialLabels.length > 0 && <span>Shared materials: <strong>{overlap.sharedMaterialLabels.join(", ")}</strong></span>}
            {overlap.sharedColourLabels.length > 0 && <span>Shared colours: <strong>{overlap.sharedColourLabels.join(", ")}</strong></span>}
            {!sameLast && !sameCategory && overlap.sharedMaterialLabels.length === 0 && overlap.sharedColourLabels.length === 0 && <span className="text-muted-foreground">No shared last, category, colour or material currently detected.</span>}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <CompareCard selection={left} imageUrl={left?.imageUrl ?? (left ? fallbackImageMap.get(left.style.toUpperCase()) : undefined)} quantities={allSessionQtys as Record<string, BuyQuantity>} seasonCostMap={seasonCostMap} onImageUploaded={refetchImageOverrides} />
        <CompareCard selection={right} imageUrl={right?.imageUrl ?? (right ? fallbackImageMap.get(right.style.toUpperCase()) : undefined)} quantities={allSessionQtys as Record<string, BuyQuantity>} seasonCostMap={seasonCostMap} onImageUploaded={refetchImageOverrides} />
      </div>
    </div>
  );
}
