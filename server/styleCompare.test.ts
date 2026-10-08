import { describe, expect, it } from "vitest";
import { getStyleComparisonOverlap, summariseStyleForComparison } from "../shared/styleCompare";

describe("style comparison helpers", () => {
  const mack = [
    { colour: "BLACK", leather: "NAPPA", is_new: true },
    { colour: "CLOUD", leather: "SUEDE", is_new: true },
    { colour: "BLACK", leather: "VINTAGE", colour2: "BLACK", leather2: "PATENT", is_new: true },
  ];
  const maddi = [
    { colour: "BLACK", leather: "NAPPA", is_new: false },
    { colour: "PETAL", leather: "NAPPA", is_new: false },
    { colour: "STONE", leather: "SUEDE", is_new: false },
  ];

  it("counts active physical SKUs while retaining secondary upper vocabulary", () => {
    expect(summariseStyleForComparison(mack)).toEqual({
      skuCount: 3,
      newSkuCount: 3,
      existingSkuCount: 0,
      materialLabels: ["NAPPA", "PATENT", "SUEDE", "VINTAGE"],
      colourLabels: ["BLACK", "CLOUD"],
    });
  });

  it("reports shared materials and colours without merging physical SKUs", () => {
    expect(getStyleComparisonOverlap(mack, maddi)).toEqual({
      sharedMaterialLabels: ["NAPPA", "SUEDE"],
      sharedColourLabels: ["BLACK"],
    });
  });
});
