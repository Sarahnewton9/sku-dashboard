import { describe, expect, it } from "vitest";
import { formatBuyShare, getBuyShare } from "@shared/buyShare";

describe("buy share calculations", () => {
  it("returns a proportion of the selected buy", () => {
    expect(getBuyShare(250, 1_000)).toBe(25);
    expect(formatBuyShare(75, 300)).toBe("25.0%");
  });

  it("returns 0% when the total buy has no units", () => {
    expect(getBuyShare(0, 0)).toBe(0);
    expect(formatBuyShare(12, 0)).toBe("0.0%");
  });
});
