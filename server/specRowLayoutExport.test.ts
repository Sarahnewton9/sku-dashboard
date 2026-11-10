import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildSpecSheetWorkbook, type CustomSpecRow, type ExportSpecSheetParams } from "@/lib/exportSpecSheet";
import {
  getCustomSpecRowAliases,
  getOrderedSpecRowKeys,
  groupSpecCustomRows,
  hideSpecRow,
  mergeSpecRowOrder,
  normalizeSpecRowLayout,
} from "../shared/specRowLayout";
import { getTemplateForCategory } from "../shared/specTemplates";

const baseParams: ExportSpecSheetParams = {
  style: "RAZZLE",
  last: "ROXIE",
  category: "Dress Shoe",
  season: "Winter 27",
  colours: ["BLACK", "PETAL"],
  colourLabels: ["BLACK SPECKLE", "PETAL NAPPA"],
  specs: {
    "BLACK SPECKLE": { upper_1: "BLACK SPECKLE", stitch: "MATCHING", lining: "BLACK LEATHER" },
    "PETAL NAPPA": { upper_1: "PETAL NAPPA", stitch: "CONTRAST", lining: "MATCHING SHEEP" },
  },
};

function customRow(id: number, overrides: Partial<CustomSpecRow> = {}): CustomSpecRow {
  return {
    id,
    style: baseParams.style,
    section: "components",
    title: "Custom Finish",
    colour: "BLACK SPECKLE",
    value: "BLACK FINISH",
    sortOrder: 0,
    ...overrides,
  };
}

function componentRows(workbook: ExcelJS.Workbook): string[][] {
  const sheet = workbook.getWorksheet("Sheet1")!;
  const rows: string[][] = [];
  let inComponents = false;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === "COMPONENTS") {
      inComponents = true;
      return;
    }
    if (inComponents && row.getCell(1).value !== null) {
      rows.push([1, 2, 3].map((column) => String(row.getCell(column).value ?? "")));
    }
  });
  return rows;
}

function labels(workbook: ExcelJS.Workbook): string[] {
  return componentRows(workbook).map((row) => row[0]);
}

