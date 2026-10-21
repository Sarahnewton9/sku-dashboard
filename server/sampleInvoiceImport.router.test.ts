import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: () => undefined, cookie: () => undefined } as any,
  };
}

function createInvoiceBase64(rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Invoice");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}

describe("sample invoice import router", () => {
  it("matches new W27 range SKUs instead of relying on static SS26 data", async () => {
    const caller = appRouter.createCaller(createCtx());
    const fileBase64 = createInvoiceBase64([
      ["LEATHER SHOE SAMPLE", "Salesman", "ESSA", "CHOCOLATE NAPPA", ""],
      ["LEATHER SHOE SAMPLE", "Salesman", "JERZY", "ROYAL SUEDE", ""],
      ["LEATHER SHOE SAMPLE", "Salesman", "LUCKY", "VANILLA NAPPA", ""],
    ]);

    const result = await caller.sku.parseInvoice({
      fileBase64,
      allSkus: [
        { style: "ESSA", colour: "CHOCOLATE", leather: "NAPPA" },
        { style: "JERZY", colour: "ROYAL", leather: "SUEDE" },
        { style: "LUCKY", colour: "VANILLA", leather: "NAPPA" },
      ],
    });

    expect(result.totalParsed).toBe(3);
    expect(result.results).toEqual([
      expect.objectContaining({ status: "matched", matchedStyle: "ESSA", matchedColour: "CHOCOLATE", matchedLeather: "NAPPA", confidence: 100 }),
      expect.objectContaining({ status: "matched", matchedStyle: "JERZY", matchedColour: "ROYAL", matchedLeather: "SUEDE", confidence: 100 }),
      expect.objectContaining({ status: "matched", matchedStyle: "LUCKY", matchedColour: "VANILLA", matchedLeather: "NAPPA", confidence: 100 }),
    ]);
  });

  it("returns the complete matched identity for a dual-upper sample", async () => {
    const caller = appRouter.createCaller(createCtx());
    const fileBase64 = createInvoiceBase64([
      ["LEATHER SHOE SAMPLE", "Salesman", "ROBYN", "ECRU SNAKE / ROYAL SUEDE", ""],
    ]);

    const result = await caller.sku.parseInvoice({
      fileBase64,
      allSkus: [{
        style: "ROBYN",
        colour: "ECRU",
        leather: "SNAKE",
        colour2: "ROYAL",
        leather2: "SUEDE",
      }],
    });

    expect(result.results[0]).toEqual(expect.objectContaining({
      status: "matched",
      matchedStyle: "ROBYN",
      matchedColour: "ECRU",
      matchedLeather: "SNAKE",
      matchedColour2: "ROYAL",
      matchedLeather2: "SUEDE",
      confidence: 100,
    }));
  });
});
