import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseSpecSheetFile } from "@/lib/importSpecSheet";

function makeFactorySpecFile(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new File([data], "factory-spec.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("factory Comments on Specs imports", () => {
  it("reads the highlighted COMMENTS label used by the factory workbook", async () => {
    const file = makeFactorySpecFile([
      ["Tony Bianco", "Product Specification Report"],
      ["LAST:", "ROXIE"],
      ["STYLE NAME:", "RAZZLE"],
      ["SEASON:", "Winter 27"],
      ["COMMENTS :", "VAMP HEIGHT TO BE THE SAME AS COMMA"],
      ["COMPONENTS", "COLOUR 1"],
      ["", "TIGER PONY"],
      ["UPPER 1", "TIGER PONY"],
    ]);

    const parsed = await parseSpecSheetFile(file);

    expect(parsed.comments).toBe("VAMP HEIGHT TO BE THE SAME AS COMMA");
    expect(parsed.styleName).toBe("RAZZLE");
    expect(parsed.colourSpecs["TIGER PONY"]?.upper_1).toBe("TIGER PONY");
  });
});
