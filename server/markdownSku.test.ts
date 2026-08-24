import { describe, expect, it } from "vitest";
import { buildMarkdownSkuSet, isMarkdownSku } from "@shared/markdownSku";

describe("markdown SKU exclusions", () => {
  it("hides a listed SKU regardless of letter case", () => {
    const set = buildMarkdownSkuSet([
      { styleCode: "ALYX", colour: "ESPRESSO SUEDE", status: "deleted" },
    ]);

    expect(isMarkdownSku(set, "alyx", "espresso", "suede")).toBe(true);
    expect(isMarkdownSku(set, "ALYX", "BLACK", "COMO")).toBe(false);
  });

  it("maps a slash-suffixed website material to the primary dashboard SKU", () => {
    const set = buildMarkdownSkuSet([
      { styleCode: "GLACIER", colour: "BLACK VINTAGE/SHEARLING", status: "deleted" },
    ]);

    expect(isMarkdownSku(set, "GLACIER", "BLACK", "VINTAGE")).toBe(true);
  });

  it("hides pending markdown records before they are confirmed for deletion", () => {
    const set = buildMarkdownSkuSet([
      { styleCode: "TAMMY", colour: "BLACK MESH", status: "pending" },
    ]);

    expect(isMarkdownSku(set, "TAMMY", "BLACK", "MESH")).toBe(true);
  });

  it("keeps restored markdown records visible", () => {
    const set = buildMarkdownSkuSet([
      { styleCode: "CITY", colour: "BLACK NAPPA", status: "restored" },
    ]);

    expect(isMarkdownSku(set, "CITY", "BLACK", "NAPPA")).toBe(false);
  });
});
