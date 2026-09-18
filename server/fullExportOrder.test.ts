import { describe, expect, it } from "vitest";
import {
  getSelectedFullExportColumns,
  sortFullExportRowsByStyle,
} from "@shared/fullExportOrder";

describe("Full Data Export ordering", () => {
  it("keeps Last first when it is selected", () => {
    const ordered = getSelectedFullExportColumns(
      ["Last", "Style", "Category", "Colour / Leather"],
      new Set(["Last", "Style", "Colour / Leather"]),
    );

    expect(ordered).toEqual(["Last", "Style", "Colour / Leather"]);
  });

  it("sorts styles alphabetically and groups their colour rows together", () => {
    const rows = sortFullExportRowsByStyle([
      { Style: "ZOE", "Colour / Leather": "BLACK NAPPA" },
      { Style: "ASTI", "Colour / Leather": "TAUPE SUEDE" },
      { Style: "ASTI", "Colour / Leather": "BLACK PATENT" },
    ]);

    expect(rows.map((row) => `${row.Style}|${row["Colour / Leather"]}`)).toEqual([
      "ASTI|BLACK PATENT",
      "ASTI|TAUPE SUEDE",
      "ZOE|BLACK NAPPA",
    ]);
  });
});
