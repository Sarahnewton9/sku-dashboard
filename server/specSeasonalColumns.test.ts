import { describe, expect, it } from "vitest";
import { buildNewSpecColourColumns } from "@shared/specSeasonalColumns";

describe("live Specs seasonal columns", () => {
  it("includes new By Style colourways using their distinct Specs keys", () => {
    const columns = buildNewSpecColourColumns([
      { style: "COMMA", colour: "RED", leather: "NAPPA", is_new: false },
      { style: "COMMA", colour: "VINO", leather: "NAPPA", is_new: false },
      { style: "COMMA", colour: "RED", leather: "SUEDE", is_new: true },
      { style: "COMMA", colour: "VINO", leather: "SUEDE", is_new: true },
    ]);

    expect(columns.COMMA).toEqual(["RED SUEDE", "VINO SUEDE"]);
  });

  it("keeps a new unique colour as a valid Specs column", () => {
    const columns = buildNewSpecColourColumns([
      { style: "DEVYN", colour: "CLOUD", leather: "NAPPA", isNew: true },
    ]);

    expect(columns.DEVYN).toEqual(["CLOUD"]);
  });
});
