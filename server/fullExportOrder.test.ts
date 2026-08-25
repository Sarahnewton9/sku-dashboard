import { describe, expect, it } from "vitest";
import {
  getSelectedFullExportColumns,
  sortFullExportRowsByStyle,
} from "@shared/fullExportOrder";

describe("Full Data Export ordering", () => {
  it("keeps Last first when it is selected", () => {
    const ordered = getSelectedFullExportColumns(
      ["Last", "Style", "Category", "Colour", "Leather"],
      new Set(["Last", "Style", "Colour", "Leather"]),
    );

    expect(ordered).toEqual(["Last", "Style", "Colour", "Leather"]);
  });

  it("sorts styles alphabetically and groups their colour rows together", () => {
    const rows = sortFullExportRowsByStyle([
      { Style: "ZOE", Colour: "BLACK", Leather: "NAPPA" },
      { Style: "ASTI", Colour: "TAUPE", Leather: "SUEDE" },
      { Style: "ASTI", Colour: "BLACK", Leather: "PATENT" },
    ]);

    expect(rows.map((row) => `${row.Style}|${row.Colour}`)).toEqual([
      "ASTI|BLACK",
      "ASTI|TAUPE",
      "ZOE|BLACK",
    ]);
  });
});
