import { describe, expect, it } from "vitest";
import { getSkuCompositeIdentity } from "@shared/skuCompositeIdentity";

describe("composite SKU identity", () => {
  it("allows the same Upper 1 when Upper 2 is different", () => {
    const royal = getSkuCompositeIdentity("EMILY", "ECRU", "SNAKE", "ROYAL", "SUEDE");
    const lipstick = getSkuCompositeIdentity("EMILY", "ECRU", "SNAKE", "LIPSTICK", "SUEDE");

    expect(royal).not.toBe(lipstick);
  });

  it("treats empty and missing Upper 2 values as the same legacy single-upper SKU", () => {
    expect(getSkuCompositeIdentity("EMILY", "ECRU", "SNAKE"))
      .toBe(getSkuCompositeIdentity(" emily ", "ecru", "snake", "", null));
  });
});
