import { describe, expect, it } from "vitest";
import { resolveStyleCategory } from "@shared/styleCategory";

describe("resolveStyleCategory", () => {
  it("keeps Dress Shoes as Dress Shoe when they carry descriptive trends", () => {
    expect(resolveStyleCategory({
      baseCategory: "Dress Shoe",
      trendFlag: "TOE CAP",
      trends: ["TOE CAP", "MESH", "SLINGBACK"],
    })).toBe("DRESS SHOE");

    expect(resolveStyleCategory({
      baseCategory: "Dress Shoe",
      trendFlag: "MESH",
      trends: '["MESH","BALLET"]',
    })).toBe("DRESS SHOE");
  });

  it("uses an explicit saved sub-category when one is present", () => {
    expect(resolveStyleCategory({
      baseCategory: "Ballet Flat",
      subCategory: "Dress Shoe",
      trendFlag: "BALLET",
    })).toBe("DRESS SHOE");
  });

  it("groups genuine ballet and loafer bases as Casual Flat", () => {
    expect(resolveStyleCategory({
      baseCategory: "Ballet Flat",
      trendFlag: "BALLET",
    })).toBe("CASUAL FLAT");

    expect(resolveStyleCategory({
      baseCategory: "Loafer",
      trendFlag: "LOAFER",
    })).toBe("CASUAL FLAT");
  });
});
