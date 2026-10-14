import { describe, expect, it } from "vitest";
import { buildSpecSheetWorkbook } from "@/lib/exportSpecSheet";

const baseParams = {
  style: "RAZZLE",
  last: "ROXIE",
  category: "Dress Shoe",
  season: "Winter 27",
  colours: ["TIGER PONY"],
  colourLabels: ["TIGER PONY"],
  specs: {
    "TIGER PONY": {
      upper_1: "TIGER PONY",
      stitch: "MATCHING",
    },
  },
  rowKeys: ["t:upper_1", "t:stitch"],
};

describe("factory Comments on Specs exports", () => {
  it("places populated Comments in a yellow row between Season and Components", async () => {
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      comments: "VAMP HEIGHT TO BE THE SAME AS COMMA",
    });
    const sheet = workbook.getWorksheet("Sheet1");

    expect(sheet).toBeDefined();
    expect(sheet!.getCell("A6").value).toBe("SEASON:");
    expect(sheet!.getCell("B6").value).toBe("Winter 27");
    expect(sheet!.getCell("A7").value).toBe("COMMENTS :");
    expect(sheet!.getCell("B7").value).toBe("VAMP HEIGHT TO BE THE SAME AS COMMA");
    expect(sheet!.getCell("A7").fill.fgColor.argb).toBe("FFFFFF00");
    expect(sheet!.getCell("B7").fill.fgColor.argb).toBe("FFFFFF00");
    expect(sheet!.getCell("C7").fill.fgColor.argb).toBe("FFFFFF00");
    expect(sheet!.getCell("D7").fill.fgColor.argb).toBe("FFFFFF00");
    expect(sheet!.getCell("A8").value).toBe("COMPONENTS");
  });

  it("omits the Comments row entirely when there is no comment", async () => {
    const workbook = await buildSpecSheetWorkbook({ ...baseParams, comments: "   " });
    const sheet = workbook.getWorksheet("Sheet1");

    expect(sheet).toBeDefined();
    expect(sheet!.getCell("A7").value).toBe("COMPONENTS");
    expect(sheet!.getCell("A7").fill.fgColor.argb).toBe("FFD9D9D9");
    expect(sheet!.getCell("A7").value).not.toBe("COMMENTS :");
  });
});
