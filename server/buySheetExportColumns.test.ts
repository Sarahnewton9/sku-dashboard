import { describe, expect, it } from "vitest";
import { getBuySheetExportHeaders } from "@shared/buySheetExportColumns";

describe("Buy Sheet export columns", () => {
  it("keeps the standard Buy Sheet free of buy share and cost columns", () => {
    expect(getBuySheetExportHeaders({ hasUsa: true, hasNyc: true, hasLa: true })).toEqual([
      "CATEGORY", "LAST", "SIZE 11", "STYLE", "COLOUR", "AP21 SKU COLOUR",
      "AU QTY", "USA QTY", "NYC QTY", "LA QTY", "TOTAL QTY",
    ]);
  });

  it("adds FOB only when a cost-inclusive export is selected", () => {
    expect(getBuySheetExportHeaders({ includeCosts: true, hasUsa: true })).toEqual([
      "CATEGORY", "LAST", "SIZE 11", "STYLE", "COLOUR", "AP21 SKU COLOUR",
      "FOB (USD)", "AU QTY", "USA QTY", "TOTAL QTY",
    ]);
  });
});
