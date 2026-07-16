/**
 * StylesTab — filterable table of all styles
 * - Grouped by last name (alphabetical), then by style within each last
 * - Click a style row to expand its SKUs with inline buy qty editing
 * - Size 11 toggle is style-level: toggling one SKU toggles all in the style
 * - Click a SKU's detail icon to open the SkuDetailPanel slide-out
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { skuData } from "@/lib/skuData";
import { ALL_LASTS } from "@shared/const";
import { displayColour, displayLeather, displayColourLeather } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useCancelledStyles } from "@/hooks/useCancelledStyles";
import { useCustomSkus } from "@/hooks/useCustomSkus";
import { useStyleCategories } from "@/hooks/useStyleCategories";
import { useSeason } from "@/contexts/SeasonContext";
import { Search, ChevronUp, ChevronDown, ChevronRight, Download, Upload, SlidersHorizontal, CheckCircle, RotateCcw, Ban, RefreshCw, Plus, Lock, Unlock, FileSpreadsheet, X, Camera, ImageOff, Ruler } from "lucide-react";
import { LastMeasurementsPanel } from "./LastMeasurementsPanel";
import * as XLSX from "xlsx";
import SkuDetailPanel, { type SkuPanelData } from "./SkuDetailPanel";
import ImportPanel from "./ImportPanel";
import BuySessionBar from "./BuySessionBar";
import { toast } from "sonner";

type SortKey = "style" | "category" | "last" | "totalSKUs" | "newSKUs" | "existingSKUs";
type SortDir = "asc" | "desc";

// CATEGORIES is now built dynamically from actual data in the component
const STATUS_FILTERS = ["All", "Has New SKUs", "All New", "No New SKUs"];

// Category ordering within each last group
const CATEGORY_ORDER: Record<string, number> = {
  "DRESS SANDAL": 0,
  "SANDAL": 0,
  "DRESS SHOE": 1,
  "CASUAL FLAT": 2,
  "CASUAL WEDGE": 3,
  "DRESS WEDGE": 3,
  "WEDGE": 3,
  "DRESS ANKLE BOOT": 4,
  "ANKLE BOOT": 4,
  "CASUAL BOOT ANKLE": 4,
  "DRESS CALF BOOT": 5,
  "CALF BOOT": 5,
  "CASUAL BOOT CALF": 5,
  "DRESS BOOT LONG": 6,
  "LONG BOOT": 6,
  "CASUAL BOOT LONG": 6,
};
function categoryOrder(cat: string): number {
  return CATEGORY_ORDER[cat?.toUpperCase()?.trim()] ?? 99;
}

export default function StylesTab() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sampleFilter, setSampleFilter] = useState("All");
  const [fittingFilter, setFittingFilter] = useState("All");
  const [lastFilter, setLastFilter] = useState("All");
  const [leatherFilter, setLeatherFilter] = useState("All");
  const [size11Filter, setSize11Filter] = useState(false);
  const [trendFilters, setTrendFilters] = useState<string[]>([]); // empty = no filter
  const [measurementsLast, setMeasurementsLast] = useState<string | null>(null); // null = closed
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("style");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedSku, setSelectedSku] = useState<SkuPanelData | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showInvoiceImport, setShowInvoiceImport] = useState(false);
  const [expandedStyle, setExpandedStyle] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [fitApprovedSectionOpen, setFitApprovedSectionOpen] = useState(false);
  const [expandedApprovedStyle, setExpandedApprovedStyle] = useState<string | null>(null);
  // Add Style modal state
  const [showAddStyleModal, setShowAddStyleModal] = useState(false);
  const [newStyleName, setNewStyleName] = useState("");
  const [newStyleLast, setNewStyleLast] = useState("");
  const [newStyleCategory, setNewStyleCategory] = useState("");
  const [newStyleColour, setNewStyleColour] = useState("");
  const [newStyleLeather, setNewStyleLeather] = useState("");
  const [newStyleImageFile, setNewStyleImageFile] = useState<File | null>(null);
  const [newStyleImagePreview, setNewStyleImagePreview] = useState<string | null>(null);
  const [newStyleDragging, setNewStyleDragging] = useState(false);
  const [isAddingStyle, setIsAddingStyle] = useState(false);
  const addStyleImageInputRef = useRef<HTMLInputElement>(null);
  // Pending qty changes (local before saving)
  const pendingQty = useRef<Record<string, number>>({});

  const utils = trpc.useUtils();

  // Heel heights from DB (for Dress Shoe, Dress Sandal, Wedge categories)
  const { data: heelHeightData = [] } = trpc.heelHeight.getAll.useQuery(undefined, { staleTime: 300_000 });
  const heelHeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of heelHeightData as Array<{ lastName: string; heelHeightCm: number }>) {
      map.set(row.lastName.toUpperCase(), row.heelHeightCm);
    }
    return map;
  }, [heelHeightData]);
  const HEEL_HEIGHT_CATEGORIES = new Set(["DRESS SHOE", "DRESS SANDAL", "WEDGE", "DRESS WEDGE", "CASUAL WEDGE"]);

  // Cancelled styles
  const { cancelledSet, raw: cancelledList } = useCancelledStyles();
  const [cancelledSectionOpen, setCancelledSectionOpen] = useState(false);

  const cancelStyleMutation = trpc.styles.cancel.useMutation({
    onSuccess: () => { utils.styles.listCancelled.invalidate(); },
    onError: (err) => toast.error(`Failed to cancel style: ${err.message}`),
  });

  const restoreStyleMutation = trpc.styles.restore.useMutation({
    onSuccess: () => { utils.styles.listCancelled.invalidate(); },
    onError: (err) => toast.error(`Failed to restore style: ${err.message}`),
  });

  // Cancelled SKUs
  const { data: cancelledSkuList = [], refetch: refetchCancelledSkus } = trpc.cancelledSku.list.useQuery(undefined, { staleTime: 30_000 });
  const [cancelledSkuSectionOpen, setCancelledSkuSectionOpen] = useState(false);

  const cancelledSkuSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of cancelledSkuList as Array<{ style: string; colour: string; leather: string }>) {
      s.add(`${item.style}|${item.colour}|${item.leather}`);
    }
    return s;
  }, [cancelledSkuList]);

  // Markdown SKUs — fetched from DB and excluded from all style views
  // Fetch all markdown SKUs (pending + deleted) — both should be hidden from By Style
  const { data: markdownSkuList = [] } = trpc.markdown.list.useQuery({}, { staleTime: 60_000 });
  const markdownSkuSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of markdownSkuList as Array<{ styleCode: string; colour: string; status: string }>) {
      // Exclude restored SKUs (they've been put back into the active range)
      if (item.status !== "restored") {
        // item.colour is e.g. "BLACK SUEDE" (combined colour+leather from website Name~ tag)
        // Some website colours have a slash suffix for lining colour (e.g. "CLEAR VINYLITE/SKIN")
        // Strip everything after the slash so it matches the SKU data key (e.g. "CLEAR VINYLITE")
        const normalisedColour = item.colour.split("/")[0].trim();
        s.add(`${item.styleCode}|${normalisedColour}`);
      }
    }
    return s;
  }, [markdownSkuList]);

  // Helper: build the combined colour+leather key used by the markdown set
  // e.g. colour="BLACK" leather="SUEDE" → "BLACK SUEDE" to match the website's Name~ tag
  const markdownKey = (style: string, colour: string, leather: string) =>
    `${style}|${[colour, leather].filter(Boolean).join(" ").trim().toUpperCase()}`;

  const cancelSkuMutation = trpc.cancelledSku.cancel.useMutation({
    onSuccess: () => { refetchCancelledSkus(); },
    onError: (err) => toast.error(`Failed to cancel SKU: ${err.message}`),
  });

  const restoreSkuMutation = trpc.cancelledSku.restore.useMutation({
    onSuccess: () => { refetchCancelledSkus(); },
    onError: (err) => toast.error(`Failed to restore SKU: ${err.message}`),
  });

  // Fetch all SKU meta from DB
  const { data: skuMetaList = [], refetch: refetchSkuMeta } = trpc.sku.getAll.useQuery(undefined, { staleTime: 30_000 });
  const { data: styleMetaList = [], refetch: refetchStyleMeta } = trpc.style.getAll.useQuery(undefined, { staleTime: 30_000 });


  // Fitting images for approved styles
  const { data: allFitImages = [], refetch: refetchFitImages } = trpc.styleFitting.getAll.useQuery(undefined, { staleTime: 60_000 });

  const { season } = useSeason();

  // All fitting sessions — used for the Fitting Status filter
  const { data: allFittingSessions = [] } = trpc.fittingSession.getAll.useQuery({ season }, { staleTime: 30_000 });
  // Set of style names that have at least one fitting session
  const fittedStylesSet = useMemo(() => new Set(allFittingSessions.map((s) => s.style)), [allFittingSessions]);

  // Undo approval mutation
  const undoApprovalMutation = trpc.styleFitting.updateFit.useMutation({
    onSuccess: () => { refetchStyleMeta(); refetchFitImages(); },
    onError: (err) => toast.error(`Failed to undo approval: ${err.message}`),
  });

  // Custom SKUs (added during buy)
    const { mergedRawSkus, mergedStyles, customSkus, customStyleRows, refetch: refetchCustomSkus, refetchImageOverrides } = useCustomSkus();

  // Auto-cancel styles where every SKU has been individually cancelled
  const autoCancelledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!cancelledSkuList.length || !mergedStyles.length) return;
    for (const s of mergedStyles) {
      if (cancelledSet.has(s.style)) continue; // already style-cancelled
      if (autoCancelledRef.current.has(s.style)) continue; // already processed this session
      const styleSkus = (mergedRawSkus as Array<{ style: string; colour: string; leather: string }>)
        .filter((r) => r.style === s.style);
      if (styleSkus.length === 0) continue;
      const allCancelled = styleSkus.every((r) => cancelledSkuSet.has(`${r.style}|${r.colour}|${r.leather}`));
      if (allCancelled) {
        autoCancelledRef.current.add(s.style);
        cancelStyleMutation.mutate({ style: s.style });
      }
    }
  }, [cancelledSkuSet, mergedStyles, mergedRawSkus, cancelledSet, cancelledSkuList]);

  // Style image upload
  const [uploadingImage, setUploadingImage] = useState<string | null>(null); // style name being uploaded
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploadTarget, setImageUploadTarget] = useState<string | null>(null);
  const uploadImageMutation = trpc.styleImage.upload.useMutation({
    onSuccess: () => {
      refetchImageOverrides();
      setUploadingImage(null);
      toast.success(`Image updated for ${imageUploadTarget}`);
    },
    onError: (err) => {
      setUploadingImage(null);
      toast.error(`Failed to upload image: ${err.message}`);
    },
  });
  const revertImageMutation = trpc.styleImage.revert.useMutation({
    onSuccess: () => {
      refetchImageOverrides();
      toast.success(`Image reverted to original for ${imageUploadTarget}`);
    },
    onError: (err) => toast.error(`Failed to revert image: ${err.message}`),
  });

  function handleImageUploadClick(styleName: string, e: React.MouseEvent) {
    e.stopPropagation();
    setImageUploadTarget(styleName);
    imageInputRef.current?.click();
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !imageUploadTarget) return;
    e.target.value = "";
    uploadImageFile(imageUploadTarget, file);
  }

  function uploadImageFile(styleName: string, file: File) {
    setUploadingImage(styleName);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadImageMutation.mutate({ style: styleName, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  // Track which style thumbnail is being dragged over
  const [imageDragOver, setImageDragOver] = useState<string | null>(null);

  // Track which styles have DB image overrides (to show revert option)
  const { data: imageOverridesList = [] } = trpc.styleImage.getAll.useQuery(undefined, { staleTime: 120_000 });
  const imageOverridesSet = useMemo(() => {
    const s = new Set<string>();
    for (const o of imageOverridesList as Array<{ style: string }>) s.add(o.style.toUpperCase());
    return s;
  }, [imageOverridesList]);

  // Category overrides (sub-categories + trend flags from DB)
  const { getCategory, getTrendFlag, getTrends, allTrends } = useStyleCategories();

  // Add colour inline form state: key = style name, value = { colour, leather } draft
  const [addColourDraft, setAddColourDraft] = useState<Record<string, { colour: string; leather: string }>>({});

  const addCustomSkuMutation = trpc.customSku.add.useMutation({
    onSuccess: (_data, vars) => {
      refetchCustomSkus();
      // Also add to active buy session if one is selected and unlocked
      if (selectedSessionId && !isSessionLocked) {
        upsertItemMutation.mutate({ sessionId: selectedSessionId, style: vars.style, colour: vars.colour, leather: vars.leather, auQty: 0, usaQty: 0 });
      }
      setAddColourDraft((prev) => { const n = { ...prev }; delete n[vars.style]; return n; });
      toast.success(`${vars.colour} ${vars.leather} added to ${vars.style}`);
    },
    onError: (err) => toast.error(`Failed to add colour: ${err.message}`),
  });

  // Add Style mutation
  const addCustomStyleMutation = trpc.customStyle.add.useMutation({
    onSuccess: (_data, vars) => {
      utils.customStyle.getAll.invalidate();
      // If a colour was provided, add it as a custom SKU
      if (newStyleColour.trim()) {
        addCustomSkuMutation.mutate({ style: vars.style, colour: newStyleColour.trim().toUpperCase(), leather: newStyleLeather.trim().toUpperCase() });
      }
      setShowAddStyleModal(false);
      setNewStyleName("");
      setNewStyleLast("");
      setNewStyleCategory("");
      setNewStyleColour("");
      setNewStyleLeather("");
      setNewStyleImageFile(null);
      setNewStyleImagePreview(null);
      setIsAddingStyle(false);
      toast.success("Style added successfully");
    },
    onError: (err) => {
      setIsAddingStyle(false);
      toast.error(`Failed to add style: ${err.message}`);
    },
  });
  // Custom lasts from DB
  const { data: customLastsData = [] } = trpc.customLast.getAll.useQuery({ season }, { staleTime: 300_000 });
  // All unique lasts: ALL_LASTS (shared canonical list) + skuData lasts + custom DB lasts — deduplicated
  const allKnownLasts = useMemo(() => {
    const s = new Set<string>();
    // Always include the canonical list (same as LastApprovalTab)
    for (const l of ALL_LASTS) s.add(l);
    // Also include any lasts that appear in skuData but aren't in ALL_LASTS
    for (const style of skuData.styles) { if (style.last) s.add(style.last); }
    // And any custom lasts added via the Last Approval tab
    for (const l of (customLastsData as Array<{ lastName: string; isRunOn: boolean } | string>)) {
      s.add(typeof l === "string" ? l : l.lastName);
    }
    return Array.from(s).sort();
  }, [customLastsData]);
  // Add Style drag-and-drop handlers
  function handleAddStyleDrop(e: React.DragEvent) {
    e.preventDefault();
    setNewStyleDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      setNewStyleImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setNewStyleImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }
  function handleAddStyleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setNewStyleImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setNewStyleImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }
  async function handleAddStyleSubmit() {
    const name = newStyleName.trim().toUpperCase();
    const lastName = newStyleLast.trim().toUpperCase();
    if (!name || !lastName) {
      toast.error("Style name and last are required");
      return;
    }
    // Check if style already exists (in static data or custom styles)
    const existingCustom = customStyleRows.find((cs) => cs.style.toUpperCase() === name);
    const existingStatic = stylesWithCategories.find((s) => s.style.toUpperCase() === name);
    if (existingCustom || existingStatic) {
      toast.error(`${name} already exists — use the Specs tab to update its category or last`);
      return;
    }
    setIsAddingStyle(true);
    // If an image was selected, upload it first then add the style
    if (newStyleImageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        // Add the style first, then upload the image
        addCustomStyleMutation.mutate(
          { style: name, lastName, category: newStyleCategory.trim().toUpperCase() || undefined },
          {
            onSuccess: () => {
              // Upload the image after style is created
              uploadImageMutation.mutate({ style: name, imageBase64: base64, mimeType: newStyleImageFile.type });
            },
          }
        );
      };
      reader.readAsDataURL(newStyleImageFile);
    } else {
      addCustomStyleMutation.mutate({ style: name, lastName, category: newStyleCategory.trim().toUpperCase() || undefined });
    }
  }
  const unlockSessionMutation = trpc.buy.unlock.useMutation({
    onSuccess: () => { refetchSessions(); refetchActive(); toast.success("Session unlocked"); },
    onError: (err) => toast.error(`Failed to unlock: ${err.message}`),
  });

  // All-session combined buy quantities (persistent, always visible)
  const { data: allSessionQtys = {} } = trpc.buy.getAllSessionQtys.useQuery({ season }, { staleTime: 10_000 });

  // Buy sessions
  const { data: allSessions = [], refetch: refetchSessions } = trpc.buy.getSessions.useQuery({ season }, { staleTime: 30_000 });
  const { data: activeSession, refetch: refetchActive } = trpc.buy.getActive.useQuery({ season }, { staleTime: 30_000 });
  const { data: sessionItems = [], refetch: refetchItems } = trpc.buy.getItems.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    { enabled: selectedSessionId !== null }
  );

  // When no session is selected, fall back to the most recent session's items for read-only display
  const mostRecentSessionId = (allSessions as Array<{ id: number; createdAt: Date }>).length > 0
    ? [...(allSessions as Array<{ id: number; createdAt: Date }>)].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id
    : null;
  const { data: fallbackItems = [] } = trpc.buy.getItems.useQuery(
    { sessionId: mostRecentSessionId ?? 0 },
    { enabled: selectedSessionId === null && mostRecentSessionId !== null }
  );

  // The items to use for display: selected session items if a session is chosen, otherwise fallback
  const displayItems = selectedSessionId !== null ? sessionItems : fallbackItems;

  // No auto-select: default is no session selected.
  // User can click into a session via the session selector in the Buy Session bar.

  const upsertItemMutation = trpc.buy.upsertItem.useMutation({
    onSuccess: () => { utils.buy.getAllSessionQtys.invalidate(); },
    onError: (err) => toast.error(`Failed to save qty: ${err.message}`),
  });

  // SKU-level sample status toggle mutation
  const updateSampleStatusMutation = trpc.sku.update.useMutation({
    onSuccess: () => refetchSkuMeta(),
    onError: (err) => toast.error(`Failed to update sample status: ${err.message}`),
  });

  function handleSampleToggle(style: string, colour: string, leather: string, currentStatus: string | null | undefined) {
    // Simple two-state toggle: waiting ↔ received
    // fitting_sample is set only via the Fittings tab, not here
    const newStatus: "waiting" | "received" =
      (currentStatus === "received") ? "waiting" : "received";
    updateSampleStatusMutation.mutate({ style, colour, leather: leather ?? "", sampleStatus: newStatus });
  }

  // Style-level Size 11 mutation — updates ALL SKUs in the style
  const updateStyleSize11Mutation = trpc.sku.updateStyleSize11.useMutation({
    onSuccess: () => refetchSkuMeta(),
    onError: (err) => toast.error(`Failed to update Size 11: ${err.message}`),
  });

  // Fetch size 11 availability from tonybianco.com.au
  const [isFetchingSize11, setIsFetchingSize11] = useState(false);
  const fetchSize11Mutation = trpc.sku.fetchSize11FromTonyBianco.useMutation({
    onSuccess: (result) => {
      refetchSkuMeta();
      const with11 = result.results.filter((r: { style: string; isSize11: boolean }) => r.isSize11).length;
      const without11 = result.results.filter((r: { style: string; isSize11: boolean }) => !r.isSize11).length;
      toast.success(
        `Size 11 updated: ${with11} styles YES, ${without11} styles NO. ` +
        `${result.notFoundStyles.length} new styles not yet on website.`
      );
      setIsFetchingSize11(false);
    },
    onError: (err) => {
      toast.error(`Failed to fetch size 11 data: ${err.message}`);
      setIsFetchingSize11(false);
    },
  });

  function handleFetchSize11() {
    if (isFetchingSize11) return;
    setIsFetchingSize11(true);
    // Build skusByStyle from all merged SKUs
    const skusByStyle: Record<string, Array<{ colour: string; leather: string }>> = {};
    for (const sku of mergedRawSkus) {
      if (!skusByStyle[sku.style]) skusByStyle[sku.style] = [];
      skusByStyle[sku.style].push({ colour: sku.colour, leather: sku.leather ?? "" });
    }
    fetchSize11Mutation.mutate({ skusByStyle });
  }

  // Build lookup maps
  type SkuMetaItem = { style: string; colour: string; leather: string; sampleStatus?: string | null; orderQty?: number | null; isSize11?: boolean | null; costPrice?: number | null; fitRating?: string | null; fittingNotes?: string | null; };
  type StyleMetaItem = { style: string; rrp?: number | null; fitRating?: string | null; fittingNotes?: string | null; fitApproved?: boolean | null; websiteImageUrl?: string | null; };

  const skuMetaMap = useMemo(() => {
    const map: Record<string, SkuMetaItem> = {};
    for (const m of skuMetaList as SkuMetaItem[]) {
      map[`${m.style}|${m.colour}|${m.leather}`] = m;
    }
    return map;
  }, [skuMetaList]);

  const styleMetaMap = useMemo(() => {
    const map: Record<string, StyleMetaItem> = {};
    for (const m of styleMetaList as StyleMetaItem[]) {
      map[m.style] = m;
    }
    return map;
  }, [styleMetaList]);

  // Buy session item lookup — uses selected session items, or falls back to most recent session for read-only display
  const sessionItemMap = useMemo(() => {
    const map: Record<string, { auQty: number; usaQty: number; nycQty: number; laQty: number }> = {};
    for (const item of displayItems) {
      const key = `${item.style}|${item.colour}|${item.leather}` as string;
      // Use legacy qty as fallback for auQty so old sessions display correctly
      const legacyQty = (item as any).qty ?? 0;
      map[key] = { auQty: (item as any).auQty || legacyQty, usaQty: (item as any).usaQty ?? 0, nycQty: (item as any).nycQty ?? 0, laQty: (item as any).laQty ?? 0 };
    }
    return map;
  }, [displayItems]);

  const selectedSession = useMemo(() => allSessions.find((s) => s.id === selectedSessionId), [allSessions, selectedSessionId]);
  const isSessionLocked = selectedSession?.isLocked ?? true;

  // Fit images grouped by style
  const fitImagesMap = useMemo(() => {
    const map: Record<string, Array<{ id: number; imageUrl: string; fileKey: string }>> = {};
    for (const img of allFitImages as Array<{ id: number; style: string; imageUrl: string; fileKey: string }>) {
      if (!map[img.style]) map[img.style] = [];
      map[img.style].push({ id: img.id, imageUrl: img.imageUrl, fileKey: img.fileKey });
    }
    return map;
  }, [allFitImages]);

  // Approved styles list (from skuData, filtered by fitApproved in styleMeta, excluding cancelled)
  const approvedFitStyles = useMemo(() => {
    return skuData.styles.filter((s) => !cancelledSet.has(s.style) && styleMetaMap[s.style]?.fitApproved === true);
  }, [styleMetaMap, cancelledSet]);

  function handleMetaChange() {
    refetchSkuMeta();
  }

  function handleSessionChange() {
    refetchSessions();
    refetchActive();
  }

  function handleQtyChange(style: string, colour: string, leather: string, field: 'au' | 'usa' | 'nyc' | 'la', val: string) {
    const key = `${style}|${colour}|${leather}|${field}`;
    if (val === '' || val === null) {
      // Empty field — store 0 so blur handler saves it as 0
      pendingQty.current[key] = 0;
    } else {
      const qty = parseInt(val, 10);
      if (!isNaN(qty) && qty >= 0) {
        pendingQty.current[key] = qty;
      }
    }
  }

  function handleQtyBlur(style: string, colour: string, leather: string, field: 'au' | 'usa' | 'nyc' | 'la') {
    if (!selectedSessionId || isSessionLocked) return;
    const baseKey = `${style}|${colour}|${leather}`;
    const fieldKey = `${baseKey}|${field}`;
    const newVal = pendingQty.current[fieldKey];
    if (newVal === undefined) return;
    const current = sessionItemMap[baseKey] ?? { auQty: 0, usaQty: 0, nycQty: 0, laQty: 0 };
    const auQty = field === 'au' ? newVal : current.auQty;
    const usaQty = field === 'usa' ? newVal : current.usaQty;
    const nycQty = field === 'nyc' ? newVal : current.nycQty;
    const laQty = field === 'la' ? newVal : current.laQty;
    upsertItemMutation.mutate(
      { sessionId: selectedSessionId, style, colour, leather, auQty, usaQty, nycQty, laQty },
      { onSuccess: () => { refetchItems(); delete pendingQty.current[fieldKey]; } }
    );
  }

  // Toggle Size 11 for the entire style
  function handleStyleSize11Toggle(styleName: string) {
    const skus = getSkusForStyle(styleName);
    // Check if ANY sku in the style currently has size11 = true
    const anySize11 = skus.some((sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      return skuMetaMap[key]?.isSize11 === true;
    });
    // Toggle: if any are on, turn all off; if none are on, turn all on
    const newValue = !anySize11;
    updateStyleSize11Mutation.mutate({
      style: styleName,
      skus: skus.map((s) => ({ colour: s.colour, leather: s.leather })),
      isSize11: newValue,
    });
  }

  function exportToExcel() {
    const styleMetaLookup: Record<string, { category: string; last: string }> = {};
    skuData.styles.forEach((s) => {
      styleMetaLookup[s.style] = { category: s.category, last: s.last };
    });
    const rows = skuData.rawSkus
      .filter((sku) => {
        if (cancelledSet.has(sku.style)) return false;
        if (cancelledSkuSet.has(`${sku.style}|${sku.colour}|${sku.leather}`)) return false;
        const meta = styleMetaLookup[sku.style];
        return categoryFilter === "All" || meta?.category === categoryFilter;
      })
      .map((sku) => {
        const skuKey = `${sku.style}|${sku.colour}|${sku.leather}` as string;
        const dbMeta = skuMetaMap[skuKey];
        return {
          Category: styleMetaLookup[sku.style]?.category ?? "",
          Style: sku.style,
          Last: styleMetaLookup[sku.style]?.last ?? "",
          Colour: sku.colour,
          Leather: sku.leather,
          Status: sku.is_new ? "New" : "Existing",
          "Size 11": dbMeta?.isSize11 ? "Yes" : "No",
          "Sample Status": dbMeta?.sampleStatus ?? "waiting",
          "Order Qty": dbMeta?.orderQty ?? 0,
          "Cost Price": dbMeta?.costPrice != null ? dbMeta.costPrice : "",
          RRP: styleMetaMap[sku.style]?.rrp != null ? styleMetaMap[sku.style].rrp : "",
          "Fit Rating": dbMeta?.fitRating ?? "",
          "Fitting Notes": dbMeta?.fittingNotes ?? "",
        };
      });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SKU Data");
    XLSX.writeFile(wb, "SS26_SKU_Export.xlsx");
  }

  // Apply runtime category overrides (sub-categories + trend flags)
  const stylesWithCategories = useMemo(() => {
    return mergedStyles
      .filter((s) => !cancelledSet.has(s.style))
      .map((s) => {
        // Recompute leathers and colours excluding cancelled SKUs and markdown SKUs
        const allStyleSkus = (mergedRawSkus as Array<{ style: string; colour: string; leather: string; is_new: boolean }>)
          .filter((r) => r.style === s.style);
        const activeSkus = allStyleSkus
          .filter((r) => !cancelledSkuSet.has(`${r.style}|${r.colour}|${r.leather}`)
            && !markdownSkuSet.has(markdownKey(r.style, r.colour, r.leather)));
        // Track if all SKUs for this style are individually cancelled (so we still show the style row)
        const _allSkusCancelled = allStyleSkus.length > 0 && allStyleSkus.every((r) => cancelledSkuSet.has(`${r.style}|${r.colour}|${r.leather}`));
        const activeLeathers = Array.from(new Set(activeSkus.map((r) => r.leather).filter(Boolean))) as string[];
        const activeColours = Array.from(new Set(activeSkus.map((r) => r.colour).filter(Boolean))) as string[];
        const activeTotal = activeSkus.length;
        const activeNew = activeSkus.filter((r) => r.is_new).length;
        return {
          ...s,
          _allSkusCancelled,
          leathers: activeLeathers.length > 0 ? activeLeathers : (s.leathers as string[]),
          colours: activeColours.length > 0 ? activeColours : (s.colours as string[]),
          totalSKUs: activeTotal,
          newSKUs: activeNew,
          existingSKUs: activeTotal - activeNew,
          hasNew: activeNew > 0,
          isAllNew: activeNew === activeTotal && activeTotal > 0,
          category: getCategory(s.style, s.category),
          trendFlag: getTrendFlag(s.style),
          trends: getTrends(s.style),
        };
      });
  }, [mergedStyles, mergedRawSkus, cancelledSet, cancelledSkuSet, markdownSkuSet, getCategory, getTrendFlag, getTrends]);

  // Build category list dynamically from resolved categories (case-insensitive, sorted)
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of stylesWithCategories) {
      if (s.category) cats.add(s.category.toUpperCase());
    }
    return ["All", ...Array.from(cats).sort()];
  }, [stylesWithCategories]);

  // Count of styles per trend (across all styles, not just filtered)
  const trendCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stylesWithCategories) {
      const trends: string[] = (s as any).trends ?? [];
      for (const t of trends) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [stylesWithCategories]);

  // Available leathers for filter dropdown
  const availableLeathers = useMemo(() => {
    const s = new Set<string>();
    for (const style of stylesWithCategories) {
      for (const l of style.leathers) s.add(l);
    }
    return ["All", ...Array.from(s).sort()];
  }, [stylesWithCategories]);

  // Filter styles (uses stylesWithCategories which includes custom SKUs and category overrides)
  const filtered = useMemo(() => {
    // Hide styles where ALL SKUs are markdown (totalSKUs === 0 after markdown filtering)
    // BUT always show custom styles (even if they have no SKUs yet)
    // Styles where all SKUs are individually cancelled are auto-promoted to style-level cancellation
    // via the useEffect above, so they will move to the Cancelled section automatically
    let data = stylesWithCategories.filter((s) => s.totalSKUs > 0 || (s as any)._isCustomStyle);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (s) =>
          s.style.toLowerCase().includes(q) ||
          s.last.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.leathers.some((l) => l.toLowerCase().includes(q)) ||
          s.colours.some((c) => c.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== "All") {
      data = data.filter((s) => s.category.toUpperCase() === categoryFilter.toUpperCase());
    }

    if (statusFilter === "Has New SKUs") {
      data = data.filter((s) => s.hasNew);
    } else if (statusFilter === "All New") {
      data = data.filter((s) => s.isAllNew);
    } else if (statusFilter === "No New SKUs") {
      data = data.filter((s) => !s.hasNew);
    }

    if (lastFilter !== "All") {
      data = data.filter((s) => s.last === lastFilter);
    }

    if (leatherFilter !== "All") {
      data = data.filter((s) => s.leathers.includes(leatherFilter));
    }

    if (size11Filter) {
      data = data.filter((s) => getStyleSize11(s.style));
    }

    if (sampleFilter === "No sample received") {
      data = data.filter((s) => s.hasNew && getStyleSampleStatus(s.style) === 'none');
    } else if (sampleFilter === "Some received") {
      data = data.filter((s) => getStyleSampleStatus(s.style) === 'some');
    } else if (sampleFilter === "All received") {
      data = data.filter((s) => s.hasNew && getStyleSampleStatus(s.style) === 'all');
    }

    if (fittingFilter === "Not fitted yet") {
      data = data.filter((s) => !fittedStylesSet.has(s.style));
    } else if (fittingFilter === "Fitted (has sessions)") {
      data = data.filter((s) => fittedStylesSet.has(s.style) && !styleMetaMap[s.style]?.fitApproved);
    } else if (fittingFilter === "Fit approved") {
      data = data.filter((s) => styleMetaMap[s.style]?.fitApproved === true);
    }

    if (trendFilters.length > 0) {
      data = data.filter((s) => {
        const styleTrends: string[] = (s as any).trends ?? [];
        return trendFilters.some((t) => styleTrends.includes(t));
      });
    }

    return data;
  }, [search, categoryFilter, statusFilter, sampleFilter, fittingFilter, lastFilter, leatherFilter, size11Filter, trendFilters, stylesWithCategories, skuMetaMap, styleMetaMap, fittedStylesSet]);

  // Group by last, sorted alphabetically by last, then by category order within each last, then alphabetically within category
  const groupedByLast = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const s of filtered) {
      const last = s.last || "UNKNOWN";
      if (!groups[last]) groups[last] = [];
      groups[last].push(s);
    }
    // Sort styles within each group: category order first, then alphabetical within category
    for (const last of Object.keys(groups)) {
      groups[last].sort((a, b) => {
        const diff = categoryOrder(a.category) - categoryOrder(b.category);
        return diff !== 0 ? diff : a.style.localeCompare(b.style);
      });
    }
    // Sort last names alphabetically
    const sortedLasts = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return sortedLasts.map((last) => ({ last, styles: groups[last] }));
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 opacity-70" /> : <ChevronDown className="w-3 h-3 opacity-70" />;
  }

  function getSkusForStyle(styleName: string) {
    // mergedRawSkus already has overrides applied via useCustomSkus
    return mergedRawSkus
      .filter((s) => s.style === styleName
        && !cancelledSkuSet.has(`${s.style}|${s.colour}|${s.leather}`)
        && !markdownSkuSet.has(markdownKey(s.style, s.colour, (s as any).leather ?? "")));
  }

  // All-sessions buy total for a style (AU + USA + NYC combined, across every session)
  const allQtysTyped = allSessionQtys as Record<string, { totalAu: number; totalUsa: number; totalNyc: number; total: number; sessions: Array<{ sessionId: number; sessionName: string; au: number; usa: number; nyc: number }> }>;
  function getStyleAllSessionsTotal(styleName: string): { au: number; usa: number; nyc: number; total: number } {
    let au = 0; let usa = 0; let nyc = 0;
    for (const sku of getSkusForStyle(styleName)) {
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      const d = allQtysTyped[key];
      if (d) { au += d.totalAu; usa += d.totalUsa; nyc += d.totalNyc ?? 0; }
    }
    return { au, usa, nyc, total: au + usa + nyc };
  }
  // Legacy: session buy total for a style (current selected session only)
  function getStyleSessionTotal(styleName: string) {
    return getSkusForStyle(styleName).reduce((sum, sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}` as string;
      const item = sessionItemMap[key];
      return sum + (item ? item.auQty + item.usaQty + (item.nycQty ?? 0) + (item.laQty ?? 0) : 0);
    }, 0);
  }
  // Grand totals across all sessions
  const grandTotals = useMemo(() => {
    let au = 0; let usa = 0; let nyc = 0;
    for (const d of Object.values(allQtysTyped)) { au += d.totalAu; usa += d.totalUsa; nyc += d.totalNyc ?? 0; }
    return { au, usa, nyc, total: au + usa + nyc };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSessionQtys]);

  // Check if style has Size 11 enabled (any SKU in the style)
  function getStyleSize11(styleName: string) {
    return getSkusForStyle(styleName).some((sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      return skuMetaMap[key]?.isSize11 === true;
    });
  }

  // Check sample status for all NEW SKUs in a style
  // Returns: 'all' | 'some' | 'none'
  function getStyleSampleStatus(styleName: string): 'all' | 'some' | 'none' {
    const newSkus = getSkusForStyle(styleName).filter((s) => s.is_new);
    if (newSkus.length === 0) return 'none';
    const receivedCount = newSkus.filter((sku) => {
      const key = `${sku.style}|${sku.colour}|${sku.leather}`;
      const s = skuMetaMap[key]?.sampleStatus;
      return s === 'received' || s === 'fitting_sample';
    }).length;
    if (receivedCount === 0) return 'none';
    if (receivedCount === newSkus.length) return 'all';
    return 'some';
  }

  // Toggle sample received for ALL new SKUs in a style at once
  const updateStyleSampleMutation = trpc.sku.update.useMutation({
    onSuccess: () => refetchSkuMeta(),
    onError: (err) => toast.error(`Failed to update sample status: ${err.message}`),
  });

  function handleStyleSampleToggle(styleName: string) {
    const newSkus = getSkusForStyle(styleName).filter((s) => s.is_new);
    if (newSkus.length === 0) return;
    const currentStatus = getStyleSampleStatus(styleName);
    const newStatus = currentStatus === 'all' ? 'waiting' : 'received';
    // Fire mutations sequentially using Promise chain to avoid race conditions
    newSkus.reduce<Promise<void>>((p, sku) =>
      p.then(() => { updateStyleSampleMutation.mutateAsync({ style: sku.style, colour: sku.colour, leather: sku.leather ?? '', sampleStatus: newStatus }); }),
      Promise.resolve()
    );
  }

  const totalFilteredStyles = filtered.length;

  return (
    <div className="space-y-4">
      {/* Last Measurements Panel */}
      {measurementsLast !== null && (
        <LastMeasurementsPanel
          filterLast={measurementsLast}
          onClose={() => setMeasurementsLast(null)}
        />
      )}

      {/* Buy Session Bar */}
      <BuySessionBar
        activeSession={activeSession ?? null}
        allSessions={allSessions as any}
        selectedSessionId={selectedSessionId}
        onSelectSession={setSelectedSessionId}
        onDeselect={() => setSelectedSessionId(null)}
        onSessionChange={handleSessionChange}
      />

      {/* Grand Total Buy Summary */}
      {grandTotals.total > 0 && (
        <div
          className="flex items-center gap-4 px-4 py-2.5 rounded-xl border"
          style={{ background: "oklch(0.97 0.05 65 / 0.6)", borderColor: "oklch(0.85 0.08 65)" }}
        >
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "oklch(0.50 0.14 55)" }}>Total Bought</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold tabular-nums" style={{ color: "oklch(0.35 0.12 55)" }}>
              AU <span className="text-base font-bold">{grandTotals.au.toLocaleString()}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold tabular-nums" style={{ color: "oklch(0.35 0.12 55)" }}>
              USA <span className="text-base font-bold">{grandTotals.usa.toLocaleString()}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-bold tabular-nums text-base" style={{ color: "oklch(0.45 0.16 55)" }}>
              {grandTotals.total.toLocaleString()} units total
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search styles, leathers, colours…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border bg-card text-foreground focus:outline-none"
            style={{ borderColor: "var(--border)" }}
          >
            {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border bg-card text-foreground focus:outline-none"
            style={{ borderColor: "var(--border)" }}
          >
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <button
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
              showMoreFilters || sampleFilter !== "All" || fittingFilter !== "All" || lastFilter !== "All" || leatherFilter !== "All" || size11Filter || trendFilters.length > 0
                ? "bg-amber-50 border-amber-400 text-amber-700"
                : "bg-card hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
            }`}
            style={{ borderColor: showMoreFilters || sampleFilter !== "All" || fittingFilter !== "All" || lastFilter !== "All" || leatherFilter !== "All" || size11Filter || trendFilters.length > 0 ? undefined : "var(--border)" }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {(sampleFilter !== "All" || fittingFilter !== "All" || lastFilter !== "All" || leatherFilter !== "All" || size11Filter || trendFilters.length > 0) && (
              <span className="ml-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {[sampleFilter !== "All", fittingFilter !== "All", lastFilter !== "All", leatherFilter !== "All", size11Filter, trendFilters.length > 0].filter(Boolean).length}
              </span>
            )}
          </button>

          {(sampleFilter !== "All" || fittingFilter !== "All" || lastFilter !== "All" || leatherFilter !== "All" || size11Filter || trendFilters.length > 0) && (
            <button
              onClick={() => { setSampleFilter("All"); setFittingFilter("All"); setLastFilter("All"); setLeatherFilter("All"); setSize11Filter(false); setTrendFilters([]); }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}

          <span className="text-sm text-muted-foreground">{totalFilteredStyles} of {skuData.styles.length} styles</span>
        </div>

        {/* Expanded filter panel */}
        {showMoreFilters && (
          <div className="flex flex-wrap gap-4 items-end p-3 rounded-lg border bg-card/50" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sample Status</label>
              <select
                value={sampleFilter}
                onChange={(e) => setSampleFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border bg-card text-foreground focus:outline-none min-w-44"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="All">All</option>
                <option value="No sample received">No sample received</option>
                <option value="Some received">Some received</option>
                <option value="All received">All received</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fitting Status</label>
              <select
                value={fittingFilter}
                onChange={(e) => setFittingFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border bg-card text-foreground focus:outline-none min-w-44"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="All">All</option>
                <option value="Not fitted yet">Not fitted yet</option>
                <option value="Fitted (has sessions)">Fitted (has sessions)</option>
                <option value="Fit approved">Fit approved</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last</label>
              <select
                value={lastFilter}
                onChange={(e) => setLastFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border bg-card text-foreground focus:outline-none min-w-36"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="All">All lasts</option>
                {allKnownLasts.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leather</label>
              <select
                value={leatherFilter}
                onChange={(e) => setLeatherFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border bg-card text-foreground focus:outline-none min-w-36"
                style={{ borderColor: "var(--border)" }}
              >
                {availableLeathers.map((l) => <option key={l} value={l}>{l === "All" ? "All leathers" : l}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Size 11</label>
              <button
                onClick={() => setSize11Filter((v) => !v)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  size11Filter ? "bg-purple-100 border-purple-400 text-purple-700" : "bg-card text-foreground hover:bg-purple-50"
                }`}
                style={{ borderColor: size11Filter ? undefined : "var(--border)" }}
              >
                {size11Filter ? "SZ11 only ✓" : "SZ11 only"}
              </button>
            </div>

            {allTrends.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trend</label>
                <div className="flex flex-wrap gap-1.5">
                  {allTrends.map((trend) => {
                    const isActive = trendFilters.includes(trend);
                    const count = trendCounts[trend] ?? 0;
                    return (
                      <button
                        key={trend}
                        onClick={() => setTrendFilters((prev) =>
                          prev.includes(trend) ? prev.filter((t) => t !== trend) : [...prev, trend]
                        )}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          isActive
                            ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                            : "bg-card text-foreground hover:bg-amber-50"
                        }`}
                        style={{ borderColor: isActive ? undefined : "var(--border)" }}
                      >
                        {trend}
                        <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                          isActive ? "bg-amber-200 text-amber-800" : "bg-muted text-muted-foreground"
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Upload className="w-4 h-4" />
          Import
        </button>

        <button
          onClick={() => setShowInvoiceImport(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-green-50 hover:border-green-400 hover:text-green-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Import Invoice
        </button>

        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>

        <button
          onClick={() => setShowAddStyleModal(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Plus className="w-4 h-4" />
          Add Style
        </button>

        <button
          onClick={handleFetchSize11}
          disabled={isFetchingSize11}
          title="Reads tonybianco.com.au to auto-fill which styles come in size 11"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors hover:bg-green-50 hover:border-green-400 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {isFetchingSize11 ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Fetching…</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> Sync Size 11</>
          )}
        </button>
      </div>

      {/* Table grouped by last */}
      <div className="space-y-4">
        {groupedByLast.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-12 text-center text-muted-foreground text-sm" style={{ borderColor: "var(--border)" }}>
            No styles match your filters.
          </div>
        ) : (
          groupedByLast.map(({ last, styles: lastStyles }) => (
            <div key={last} className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {/* Last group header */}
              <div
                className="px-4 py-2 flex items-center gap-3 border-b"
                style={{
                  borderColor: "var(--border)",
                  background: "oklch(0.96 0.03 65 / 0.5)",
                }}
              >
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "oklch(0.50 0.14 55)" }}>
                  {last}
                </span>
                <button
                  onClick={() => setMeasurementsLast(last)}
                  title={`View ${last} measurements`}
                  className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded hover:bg-amber-100 transition-colors"
                  style={{ color: "oklch(0.55 0.12 65)" }}
                >
                  <Ruler className="w-3 h-3" />
                  <span className="hidden sm:inline">Measurements</span>
                </button>
                {(() => {
                  const hh = heelHeightMap.get(last.toUpperCase());
                  const hasDressCategory = lastStyles.some(s => HEEL_HEIGHT_CATEGORIES.has(s.category));
                  if (hh != null && hasDressCategory) {
                    return (
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "oklch(0.94 0.06 30)", color: "oklch(0.45 0.14 30)" }}>
                        {hh}cm
                      </span>
                    );
                  }
                  return null;
                })()}
                <span className="text-xs text-muted-foreground">
                  {lastStyles.length} {lastStyles.length === 1 ? "style" : "styles"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                      {[
                        { key: "style" as SortKey, label: "Style" },
                        { key: "category" as SortKey, label: "Category" },
                        { key: "totalSKUs" as SortKey, label: "Total SKUs" },
                        { key: "newSKUs" as SortKey, label: "New" },
                        { key: "existingSKUs" as SortKey, label: "Existing" },
                      ].map(({ key, label }) => (
                        <th
                          key={key}
                          className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors"
                          onClick={() => toggleSort(key)}
                        >
                          <div className={`flex items-center gap-1 ${key !== "style" && key !== "category" ? "justify-end" : ""}`}>
                            {label}
                            <SortIcon col={key} />
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-left">Leathers</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-center">Sz11</th>
                      <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide text-right">Buy Qty</th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lastStyles.map((style) => {
                      const allSessionsTotal = getStyleAllSessionsTotal(style.style);
                      const sessionTotal = getStyleSessionTotal(style.style);
                      const styleSize11 = getStyleSize11(style.style);
                      const styleSampleStatus = getStyleSampleStatus(style.style);
                      const hasNewSkus = getSkusForStyle(style.style).some((s) => s.is_new);
                      return (
                        <React.Fragment key={style.style}>
                          <tr
                            className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                            style={{
                              borderColor: "var(--border)",
                              background: expandedStyle === style.style
                                ? "oklch(0.97 0.04 65 / 0.6)"
                                : style.isAllNew ? "oklch(0.99 0.04 65 / 0.4)" : undefined,
                            }}
                            onClick={() => setExpandedStyle(expandedStyle === style.style ? null : style.style)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`relative w-16 h-10 rounded flex-shrink-0 overflow-hidden group/img cursor-pointer transition-all ${
                                    imageDragOver === style.style ? "ring-2 ring-purple-400 ring-offset-1 scale-105" : ""
                                  }`}
                                  style={{ background: "var(--muted)" }}
                                  onClick={(e) => handleImageUploadClick(style.style, e)}
                                  title="Click or drag & drop to replace image (right-click to revert)"
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setImageUploadTarget(style.style);
                                    revertImageMutation.mutate({ style: style.style });
                                  }}
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setImageDragOver(style.style); }}
                                  onDragLeave={(e) => { e.stopPropagation(); setImageDragOver(null); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setImageDragOver(null);
                                    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
                                    if (file) uploadImageFile(style.style, file);
                                  }}
                                >
                                  {style.imageUrl ? (
                                    <img src={style.imageUrl} alt={style.style} className="w-full h-full object-contain" loading="lazy" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ImageOff className="w-4 h-4 text-muted-foreground/40" />
                                    </div>
                                  )}
                                  {/* Upload overlay — visible on hover */}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                    {uploadingImage === style.style ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Camera className="w-4 h-4 text-white" />
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {style.hasNew && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#f59e0b" }} />}
                                  <span className="font-semibold text-foreground">{style.style}</span>
                                  {style.isAllNew && (
                                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "oklch(0.96 0.08 65)", color: "oklch(0.50 0.14 55)" }}>NEW</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                                  {style.category}
                                </span>
                                {((style as any).trends as string[] | undefined)?.map((t) => (
                                  <button
                                    key={t}
                                    onClick={(e) => { e.stopPropagation(); setTrendFilters((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]); }}
                                    title={`Filter by trend: ${t}`}
                                    className="text-xs px-1.5 py-0.5 rounded font-medium transition-colors hover:opacity-80"
                                    style={{
                                      background: trendFilters.includes(t) ? "oklch(0.88 0.10 75)" : "oklch(0.95 0.06 75)",
                                      color: "oklch(0.45 0.15 75)",
                                      border: trendFilters.includes(t) ? "1px solid oklch(0.70 0.12 75)" : "1px solid transparent",
                                    }}
                                  >
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">{style.totalSKUs}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {style.newSKUs > 0 ? (
                                <span className="font-semibold" style={{ color: "oklch(0.55 0.14 55)" }}>{style.newSKUs}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{style.existingSKUs}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-48">
                                {style.leathers.slice(0, 4).map((l) => (
                                  <span key={l} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{l}</span>
                                ))}
                                {style.leathers.length > 4 && <span className="text-xs text-muted-foreground">+{style.leathers.length - 4}</span>}
                              </div>
                            </td>
                            {/* Style-level Size 11 — badge only when true, click to toggle */}
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                {styleSize11 ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleStyleSize11Toggle(style.style); }}
                                    title="Size 11 — click to remove"
                                    className="px-2 py-0.5 rounded text-xs font-semibold transition-colors"
                                    style={{ background: "oklch(0.94 0.06 240)", color: "oklch(0.45 0.14 240)", border: "1px solid oklch(0.80 0.10 240)" }}
                                  >
                                    11
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleStyleSize11Toggle(style.style); }}
                                    title="Mark as Size 11"
                                    className="px-2 py-0.5 rounded text-xs text-transparent hover:text-muted-foreground transition-colors"
                                    style={{ border: "1px solid transparent" }}
                                  >
                                    11
                                  </button>
                                )}
                                {/* Style-level Sample Rcvd toggle — only for styles with new SKUs */}
                                {hasNewSkus && (
                                  styleSampleStatus === 'all' ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStyleSampleToggle(style.style); }}
                                      title="All samples received — click to mark as waiting"
                                      className="px-1.5 py-0.5 rounded text-xs font-medium transition-colors"
                                      style={{ background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)", border: "1px solid oklch(0.80 0.12 155)" }}
                                    >
                                      ✓ Rcvd
                                    </button>
                                  ) : styleSampleStatus === 'some' ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStyleSampleToggle(style.style); }}
                                      title="Some samples received — click to mark all received"
                                      className="px-1.5 py-0.5 rounded text-xs font-medium transition-colors"
                                      style={{ background: "oklch(0.96 0.05 80)", color: "oklch(0.50 0.12 80)", border: "1px solid oklch(0.85 0.08 80)" }}
                                    >
                                      ~ Rcvd
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStyleSampleToggle(style.style); }}
                                      title="Mark all samples as received"
                                      className="px-1.5 py-0.5 rounded text-xs text-transparent hover:text-muted-foreground transition-colors"
                                      style={{ border: "1px solid transparent" }}
                                    >
                                      ✓ Rcvd
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {allSessionsTotal.total > 0 ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-sm font-bold tabular-nums" style={{ color: "oklch(0.45 0.16 55)" }}>{allSessionsTotal.total}</span>
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    AU {allSessionsTotal.au} · USA {allSessionsTotal.usa} · NYC {allSessionsTotal.nyc}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            {/* Cancel style button */}
                            <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Cancel ${style.style}? It will be hidden across the dashboard. You can restore it later.`)) {
                                    cancelStyleMutation.mutate({ style: style.style });
                                    toast.success(`${style.style} cancelled`);
                                  }
                                }}
                                title="Cancel this style — hides it across the dashboard"
                                className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors text-muted-foreground"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>

                            {/* Expanded SKU rows with inline buy qty */}
                          {expandedStyle === style.style && (
                            <tr key={`${style.style}-expanded`} className="border-b" style={{ borderColor: "var(--border)" }}>
                              <td colSpan={8} className="px-6 py-4" style={{ background: "oklch(0.98 0.02 65 / 0.5)" }}>
                                {/* Website image + fit info row */}
                                {(() => {
                                  const sm = styleMetaMap[style.style];
                                  const imgUrl = sm?.websiteImageUrl;
                                  if (!imgUrl) return null;
                                  return (
                                    <div className="mb-3 flex items-start gap-3">
                                      <a href={`https://tonybianco.com.au/search?q=${encodeURIComponent(style.style.toLowerCase())}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <img
                          src={imgUrl}
                          alt={style.style}
                          className="w-20 h-20 object-contain rounded-lg border bg-white"
                          style={{ borderColor: "oklch(0.85 0.04 65)" }}
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      </a>
                                    </div>
                                  );
                                })()}

                                {/* Fit info — shown when style has been fit-approved */}
                                {(() => {
                                  const sm = styleMetaMap[style.style];
                                  if (!sm?.fitApproved) return null;
                                  const fitLabel = sm.fitRating === "tts" ? "True to Size" : sm.fitRating === "runs_small" ? "Runs Small" : sm.fitRating === "runs_large" ? "Runs Large" : null;
                                  const fitColourClass = sm.fitRating === "tts" ? "bg-green-100 text-green-800 border-green-200" : sm.fitRating === "runs_small" ? "bg-amber-100 text-amber-800 border-amber-200" : sm.fitRating === "runs_large" ? "bg-blue-100 text-blue-800 border-blue-200" : "";
                                  return (
                                    <div className="mb-3 flex items-start gap-3 p-3 rounded-lg border" style={{ background: "oklch(0.97 0.03 155 / 0.3)", borderColor: "oklch(0.85 0.06 155)" }}>
                                      <span className="text-xs font-semibold text-green-700 flex items-center gap-1 shrink-0">✓ Fit Approved</span>
                                      {fitLabel && (
                                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${fitColourClass}`}>{fitLabel}</span>
                                      )}
                                      {sm.fittingNotes && (
                                        <span className="text-xs italic text-muted-foreground">{sm.fittingNotes}</span>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Session context */}
                                {selectedSession && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                      {isSessionLocked ? "📋 Viewing:" : "✏️ Entering qtys for:"}
                                    </span>
                                    <span className="text-xs font-semibold" style={{ color: "oklch(0.50 0.14 55)" }}>
                                      {selectedSession.name}
                                    </span>
                                    {isSessionLocked && (
                                      <span className="text-xs text-muted-foreground">(locked — read only)</span>
                                    )}
                                  </div>
                                )}

                                {/* Add Colour button + inline form — always visible */}
                                {(() => {
                                  const draft = addColourDraft[style.style];
                                  return (
                                    <div className="mb-3">
                                      {draft ? (
                                        <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: "oklch(0.80 0.10 65)", background: "oklch(0.98 0.02 65 / 0.5)" }}>
                                          <input
                                            type="text"
                                            placeholder="Colour (e.g. DOVE)"
                                            value={draft.colour}
                                            onChange={(e) => setAddColourDraft((prev) => ({ ...prev, [style.style]: { ...prev[style.style], colour: e.target.value.toUpperCase() } }))}
                                            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && draft.colour.trim()) addCustomSkuMutation.mutate({ style: style.style, colour: draft.colour.trim(), leather: draft.leather.trim() }); if (e.key === "Escape") setAddColourDraft((prev) => { const n = { ...prev }; delete n[style.style]; return n; }); }}
                                            className="flex-1 px-2 py-1 rounded border text-xs bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                          />
                                          <input
                                            type="text"
                                            placeholder="Leather (e.g. NAPPA)"
                                            value={draft.leather}
                                            onChange={(e) => setAddColourDraft((prev) => ({ ...prev, [style.style]: { ...prev[style.style], leather: e.target.value.toUpperCase() } }))}
                                            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && draft.colour.trim()) addCustomSkuMutation.mutate({ style: style.style, colour: draft.colour.trim(), leather: draft.leather.trim() }); if (e.key === "Escape") setAddColourDraft((prev) => { const n = { ...prev }; delete n[style.style]; return n; }); }}
                                            className="flex-1 px-2 py-1 rounded border text-xs bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!draft.colour.trim()) return;
                                              addCustomSkuMutation.mutate({ style: style.style, colour: draft.colour.trim(), leather: draft.leather.trim() });
                                            }}
                                            disabled={!draft.colour.trim() || addCustomSkuMutation.isPending}
                                            className="px-3 py-1 rounded text-xs font-semibold text-white disabled:opacity-50"
                                            style={{ background: "oklch(0.65 0.16 65)" }}
                                          >
                                            {addCustomSkuMutation.isPending ? "Adding..." : "Add"}
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setAddColourDraft((prev) => { const n = { ...prev }; delete n[style.style]; return n; }); }}
                                            className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setAddColourDraft((prev) => ({ ...prev, [style.style]: { colour: "", leather: "" } })); }}
                                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Add colour
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Split into Existing and New SKU sections */}
                                {(() => {
                                  const allSkus = getSkusForStyle(style.style);
                                  const existingSkus = allSkus.filter((s) => !s.is_new);
                                  const newSkus = allSkus.filter((s) => s.is_new);

                                  const renderRow = (sku: typeof allSkus[0], isNew: boolean) => {
                                    const skuKey2 = `${sku.style}|${sku.colour}|${sku.leather}`;
                                    const dbMeta = skuMetaMap[skuKey2];
                                    const sessionQtyObj = sessionItemMap[skuKey2] ?? { auQty: 0, usaQty: 0, nycQty: 0, laQty: 0 };
                                    const sessionAuQty = sessionQtyObj.auQty;
                                    const sessionUsaQty = sessionQtyObj.usaQty;
                                    const sessionNycQty = sessionQtyObj.nycQty;
                                    const sessionLaQty = sessionQtyObj.laQty;
                                    const sessionTotalQty = sessionAuQty + sessionUsaQty + sessionNycQty + sessionLaQty;
                                    // All-session combined totals
                                    const allQtyData = (allSessionQtys as Record<string, { totalAu: number; totalUsa: number; totalNyc: number; totalLa: number; total: number; sessions: Array<{ sessionId: number; sessionName: string; au: number; usa: number; nyc: number; la: number }> }>)[skuKey2];
                                    const allTotalAu = allQtyData?.totalAu ?? 0;
                                    const allTotalUsa = allQtyData?.totalUsa ?? 0;
                                    const allTotalNyc = allQtyData?.totalNyc ?? 0;
                                    const allTotalLa = allQtyData?.totalLa ?? 0;
                                    const allTotal = allQtyData?.total ?? 0;
                                    return (
                                      <div
                                        key={`${sku.colour}-${sku.leather}`}
                                        className="grid items-center gap-2 px-3 py-2 rounded-lg"
                                        style={{
                                          gridTemplateColumns: isNew
                                            ? "1.5fr 1.5fr 40px 70px 50px 130px 32px 28px"
                                            : "1.5fr 1.5fr 40px 50px 130px 32px 28px",
                                          border: "1px solid var(--border)",
                                          background: sessionTotalQty > 0 ? "oklch(0.97 0.06 65 / 0.5)" : "var(--card)",
                                        }}
                                      >
                                        {/* Colour */}
                                        <span className="text-sm font-medium text-foreground truncate">{displayColour(sku.colour, sku.leather)}</span>
                                        {/* Leather */}
                                        <span className="text-xs text-muted-foreground truncate">{displayLeather(sku.leather || "", sku.style) || "—"}</span>
                                        {/* Size 11 — only show badge if YES */}
                                        <span className="text-xs text-center">
                                          {styleSize11 ? (
                                            <span className="px-1 py-0.5 rounded text-xs font-semibold" style={{ background: "oklch(0.94 0.06 240)", color: "oklch(0.45 0.14 240)" }}>11</span>
                                          ) : null}
                                        </span>
                                        {/* Sample — new SKUs only, click to toggle received/waiting */}
                                        {isNew && (
                                          <span className="text-xs text-center" onClick={(e) => e.stopPropagation()}>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleSampleToggle(sku.style, sku.colour, sku.leather, dbMeta?.sampleStatus); }}
                              title={
                                dbMeta?.sampleStatus === "received" ? "Sample received — click to reset to waiting" :
                                dbMeta?.sampleStatus === "fitting_sample" ? "Fitting sample received (set via Fittings tab)" :
                                "Mark sample as received"
                              }
                                              className="px-1.5 py-0.5 rounded text-xs font-medium transition-colors"
                                              style={
                                                dbMeta?.sampleStatus === "received"
                                                  ? { background: "oklch(0.94 0.08 155)", color: "oklch(0.40 0.14 155)", border: "1px solid oklch(0.80 0.12 155)" }
                                                : dbMeta?.sampleStatus === "fitting_sample"
                                                  ? { background: "oklch(0.96 0.10 65)", color: "oklch(0.45 0.16 55)", border: "1px solid oklch(0.82 0.14 65)" }
                                                : { background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
                                              }
                                            >
                                              {dbMeta?.sampleStatus === "received" ? "✓ Rcvd" : dbMeta?.sampleStatus === "fitting_sample" ? "Fit Spl" : "Rcvd?"}
                                            </button>
                                          </span>
                                        )}
                                        {/* All-session total bought badge */}
                                        <div className="flex items-center gap-1.5">
                                          {allTotal > 0 ? (
                                            <div className="flex flex-col items-center gap-0.5" title={allQtyData?.sessions.map((s) => `${s.sessionName}: AU ${s.au} / USA ${s.usa}${s.nyc ? ` / NYC ${s.nyc}` : ''}`).join('\n')}>
                                              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none" style={{ color: "oklch(0.55 0.14 55)" }}>Total</span>
                                              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "oklch(0.94 0.08 65)", color: "oklch(0.45 0.14 55)" }}>{allTotal}</span>
                                              <span className="text-[9px] tabular-nums text-muted-foreground leading-none mt-0.5">
                                                AU {allTotalAu} · USA {allTotalUsa}
                                              </span>
                                              {allTotalNyc > 0 && (
                                                <span className="text-[9px] tabular-nums leading-none" style={{ color: "oklch(0.45 0.16 300)" }}>NYC {allTotalNyc}</span>
                                              )}
                                              {allTotalLa > 0 && (
                                                <span className="text-[9px] tabular-nums leading-none" style={{ color: "oklch(0.45 0.16 160)" }}>LA {allTotalLa}</span>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center gap-0.5">
                                              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none text-muted-foreground">Total</span>
                                              <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded" style={{ background: "var(--muted)" }}>0</span>
                                            </div>
                                          )}
                                        </div>
                                        {/* Buy Qty — session input (always visible, disabled when no active session) */}
                                        <div className="flex items-center gap-1.5">
                                          {(() => {
                                            const canEdit = !isSessionLocked && !!selectedSession;
                                            return (
                                              <>
                                                <div className="flex flex-col items-center gap-0.5">
                                                  <span className="text-[9px] font-semibold uppercase tracking-wide leading-none" style={{ color: canEdit ? "var(--muted-foreground)" : "var(--muted-foreground)", opacity: canEdit ? 1 : 0.5 }}>AU</span>
                                                  <input
                                                    type="number" min={0}
                                                    disabled={!canEdit}
                                                    defaultValue={sessionAuQty || ""}
                                                    key={`au-${selectedSessionId}-${skuKey2}-${sessionAuQty}`}
                                                    onChange={(e) => handleQtyChange(sku.style, sku.colour, sku.leather, 'au', e.target.value)}
                                                    onBlur={() => handleQtyBlur(sku.style, sku.colour, sku.leather, 'au')}
                                                    onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                                    placeholder="0"
                                                    className="w-14 px-1.5 py-1 rounded border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40 text-right disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{ borderColor: sessionAuQty > 0 ? "oklch(0.72 0.16 65)" : "var(--border)" }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                                <div className="flex flex-col items-center gap-0.5">
                                                  <span className="text-[9px] font-semibold uppercase tracking-wide leading-none" style={{ color: "var(--muted-foreground)", opacity: canEdit ? 1 : 0.5 }}>USA</span>
                                                  <input
                                                    type="number" min={0}
                                                    disabled={!canEdit}
                                                    defaultValue={sessionUsaQty || ""}
                                                    key={`usa-${selectedSessionId}-${skuKey2}-${sessionUsaQty}`}
                                                    onChange={(e) => handleQtyChange(sku.style, sku.colour, sku.leather, 'usa', e.target.value)}
                                                    onBlur={() => handleQtyBlur(sku.style, sku.colour, sku.leather, 'usa')}
                                                    onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                                    placeholder="0"
                                                    className="w-14 px-1.5 py-1 rounded border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-400/40 text-right disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{ borderColor: sessionUsaQty > 0 ? "oklch(0.65 0.14 240)" : "var(--border)" }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                                <div className="flex flex-col items-center gap-0.5">
                                                  <span className="text-[9px] font-semibold uppercase tracking-wide leading-none" style={{ color: "var(--muted-foreground)", opacity: canEdit ? 1 : 0.5 }}>NYC</span>
                                                  <input
                                                    type="number" min={0}
                                                    disabled={!canEdit}
                                                    defaultValue={sessionNycQty || ""}
                                                    key={`nyc-${selectedSessionId}-${skuKey2}-${sessionNycQty}`}
                                                    onChange={(e) => handleQtyChange(sku.style, sku.colour, sku.leather, 'nyc', e.target.value)}
                                                    onBlur={() => handleQtyBlur(sku.style, sku.colour, sku.leather, 'nyc')}
                                                    onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                                    placeholder="0"
                                                    className="w-14 px-1.5 py-1 rounded border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-purple-400/40 text-right disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{ borderColor: sessionNycQty > 0 ? "oklch(0.55 0.18 300)" : "var(--border)" }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                                <div className="flex flex-col items-center gap-0.5">
                                                  <span className="text-[9px] font-semibold uppercase tracking-wide leading-none" style={{ color: "var(--muted-foreground)", opacity: canEdit ? 1 : 0.5 }}>LA</span>
                                                  <input
                                                    type="number" min={0}
                                                    disabled={!canEdit}
                                                    defaultValue={sessionLaQty || ""}
                                                    key={`la-${selectedSessionId}-${skuKey2}-${sessionLaQty}`}
                                                    onChange={(e) => handleQtyChange(sku.style, sku.colour, sku.leather, 'la', e.target.value)}
                                                    onBlur={() => handleQtyBlur(sku.style, sku.colour, sku.leather, 'la')}
                                                    onKeyDown={(e) => { if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); } }}
                                                    placeholder="0"
                                                    className="w-14 px-1.5 py-1 rounded border text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-green-400/40 text-right disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{ borderColor: sessionLaQty > 0 ? "oklch(0.55 0.18 160)" : "var(--border)" }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                              </>
                                            );
                                          })()}
                                        </div>
                                        {/* Detail button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSku({
                                              style: sku.style,
                                              colour: sku.colour,
                                              leather: sku.leather,
                                              isNew: sku.is_new,
                                              category: style.category,
                                              last: style.last,
                                              imageUrl: style.imageUrl,
                                            });
                                          }}
                                          className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                                          title="View SKU details"
                                        >
                                          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                                        </button>
                                        {/* Cancel SKU button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Cancel ${sku.colour} ${sku.leather} from ${sku.style}? It will be hidden from the range.`)) {
                                              cancelSkuMutation.mutate({ style: sku.style, colour: sku.colour, leather: sku.leather });
                                            }
                                          }}
                                          className="p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                                          title="Cancel this SKU"
                                        >
                                          <Ban className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                                        </button>
                                      </div>
                                    );
                                  };

                                  // Grid template columns must match renderRow exactly
                                  // Colour 1.5fr, Leather 1.5fr, Sz11 40px, Total 50px, Sample 70px (new only), BuyQty 130px, detail 32px, cancel 28px
                                  const existingCols = "1.5fr 1.5fr 40px 50px 130px 32px 28px";
                                  const newCols = "1.5fr 1.5fr 40px 70px 50px 130px 32px 28px";

                                  return (
                                    <div className="space-y-3">
                                      {/* Existing SKUs section */}
                                      {existingSkus.length > 0 && (
                                        <div>
                                          {/* Section label */}
                                          <div className="flex items-center gap-2 mb-1 px-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Existing</span>
                                            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                                          </div>
                                          {/* Column headers — same grid as data rows */}
                                          <div className="grid px-3 mb-0.5" style={{ gridTemplateColumns: existingCols, gap: "0.5rem" }}>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Colour</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Leather</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Sz11</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-center" style={{ color: "oklch(0.55 0.14 55)" }}>Total</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Buy Qty</span>
                                            <span />{/* detail btn col */}
                                            <span />{/* cancel btn col */}
                                          </div>
                                          <div className="space-y-1">
                                            {existingSkus.map((sku) => renderRow(sku, false))}
                                          </div>
                                        </div>
                                      )}
                                      {/* New SKUs section */}
                                      {newSkus.length > 0 && (
                                        <div>
                                          {/* Section label */}
                                          <div className="flex items-center gap-2 mb-1 px-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(0.55 0.14 55)" }}>New</span>
                                            <div className="flex-1 h-px" style={{ background: "oklch(0.85 0.06 65)" }} />
                                          </div>
                                          {/* Column headers — same grid as data rows */}
                                          <div className="grid px-3 mb-0.5" style={{ gridTemplateColumns: newCols, gap: "0.5rem" }}>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Colour</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Leather</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Sz11</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Sample</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-center" style={{ color: "oklch(0.55 0.14 55)" }}>Total</span>
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Buy Qty</span>
                                            <span />{/* detail btn col */}
                                            <span />{/* cancel btn col */}
                                          </div>
                                          <div className="space-y-1">
                                            {newSkus.map((sku) => renderRow(sku, true))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fit Approved section — collapsed, at the bottom of By Style */}
      {approvedFitStyles.length > 0 && (
        <div className="mt-4 border rounded-xl overflow-hidden" style={{ borderColor: "oklch(0.85 0.06 155)" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: fitApprovedSectionOpen ? "oklch(0.97 0.03 155 / 0.4)" : "oklch(0.97 0.03 155 / 0.25)" }}
            onClick={() => setFitApprovedSectionOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold" style={{ color: "oklch(0.38 0.10 155)" }}>
                Fit Approved ({approvedFitStyles.length} {approvedFitStyles.length === 1 ? "style" : "styles"})
              </span>
              <span className="text-xs" style={{ color: "oklch(0.55 0.08 155)" }}>— fit confirmed, notes saved</span>
            </div>
            {fitApprovedSectionOpen
              ? <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.55 0.08 155)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.55 0.08 155)" }} />}
          </button>

          {fitApprovedSectionOpen && (
            <div className="divide-y" style={{ borderColor: "oklch(0.92 0.04 155)" }}>
              {approvedFitStyles.map((style) => {
                const sm = styleMetaMap[style.style];
                const images = fitImagesMap[style.style] ?? [];
                const isExpanded = expandedApprovedStyle === style.style;
                const fitLabel = sm?.fitRating === "tts" ? "True to Size" : sm?.fitRating === "runs_small" ? "Runs Small" : sm?.fitRating === "runs_large" ? "Runs Large" : null;
                const fitBadgeClass = sm?.fitRating === "tts" ? "bg-green-100 text-green-800 border-green-200" : sm?.fitRating === "runs_small" ? "bg-amber-100 text-amber-800 border-amber-200" : sm?.fitRating === "runs_large" ? "bg-blue-100 text-blue-800 border-blue-200" : "";
                return (
                  <div key={style.style}>
                    {/* Style row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedApprovedStyle(isExpanded ? null : style.style)}
                    >
                      {style.imageUrl && (
                        <img src={style.imageUrl} alt={style.style} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{style.style}</span>
                          <span className="text-xs text-muted-foreground">{style.last}</span>
                          {fitLabel && (
                            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${fitBadgeClass}`}>{fitLabel}</span>
                          )}
                        </div>
                        {sm?.fittingNotes && !isExpanded && (
                          <p className="text-xs italic text-muted-foreground mt-0.5 truncate">{sm.fittingNotes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            undoApprovalMutation.mutate({ style: style.style, fitApproved: false });
                            toast.success(`${style.style} moved back to Fitting tab`);
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
                          title="Undo approval — move back to Fitting tab"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Undo
                        </button>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded fit details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: "oklch(0.98 0.01 155 / 0.4)" }}>
                        {sm?.fittingNotes && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Fitting Notes</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{sm.fittingNotes}</p>
                          </div>
                        )}
                        {images.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fitting Images</p>
                            <div className="flex flex-wrap gap-2">
                              {images.map((img) => (
                                <img
                                  key={img.id}
                                  src={img.imageUrl}
                                  alt="Fitting"
                                  className="w-24 h-24 rounded-lg object-cover border border-border"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {!sm?.fittingNotes && images.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No notes or images saved.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cancelled Styles section */}
      {cancelledList.length > 0 && (
        <div className="mt-4 border rounded-xl overflow-hidden" style={{ borderColor: "oklch(0.82 0.06 20)" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: cancelledSectionOpen ? "oklch(0.97 0.03 20 / 0.4)" : "oklch(0.97 0.03 20 / 0.25)" }}
            onClick={() => setCancelledSectionOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4" style={{ color: "oklch(0.55 0.12 20)" }} />
              <span className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 20)" }}>
                Cancelled ({cancelledList.length} {cancelledList.length === 1 ? "style" : "styles"})
              </span>
              <span className="text-xs" style={{ color: "oklch(0.60 0.08 20)" }}>— hidden from dashboard</span>
            </div>
            {cancelledSectionOpen
              ? <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />}
          </button>

          {cancelledSectionOpen && (
            <div className="divide-y" style={{ borderColor: "oklch(0.90 0.04 20)" }}>
              {cancelledList.map((row) => {
                const styleInfo = skuData.styles.find((s) => s.style === row.style);
                return (
                  <div key={row.style} className="flex items-center gap-3 px-4 py-3">
                    {styleInfo?.imageUrl && (
                      <img src={styleInfo.imageUrl} alt={row.style} className="w-10 h-10 rounded object-cover flex-shrink-0 opacity-50" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-muted-foreground line-through">{row.style}</span>
                      {styleInfo && (
                        <span className="ml-2 text-xs text-muted-foreground">{styleInfo.last} · {styleInfo.category}</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        restoreStyleMutation.mutate({ style: row.style });
                        toast.success(`${row.style} restored`);
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
                      title="Restore this style"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Restore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cancelled SKUs section */}
      {cancelledSkuList.length > 0 && (
        <div className="mt-4 border rounded-xl overflow-hidden" style={{ borderColor: "oklch(0.82 0.06 20)" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            style={{ background: cancelledSkuSectionOpen ? "oklch(0.97 0.03 20 / 0.4)" : "oklch(0.97 0.03 20 / 0.25)" }}
            onClick={() => setCancelledSkuSectionOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4" style={{ color: "oklch(0.55 0.12 20)" }} />
              <span className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 20)" }}>
                Cancelled SKUs ({cancelledSkuList.length})
              </span>
              <span className="text-xs" style={{ color: "oklch(0.60 0.08 20)" }}>— hidden from range</span>
            </div>
            {cancelledSkuSectionOpen
              ? <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.55 0.08 20)" }} />}
          </button>
          {cancelledSkuSectionOpen && (
            <div className="divide-y" style={{ borderColor: "oklch(0.90 0.04 20)" }}>
              {(cancelledSkuList as Array<{ style: string; colour: string; leather: string }>).map((row) => (
                <div key={`${row.style}|${row.colour}|${row.leather}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-muted-foreground line-through">{displayColourLeather(row.colour, row.leather, row.style)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.style}</span>
                  </div>
                  <button
                    onClick={() => {
                      restoreSkuMutation.mutate({ style: row.style, colour: row.colour, leather: row.leather });
                      toast.success(`${displayColourLeather(row.colour, row.leather, row.style)} restored to ${row.style}`);
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
                    title="Restore this SKU"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SKU Detail Panel */}
      {selectedSku && (
        <SkuDetailPanel
          sku={selectedSku}
          onClose={() => setSelectedSku(null)}
          skuMeta={skuMetaMap as any}
          styleMeta={styleMetaMap as any}
          onMetaChange={handleMetaChange}
          allStyleSkus={getSkusForStyle(selectedSku.style).map((s) => ({ colour: s.colour, leather: s.leather }))}
        />
      )}

      {/* Import Panel */}
      {showImport && (
        <ImportPanel
          onClose={() => setShowImport(false)}
          onImportDone={() => { refetchSkuMeta(); refetchStyleMeta(); }}
        />
      )}

      {/* Invoice Import Dialog */}
      {showInvoiceImport && (
        <InvoiceImportDialog
          allSkus={skuData.rawSkus.map((s) => ({ style: s.style, colour: s.colour, leather: s.leather ?? "" }))}
          onClose={() => setShowInvoiceImport(false)}
          onDone={() => { refetchSkuMeta(); setShowInvoiceImport(false); }}
        />
      )}
      {/* Add Style Modal */}
      {showAddStyleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddStyleModal(false)}>
          <div
            className="relative bg-card rounded-2xl shadow-2xl border w-full max-w-md mx-4 p-6 flex flex-col gap-5"
            style={{ borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Add New Style</h2>
              <button onClick={() => setShowAddStyleModal(false)} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Style Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Style Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newStyleName}
                onChange={(e) => setNewStyleName(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter" && newStyleName.trim() && newStyleLast) handleAddStyleSubmit(); if (e.key === "Escape") setShowAddStyleModal(false); }}
                placeholder="e.g. CORFU"
                className="px-3 py-2 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                style={{ borderColor: "var(--border)" }}
                autoFocus
              />
            </div>

            {/* Last */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Last <span className="text-red-500">*</span></label>
              <select
                value={newStyleLast}
                onChange={(e) => setNewStyleLast(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">Select a last…</option>
                {allKnownLasts.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Category <span className="text-muted-foreground text-xs">(optional)</span></label>
              <select
                value={newStyleCategory}
                onChange={(e) => setNewStyleCategory(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">Select a category…</option>
                {availableCategories.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Colour + Leather */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">Colour <span className="text-muted-foreground text-xs">(optional)</span></label>
                <input
                  type="text"
                  value={newStyleColour}
                  onChange={(e) => setNewStyleColour(e.target.value.toUpperCase())}
                  placeholder="e.g. BLACK"
                  className="px-3 py-2 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">Leather <span className="text-muted-foreground text-xs">(optional)</span></label>
                <input
                  type="text"
                  value={newStyleLeather}
                  onChange={(e) => setNewStyleLeather(e.target.value.toUpperCase())}
                  placeholder="e.g. NAPPA"
                  className="px-3 py-2 text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Style Image <span className="text-muted-foreground text-xs">(optional)</span></label>
              <div
                className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 p-4 min-h-[120px] ${
                  newStyleDragging ? "border-purple-400 bg-purple-50/30" : "border-border hover:border-purple-300 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setNewStyleDragging(true); }}
                onDragLeave={() => setNewStyleDragging(false)}
                onDrop={handleAddStyleDrop}
                onClick={() => addStyleImageInputRef.current?.click()}
              >
                {newStyleImagePreview ? (
                  <>
                    <img src={newStyleImagePreview} alt="Preview" className="w-full max-h-48 object-contain rounded-lg" style={{ display: 'block' }} />
                    <span className="text-xs text-muted-foreground">{newStyleImageFile?.name}</span>
                    <button
                      className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-red-100 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setNewStyleImageFile(null); setNewStyleImagePreview(null); }}
                    >
                      <X className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground text-center">
                      {newStyleDragging ? "Drop image here" : "Drag & drop or click to browse"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setShowAddStyleModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddStyleSubmit}
                disabled={isAddingStyle || !newStyleName.trim() || !newStyleLast}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAddingStyle ? "Adding…" : "Add Style"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Hidden file input for Add Style image */}
      <input
        ref={addStyleImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAddStyleBrowse}
      />
      {/* Hidden file input for style image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
    </div>
  );
}

// ─── Invoice Import Dialog ────────────────────────────────────────────────────
type InvoiceMatch = {
  invoiceStyle: string;
  invoiceColour: string;
  invoiceMaterial: string;
  sampleType: string;
  matchedStyle: string | null;
  matchedColour: string | null;
  matchedLeather: string | null;
  confidence: number;
  status: "matched" | "no_match";
};

function InvoiceImportDialog({
  allSkus,
  onClose,
  onDone,
}: {
  allSkus: { style: string; colour: string; leather: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [results, setResults] = useState<InvoiceMatch[]>([]);
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const parseInvoice = trpc.sku.parseInvoice.useMutation();
  const updateSku = trpc.sku.update.useMutation();

  async function handleFile(file: File) {
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const res = await parseInvoice.mutateAsync({ fileBase64: base64, allSkus });
      setResults(res.results as InvoiceMatch[]);
      // Pre-approve all matched rows
      const matched = new Set<number>();
      res.results.forEach((r, i) => { if (r.status === "matched") matched.add(i); });
      setApproved(matched);
      setStep("review");
    } catch (e: any) {
      toast.error(`Failed to parse invoice: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    setIsLoading(true);
    let count = 0;
    try {
      for (const idx of approved) {
        const r = results[idx];
        if (!r.matchedStyle || !r.matchedColour) continue;
        // Map invoice sample type string to dashboard sampleType value
        const rawType = (r.sampleType ?? "").toLowerCase();
        const mappedType = rawType.includes("salesman") ? "Salesman Sample"
          : rawType.includes("proto") ? "Proto"
          : rawType.includes("revised") ? "Revised"
          : r.sampleType || null;
        await updateSku.mutateAsync({
          style: r.matchedStyle,
          colour: r.matchedColour,
          leather: r.matchedLeather ?? "",
          sampleStatus: "received",
          sampleType: mappedType,
        });
        count++;
      }
      toast.success(`${count} SKU${count !== 1 ? "s" : ""} marked as Sample Received`);
      onDone();
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  const sampleTypeBadge = (t: string) => {
    const lower = t.toLowerCase();
    if (lower.includes("salesman")) return { label: "Salesman", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" };
    if (lower.includes("proto")) return { label: "Proto", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
    if (lower.includes("revised")) return { label: "Revised", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
    return { label: t, bg: "#f8fafc", color: "#475569", border: "#cbd5e1" };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-base font-semibold">Import Invoice</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "upload" ? "Upload a supplier XLSX invoice to mark samples as received" :
               step === "review" ? `Review ${results.length} items found — approve or reject each match` :
               "Import complete"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div
              className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
              style={{ borderColor: "var(--border)" }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Parsing invoice and matching SKUs…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground">Accepts .xlsx invoice files (DHL / supplier format)</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-2">
              {/* Accept/Reject all */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setApproved(new Set(results.map((_, i) => i).filter(i => results[i].status === "matched")))}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-green-50 hover:border-green-400 hover:text-green-700"
                  style={{ borderColor: "var(--border)" }}
                >Accept All Matched</button>
                <button
                  onClick={() => setApproved(new Set())}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-red-50 hover:border-red-400 hover:text-red-700"
                  style={{ borderColor: "var(--border)" }}
                >Reject All</button>
                <span className="text-xs text-muted-foreground ml-auto">{approved.size} selected</span>
              </div>

              {results.map((r, i) => {
                const badge = sampleTypeBadge(r.sampleType);
                const isApproved = approved.has(i);
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer"
                    style={{
                      borderColor: isApproved ? "oklch(0.80 0.12 155)" : "var(--border)",
                      background: isApproved ? "oklch(0.97 0.03 155 / 0.5)" : r.status === "no_match" ? "oklch(0.98 0.02 20 / 0.4)" : "var(--card)",
                    }}
                    onClick={() => {
                      if (r.status === "no_match") return;
                      setApproved(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      });
                    }}
                  >
                    {/* Checkbox */}
                    <div className="mt-0.5 flex-shrink-0">
                      {r.status === "matched" ? (
                        <div
                          className="w-4 h-4 rounded border-2 flex items-center justify-center"
                          style={{ borderColor: isApproved ? "oklch(0.55 0.14 155)" : "var(--border)", background: isApproved ? "oklch(0.55 0.14 155)" : "transparent" }}
                        >
                          {isApproved && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border-2" style={{ borderColor: "var(--border)", opacity: 0.4 }} />
                      )}
                    </div>

                    {/* Invoice item */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{r.invoiceStyle}</span>
                        <span className="text-sm text-muted-foreground">{r.invoiceColour}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                        >{badge.label}</span>
                      </div>
                      {r.status === "matched" ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-muted-foreground">→</span>
                          <span className="text-xs font-medium text-foreground">{r.matchedStyle}</span>
                          <span className="text-xs text-muted-foreground">{r.matchedColour}</span>
                          {r.matchedLeather && <span className="text-xs text-muted-foreground">{r.matchedLeather}</span>}
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded ml-1"
                            style={{
                              background: r.confidence >= 80 ? "oklch(0.94 0.08 155)" : r.confidence >= 60 ? "oklch(0.97 0.08 80)" : "oklch(0.97 0.04 20)",
                              color: r.confidence >= 80 ? "oklch(0.40 0.14 155)" : r.confidence >= 60 ? "oklch(0.50 0.14 80)" : "oklch(0.50 0.14 20)",
                            }}
                          >{r.confidence}% match</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1 italic">No matching SKU found in dashboard</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div className="px-5 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
              style={{ borderColor: "var(--border)" }}
            >← Back</button>
            <button
              onClick={handleConfirm}
              disabled={approved.size === 0 || isLoading}
              className="px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ background: "oklch(0.55 0.14 155)", color: "white" }}
            >
              {isLoading ? "Saving…" : `Mark ${approved.size} SKU${approved.size !== 1 ? "s" : ""} as Received`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
