import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScanLine, Trash2, RotateCcw, ExternalLink, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SaleProduct {
  styleCode: string;
  colour: string;
  productTitle: string;
  sourceUrl: string;
}

export function MarkdownTab() {

  const utils = trpc.useUtils();

  // Scan state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResults, setScanResults] = useState<SaleProduct[]>([]);
  const [selectedScan, setSelectedScan] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedPending, setSelectedPending] = useState<Set<number>>(new Set());

  const scanMutation = trpc.markdown.scan.useMutation({
    onSuccess: (data) => {
      setScanResults(data.saleProducts);
      // Pre-select all by default
      setSelectedScan(new Set(data.saleProducts.map((p) => `${p.styleCode}||${p.colour}`)));
      setScanOpen(true);
    },
    onError: (err) => {
      toast.error(`Scan failed: ${err.message}`);
    },
  });

  const flagMutation = trpc.markdown.flag.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.flagged} SKU(s) moved to Markdown — removed from By Style.`);
      setScanOpen(false);
      utils.markdown.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to flag SKUs: ${err.message}`);
    },
  });

  const updateStatusMutation = trpc.markdown.updateStatus.useMutation({
    onSuccess: () => {
      utils.markdown.list.invalidate();
      setSelectedPending(new Set());
      setDeleteConfirmOpen(false);
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: pendingSkus = [], isLoading } = trpc.markdown.list.useQuery({ status: "pending" });

  const allPendingSelected = pendingSkus.length > 0 && selectedPending.size === pendingSkus.length;
  const somePendingSelected = selectedPending.size > 0;

  function togglePending(id: number) {
    setSelectedPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPending() {
    if (allPendingSelected) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(pendingSkus.map((s) => s.id)));
    }
  }

  function toggleScanItem(key: string) {
    setSelectedScan((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleConfirmFlag() {
    const toFlag = scanResults.filter((p) => selectedScan.has(`${p.styleCode}||${p.colour}`));
    if (toFlag.length === 0) {
      toast({ title: "Nothing selected", description: "Select at least one SKU to flag." });
      return;
    }
    flagMutation.mutate(toFlag);
  }

  function handleBulkDelete() {
    if (selectedPending.size === 0) return;
    setDeleteConfirmOpen(true);
  }

  function handleConfirmDelete() {
    updateStatusMutation.mutate({ ids: Array.from(selectedPending), status: "deleted" });
  }

  function handleRestore(id: number) {
    updateStatusMutation.mutate({ ids: [id], status: "restored" });
  }

  const scanAllSelected = scanResults.length > 0 && selectedScan.size === scanResults.length;

  function toggleAllScan() {
    if (scanAllSelected) {
      setSelectedScan(new Set());
    } else {
      setSelectedScan(new Set(scanResults.map((p) => `${p.styleCode}||${p.colour}`)));
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Markdown SKUs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            SKUs flagged as marked-down on tonybianco.com.au — waiting for deletion approval.
          </p>
        </div>
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="gap-2"
        >
          {scanMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanLine className="h-4 w-4" />
          )}
          {scanMutation.isPending ? "Scanning…" : "Scan Markdowns"}
        </Button>
      </div>

      {/* Pending SKUs table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : pendingSkus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <CheckCircle2 className="h-10 w-10 text-green-500 opacity-60" />
          <p className="text-sm">No markdown SKUs pending deletion.</p>
          <p className="text-xs">Run a scan to check for new markdowns on the website.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Bulk actions bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allPendingSelected}
                onCheckedChange={toggleAllPending}
                aria-label="Select all"
              />
              <span className="text-sm text-muted-foreground">
                {somePendingSelected ? `${selectedPending.size} selected` : `${pendingSkus.length} SKU(s) pending`}
              </span>
            </div>
            {somePendingSelected && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleBulkDelete}
                disabled={updateStatusMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selectedPending.size} SKU{selectedPending.size !== 1 ? "s" : ""}
              </Button>
            )}
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="w-10 px-4 py-2.5"></th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Style</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Colour</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Flagged</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingSkus.map((sku) => (
                <tr
                  key={sku.id}
                  className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedPending.has(sku.id)}
                      onCheckedChange={() => togglePending(sku.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{sku.styleCode}</td>
                  <td className="px-4 py-3 text-foreground">{sku.colour}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {sku.sourceUrl ? (
                      <a
                        href={sku.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {sku.productTitle ?? "View"}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      sku.productTitle ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(sku.flaggedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRestore(sku.id)}
                      disabled={updateStatusMutation.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scan Results Dialog */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              Scan Results — {scanResults.length} sale SKU{scanResults.length !== 1 ? "s" : ""} found
            </DialogTitle>
            <DialogDescription>
              These SKUs are currently listed under Sale on tonybianco.com.au. Review and confirm which ones to move to Markdown.
            </DialogDescription>
          </DialogHeader>

          {scanResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
              <p className="text-sm">No sale SKUs found on the website.</p>
            </div>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center gap-2 px-1 pb-1 border-b border-border">
                <Checkbox
                  checked={scanAllSelected}
                  onCheckedChange={toggleAllScan}
                  id="scan-select-all"
                />
                <label htmlFor="scan-select-all" className="text-sm text-muted-foreground cursor-pointer">
                  Select all ({scanResults.length})
                </label>
                <Badge variant="secondary" className="ml-auto">
                  {selectedScan.size} selected
                </Badge>
              </div>

              {/* Scrollable list */}
              <div className="overflow-y-auto flex-1 min-h-0 space-y-1 pr-1">
                {scanResults.map((p) => {
                  const key = `${p.styleCode}||${p.colour}`;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/20 transition-colors"
                    >
                      <Checkbox
                        checked={selectedScan.has(key)}
                        onCheckedChange={() => toggleScanItem(key)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground text-sm">{p.styleCode}</span>
                        <span className="text-muted-foreground text-sm mx-1.5">·</span>
                        <span className="text-sm text-foreground">{p.colour}</span>
                        {p.productTitle && (
                          <p className="text-xs text-muted-foreground truncate">{p.productTitle}</p>
                        )}
                      </div>
                      {p.sourceUrl && (
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <DialogFooter className="pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setScanOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmFlag}
              disabled={selectedScan.size === 0 || flagMutation.isPending}
              className="gap-2"
            >
              {flagMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Move {selectedScan.size} to Markdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Permanently delete {selectedPending.size} SKU{selectedPending.size !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove these SKUs from the dashboard. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedPending.size} SKU{selectedPending.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
