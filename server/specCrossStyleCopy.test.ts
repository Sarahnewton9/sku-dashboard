import { describe, expect, it } from "vitest";
import {
  buildCrossStyleComponentCopies,
  planCrossStyleComponentCopies,
  resolveCrossStyleSourceSpecs,
  selectCrossStyleCustomRowCopies,
} from "@shared/specCrossStyleCopy";
import { getTemplateForCategory } from "@shared/specTemplates";

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

  it("makes source-only style components visible as custom rows on a new target style", () => {
    const plan = planCrossStyleComponentCopies(
      "RAZZLE",
      ["TIGER PONY"],
      {
        upper_1: "TIGER PONY",
        lining: "BLACK SHEEP",
        roxie_leather_bow: "UPPER 1",
        roxie_grosgrain_topline: "MATCHING",
        roxie_toe_cap: "UPPER 1",
      },
      getTemplateForCategory("Dress Shoe", { style: "RAZZLE" }),
    );

    expect(plan.componentRows).toEqual(expect.arrayContaining([
      { style: "RAZZLE", colour: "TIGER PONY", component: "lining", value: "BLACK SHEEP" },
    ]));
    expect(plan.componentRows.some((row) => row.component.startsWith("roxie_"))).toBe(false);
    expect(plan.customRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Leather Bow", value: "UPPER 1" }),
      expect.objectContaining({ title: "Grosgrain Topline", value: "MATCHING" }),
      expect.objectContaining({ title: "Toe Cap", value: "UPPER 1" }),
    ]));
  });

  it("maps matching style-only labels to the target style's component key", () => {
    const plan = planCrossStyleComponentCopies(
      "ROBYN",
      ["BLACK PATENT"],
      { roxie_leather_bow: "MATCHING" },
      getTemplateForCategory("Dress Shoe", { style: "ROBYN" }),
    );

    expect(plan.componentRows).toEqual([
      { style: "ROBYN", colour: "BLACK PATENT", component: "robyn_leather_bow", value: "MATCHING" },
    ]);
    expect(plan.customRows).toEqual([]);
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
