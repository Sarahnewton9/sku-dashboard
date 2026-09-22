import { describe, expect, it } from "vitest";
import {
  buildCrossStyleComponentCopies,
  resolveCrossStyleSourceSpecs,
  selectCrossStyleCustomRowCopies,
} from "@shared/specCrossStyleCopy";

describe("cross-style Specs copying", () => {
  const sourceSpecs = {
    "PINK SATIN": {
      upper_1: "PINK SATIN",
      bow: "MATCHING ELASTIC",
      wedge_name: "SOURCE WEDGE",
      wedge_cover: "UPPER 1",
      lining: "NONE",
    },
  };

  it("resolves a full stored source label from any source SKU's raw colour", () => {
    expect(resolveCrossStyleSourceSpecs(sourceSpecs, "PINK SATIN", "PINK")).toEqual(
      sourceSpecs["PINK SATIN"],
    );
  });

  it("copies every component to selected target SKU labels except Upper 1", () => {
    const sourceValues = resolveCrossStyleSourceSpecs(sourceSpecs, "PINK SATIN", "PINK");
    const rows = buildCrossStyleComponentCopies("TARGET STYLE", ["BLACK SUEDE", "STONE SUEDE"], sourceValues);

    expect(rows).toEqual(expect.arrayContaining([
      { style: "TARGET STYLE", colour: "BLACK SUEDE", component: "bow", value: "MATCHING ELASTIC" },
      { style: "TARGET STYLE", colour: "STONE SUEDE", component: "wedge_name", value: "SOURCE WEDGE" },
      { style: "TARGET STYLE", colour: "STONE SUEDE", component: "wedge_cover", value: "UPPER 1" },
    ]));
    expect(rows.some((row) => row.component === "upper_1")).toBe(false);
  });

  it("prefers the selected source SKU's custom row over a shared custom row", () => {
    const rows = selectCrossStyleCustomRowCopies([
      { colour: "__all__", section: "components", title: "Wedge Cover", value: "SHARED", sortOrder: 2 },
      { colour: "PINK SATIN", section: "components", title: "Wedge Cover", value: "UPPER 1", sortOrder: 2 },
      { colour: "__all__", section: "components", title: "Binding", value: "MATCHING", sortOrder: 3 },
      { colour: "BLUE SATIN", section: "components", title: "Binding", value: "CONTRAST", sortOrder: 3 },
    ], "PINK SATIN", "PINK");

    expect(rows).toEqual([
      { section: "components", title: "Wedge Cover", value: "UPPER 1", sortOrder: 2 },
      { section: "components", title: "Binding", value: "MATCHING", sortOrder: 3 },
    ]);
  });
});
