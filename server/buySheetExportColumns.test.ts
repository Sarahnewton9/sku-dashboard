import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import { BUY_SHEET_FOB_USD_NUMBER_FORMAT, getBuySheetExportHeaders } from "@shared/buySheetExportColumns";

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

  it("keeps FOB values numeric when the workbook is read back", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["FOB (USD)"], [31.5]]);
    sheet.A2.z = BUY_SHEET_FOB_USD_NUMBER_FORMAT;
    XLSX.utils.book_append_sheet(workbook, sheet, "Buy Sheet");

    const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true });
    const roundTripped = XLSX.read(output, { type: "buffer", cellDates: false, cellNF: true });
    const fob = roundTripped.Sheets["Buy Sheet"]?.A2;

    expect(fob?.t).toBe("n");
    expect(fob?.v).toBe(31.5);
    expect(fob?.z).toBe(BUY_SHEET_FOB_USD_NUMBER_FORMAT);
  });
});
