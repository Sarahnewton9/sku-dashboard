import { describe, expect, it } from "vitest";
import { getHandbagSkuEditOutcome } from "@shared/handbagSkuEdit";

describe("handbag SKU duplicate resolution", () => {
  it("keeps an existing target SKU when a correction would create a duplicate", () => {
    expect(getHandbagSkuEditOutcome(true)).toBe("duplicate_cancelled");
  });

  it("updates the source SKU directly when the corrected colour is unique", () => {
    expect(getHandbagSkuEditOutcome(false)).toBe("updated");
  });
});
