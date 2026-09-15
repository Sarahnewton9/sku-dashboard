import { describe, expect, it } from "vitest";
import { summarizeCustomStyleSkus } from "@shared/customStyleSummary";

describe("summarizeCustomStyleSkus", () => {
  it("keeps a zero-colour custom style as a valid empty style summary", () => {
    expect(summarizeCustomStyleSkus([])).toEqual({
      colours: [],
      leathers: [],
      totalSKUs: 0,
      newSKUs: 0,
      existingSKUs: 0,
      hasNew: false,
      isAllNew: false,
    });
  });

  it("summarizes populated styles without duplicating colour or leather labels", () => {
    expect(summarizeCustomStyleSkus([
      { colour: "BLACK", leather: "SUEDE", is_new: true },
      { colour: "BLACK", leather: "SUEDE", is_new: false },
      { colour: "WHITE", leather: "", is_new: false },
    ])).toMatchObject({
      colours: ["BLACK", "WHITE"],
      leathers: ["SUEDE"],
      totalSKUs: 3,
      newSKUs: 1,
      existingSKUs: 2,
      hasNew: true,
      isAllNew: false,
    });
  });
});