describe("factory exports use the shared Specs row layout", () => {
  it.each([
    ["t:upper_1", "t:stitch", "deleted:t:stitch", "t:lining"],
    ["deleted:t:stitch", "t:upper_1", "t:stitch", "t:lining"],
  ])("omits a populated deleted template even when its active key is duplicated (%j)", async (...rowKeys) => {
    const workbook = await buildSpecSheetWorkbook({ ...baseParams, rowKeys });
    expect(componentRows(workbook)).toEqual([
      ["UPPER 1", "BLACK SPECKLE", "PETAL NAPPA"],
      ["LINING", "BLACK LEATHER", "MATCHING SHEEP"],
    ]);
    // Exporting must not erase the saved values or mutate the supplied order.
    expect(baseParams.specs["BLACK SPECKLE"].stitch).toBe("MATCHING");
    expect(rowKeys).toContain("deleted:t:stitch");
  });

  it.each([
    ["c:10", "deleted:c:12"],
    ["deleted:c:12", "c:12", "c:10"],
  ])("hides the whole custom group when any member ID is deleted (%j)", async (...rowKeys) => {
    const customRows = [
      customRow(12, { colour: "PETAL NAPPA", value: "PETAL FINISH", title: " custom   finish " }),
      customRow(10),
    ];
    const workbook = await buildSpecSheetWorkbook({ ...baseParams, customRows, rowKeys });
    expect(labels(workbook)).toEqual(["UPPER 1", "STITCH", "LINING"]);
    expect(customRows.map((row) => row.value)).toEqual(["PETAL FINISH", "BLACK FINISH"]);
  });

  it("retains template and custom deletion markers after merging a dragged visible order", async () => {
    const customRows = [customRow(10), customRow(12, { colour: "PETAL NAPPA", value: "PETAL FINISH" })];
    const aliases = getCustomSpecRowAliases(groupSpecCustomRows(customRows));
    const deleted = normalizeSpecRowLayout(
      ["t:upper_1", "t:stitch", "deleted:t:stitch", "c:10", "deleted:c:12", "t:lining"],
      aliases,
    );
    const dragged = mergeSpecRowOrder(["t:lining", "t:upper_1"], deleted);
    expect(dragged).toContain("deleted:t:stitch");
    expect(dragged).toContain("deleted:c:10");
    const rowKeys = JSON.parse(JSON.stringify(dragged));
    const workbook = await buildSpecSheetWorkbook({ ...baseParams, customRows, rowKeys });
    expect(labels(workbook)).toEqual(["UPPER 1", "LINING"]);
  });

  it("keeps equal normalized titles in different sections as separate rows with separate values", async () => {
    const customRows = [
      customRow(22, { section: "packaging", title: " custom   finish ", colour: "PETAL NAPPA", value: "PETAL BOX" }),
      customRow(12, { title: " custom   finish ", colour: "PETAL NAPPA", value: "PETAL FINISH" }),
      customRow(20, { section: "packaging", value: "BLACK BOX" }),
      customRow(10),
    ];
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      customRows,
      rowKeys: ["t:upper_1", "c:22", "c:12", "deleted:t:stitch", "deleted:t:lining"],
    });
    expect(componentRows(workbook)).toEqual([
      ["UPPER 1", "BLACK SPECKLE", "PETAL NAPPA"],
      ["CUSTOM FINISH", "BLACK BOX", "PETAL BOX"],
      ["CUSTOM FINISH", "BLACK FINISH", "PETAL FINISH"],
    ]);

    const hidden = await buildSpecSheetWorkbook({
      ...baseParams,
      customRows,
      rowKeys: ["deleted:c:12", "deleted:t:stitch", "deleted:t:lining"],
    });
    expect(componentRows(hidden)).toEqual([
      ["UPPER 1", "BLACK SPECKLE", "PETAL NAPPA"],
      ["CUSTOM FINISH", "BLACK BOX", "PETAL BOX"],
    ]);
  });

  it("does not combine separate unnamed placeholders", async () => {
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      customRows: [customRow(10, { title: "", value: "FIRST" }), customRow(12, { title: "", value: "SECOND" })],
      rowKeys: ["c:12", "c:10", "deleted:t:stitch", "deleted:t:lining"],
    });
    expect(componentRows(workbook)).toEqual([
      ["UPPER 1", "BLACK SPECKLE", "PETAL NAPPA"],
      ["", "SECOND", ""],
      ["", "FIRST", ""],
    ]);
  });

  it("matches visible grid ordering, resolves member aliases, deduplicates and appends new rows", async () => {
    const customRows = [
      customRow(42, { title: "Later", colour: "PETAL NAPPA", value: "PETAL LATER", sortOrder: 20 }),
      customRow(40, { title: "Later", value: "BLACK LATER", sortOrder: 20 }),
      customRow(30, { title: "New Row", value: "NEW", sortOrder: 5 }),
    ];
    const specs = {
      "BLACK SPECKLE": { ...baseParams.specs["BLACK SPECKLE"], zip: "SILVER", shoe_box: "WHITE BOX" },
      "PETAL NAPPA": { ...baseParams.specs["PETAL NAPPA"], zip: "GOLD", shoe_box: "WHITE BOX" },
    };
    const rowKeys = ["c:42", "t:lining", "t:upper_1", "c:40", "t:shoe_box", "deleted:t:stitch"];
    const groups = groupSpecCustomRows(customRows);
    const template = getTemplateForCategory(baseParams.category, { style: baseParams.style });
    const available = [...template.map((row) => `t:${row.key}`), ...groups.map((group) => `c:${group.rep.id}`)];
    const gridKeys = getOrderedSpecRowKeys(available, rowKeys, getCustomSpecRowAliases(groups));
    const gridLabels = gridKeys.flatMap((key) => {
      const component = template.find((row) => `t:${row.key}` === key);
      if (component) {
        return Object.values(specs).some((values) => values[component.key as keyof typeof values]?.trim())
          ? [component.label.toUpperCase()] : [];
      }
      return [groups.find((group) => `c:${group.rep.id}` === key)!.rep.title.toUpperCase()];
    });
    const workbook = await buildSpecSheetWorkbook({ ...baseParams, specs, customRows, rowKeys });
    expect(labels(workbook)).toEqual(gridLabels);
    expect(labels(workbook)).toEqual(["UPPER 1", "LATER", "LINING", "SHOE BOX", "ZIP", "NEW ROW"]);
  });

  it("appends a newly available template row absent from an old saved order unless explicitly deleted", async () => {
    const params = {
      ...baseParams,
      hasBuckle: true,
      specs: {
        "BLACK SPECKLE": { ...baseParams.specs["BLACK SPECKLE"], buckle: "SILVER" },
        "PETAL NAPPA": { ...baseParams.specs["PETAL NAPPA"], buckle: "GOLD" },
      },
      rowKeys: ["t:upper_1", "t:lining", "t:stitch"],
    };
    const workbook = await buildSpecSheetWorkbook(params);
    expect(labels(workbook)).toEqual(["UPPER 1", "LINING", "STITCH", "BUCKLE"]);
    const hidden = await buildSpecSheetWorkbook({ ...params, rowKeys: hideSpecRow(params.rowKeys, "t:buckle") });
    expect(labels(hidden)).toEqual(["UPPER 1", "LINING", "STITCH"]);
  });

  it("pins Upper 1 even when it is blank, moved, duplicated or tombstoned", async () => {
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      specs: { "BLACK SPECKLE": { upper_1: "", stitch: "MATCHING" }, "PETAL NAPPA": { stitch: "CONTRAST" } },
      rowKeys: ["t:stitch", "deleted:t:upper_1", "t:upper_1", "deleted:t:lining"],
    });
    expect(componentRows(workbook)).toEqual([
      ["UPPER 1", "", ""],
      ["STITCH", "MATCHING", "CONTRAST"],
    ]);
  });

  it("uses template order followed by custom sort order when there is no saved layout", async () => {
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      customRows: [
        customRow(10, { title: "Later", section: "components", sortOrder: 20 }),
        customRow(30, { title: "Earlier", section: "upper", sortOrder: 5 }),
      ],
    });
    expect(labels(workbook)).toEqual(["UPPER 1", "STITCH", "LINING", "EARLIER", "LATER"]);
  });

  it.each([
    { name: "raw", rows: [customRow(12, { colour: "BLACK", value: "STALE RAW" })] },
    { name: "shared", rows: [customRow(12, { colour: "__all__", value: "STALE SHARED" })] },
    { name: "raw and shared", rows: [customRow(12, { colour: "BLACK", value: "STALE RAW" }), customRow(14, { colour: "__all__", value: "STALE SHARED" })] },
  ])("does not replace an exact blank custom cell with a $name fallback", async ({ rows }) => {
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      customRows: [customRow(10, { value: "" }), ...rows, customRow(16, { colour: "PETAL NAPPA", value: "VISIBLE PETAL" })],
      rowKeys: ["c:10", "deleted:t:stitch", "deleted:t:lining"],
    });
    expect(componentRows(workbook)).toEqual([
      ["UPPER 1", "BLACK SPECKLE", "PETAL NAPPA"],
      ["CUSTOM FINISH", "", "VISIBLE PETAL"],
    ]);
  });

  it("preserves the full Upper 2 column keys and their independent template and custom values", async () => {
    const colours = ["ECRU SNAKE/ROYAL SUEDE", "ECRU SNAKE/LIPSTICK SUEDE"];
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      colours: ["ECRU", "ECRU"],
      colourLabels: colours,
      specs: {
        [colours[0]]: { upper_1: colours[0], stitch: "ROYAL THREAD" },
        [colours[1]]: { upper_1: colours[1], stitch: "LIPSTICK THREAD" },
      },
      customRows: [
        customRow(10, { colour: colours[0], value: "" }),
        customRow(12, { colour: colours[1], value: "LIPSTICK FINISH" }),
        customRow(14, { colour: "ECRU SNAKE", value: "STALE PRIMARY" }),
        customRow(16, { colour: "__all__", value: "STALE SHARED" }),
      ],
      rowKeys: ["t:stitch", "c:12", "t:upper_1"],
    });
    expect(componentRows(workbook)).toEqual([
      ["UPPER 1", colours[0], colours[1]],
      ["STITCH", "ROYAL THREAD", "LIPSTICK THREAD"],
      ["CUSTOM FINISH", "", "LIPSTICK FINISH"],
    ]);
    expect(workbook.getWorksheet("Sheet1")!.getCell("B8").value).toBe(colours[0]);
    expect(workbook.getWorksheet("Sheet1")!.getCell("C8").value).toBe(colours[1]);
  });

  it("round-trips metadata, yellow Comments, Arial styling and stacked seven-colour blocks", async () => {
    const colours = Array.from({ length: 8 }, (_, index) => `COLOUR-${index + 1}`);
    const workbook = await buildSpecSheetWorkbook({
      ...baseParams,
      colours,
      colourLabels: colours,
      specs: Object.fromEntries(colours.map((colour) => [colour, { upper_1: colour, stitch: `THREAD ${colour}` }])),
      comments: " KEEP ORIGINAL FACTORY NOTES\nSECOND LINE ",
      customRows: [customRow(10, { colour: "__all__", value: "SHARED VALUE\nSECOND LINE" })],
      rowKeys: ["c:10", "t:stitch", "deleted:t:lining"],
    });
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = loaded.getWorksheet("Sheet1")!;
    expect(loaded.creator).toBe("Tony Bianco SKU Dashboard");
    expect(loaded.created).toBeInstanceOf(Date);
    expect(sheet.getCell("A1").value).toBe("Tony Bianco");
    expect(sheet.getCell("B3").value).toBe("ROXIE");
    expect(sheet.getCell("B4").value).toBe("RAZZLE");
    expect(sheet.getCell("B5").value).toBe("Tony Bianco");
    expect(sheet.getCell("B6").value).toBe("Winter 27");
    expect(sheet.getCell("A7").value).toBe("COMMENTS :");
    expect(sheet.getCell("B7").value).toBe("KEEP ORIGINAL FACTORY NOTES\nSECOND LINE");
    expect(sheet.getCell("B7").fill).toMatchObject({ fgColor: { argb: "FFFFFF00" } });
    expect(sheet.getCell("D7").fill).toMatchObject({ fgColor: { argb: "FFFFFF00" } });
    expect(sheet.getCell("A8").value).toBe("COMPONENTS");
    expect(sheet.getCell("H8").value).toBe("COLOUR 7");
    expect(sheet.getCell("B11").value).toBe("SHARED VALUE\nSECOND LINE");
    expect(sheet.getCell("B14").value).toBe("COLOUR 8");
    expect(labels(loaded)).toEqual(["UPPER 1", "CUSTOM FINISH", "STITCH", "UPPER 1", "CUSTOM FINISH", "STITCH"]);
    expect(sheet.getCell("A10").font).toMatchObject({ name: "Arial", size: 8, bold: true });
    expect(sheet.getCell("B10").font).toMatchObject({ name: "Arial", size: 8 });
    expect(sheet.getCell("B10").font.bold).not.toBe(true);
    expect(sheet.getColumn(1).width).toBe(22);
    expect(sheet.getColumn(2).width).toBe(19);
    expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 });
    expect(sheet.getImages()).toHaveLength(0);
  });
});
