import { describe, expect, it } from "vitest";
import {
  buildSavedSpecCopySnapshot,
  type SavedSpecCopyCustomRow,
  type SavedSpecCopySnapshotInput,
  type SavedSpecCopySpecRow,
} from "@shared/specCopySnapshot";
import { buildCrossStyleComponentCopies, planCrossStyleComponentCopies } from "@shared/specCrossStyleCopy";
import { getTemplateForCategory, type SpecComponent } from "@shared/specTemplates";

const template: SpecComponent[] = getTemplateForCategory("Wedge")
  .filter((component) => ["upper_1", "lining", "sock", "wedge_name", "wedge_cover"].includes(component.key));

function spec(id: number, component: string, value: string | null, colour = "PINK SATIN", updatedAt?: Date | string | number): SavedSpecCopySpecRow {
  return { id, component, value, colour, updatedAt };
}

function custom(id: number, title: string, value: string | null, colour = "__all__", overrides: Partial<SavedSpecCopyCustomRow> = {}): SavedSpecCopyCustomRow {
  return { id, title, value, colour, section: "components", sortOrder: id, ...overrides };
}

function snapshot(overrides: Partial<SavedSpecCopySnapshotInput> = {}) {
  return buildSavedSpecCopySnapshot({
    specRows: [], template, customRows: [], sourceColourLabel: "PINK SATIN", sourceRawColour: "PINK", ...overrides,
  });
}

describe("saved Specs copy snapshot", () => {
  it("includes visible template blanks, excludes Upper 1 and non-source-template inherited IDs", () => {
    const result = snapshot({ specRows: [spec(1, "upper_1", "PINK SATIN"), spec(2, "lining", "BLACK SHEEP"), spec(3, "roxie_leather_bow", "INHERITED"), spec(4, "unknown_old_field", "OLD")] });
    expect(result.components).toEqual({ lining: "BLACK SHEEP", sock: "", wedge_name: "", wedge_cover: "" });
    expect(result.customRows).toEqual([]);
    expect(result.sourceRows.map((row) => row.rowKey)).toEqual(["t:lining", "t:sock", "t:wedge_name", "t:wedge_cover"]);
  });

  it("excludes deleted source template rows even when populated or also listed as visible", () => {
    const result = snapshot({
      specRows: [spec(1, "lining", "OLD HIDDEN"), spec(2, "wedge_cover", "OLD HIDDEN COVER")],
      rowKeys: ["t:lining", "deleted:t:lining", "deleted:t:wedge_cover", "t:sock"],
    });
    expect(result.components).toEqual({ sock: "", wedge_name: "" });
    expect(result.sourceRows.map((row) => row.rowKey)).toEqual(["t:sock", "t:wedge_name"]);
  });

  it("resolves colour fallbacks separately per component only when a more-specific cell is absent", () => {
    const result = snapshot({ specRows: [
      spec(1, "lining", "FULL LABEL"), spec(2, "lining", "RAW OLD", "PINK"),
      spec(3, "sock", "RAW SOCK", "PINK"), spec(4, "wedge_name", "OTHER COLOUR", "BLUE SATIN"),
      spec(5, "wedge_cover", "SHARED TEMPLATE NOT A COLOUR", "__all__"),
    ] });
    expect(result.components).toEqual({ lining: "FULL LABEL", sock: "RAW SOCK", wedge_name: "", wedge_cover: "" });
  });

  it("keeps exact blank, null, whitespace and multiline saved values instead of stale fallbacks", () => {
    const result = snapshot({ specRows: [
      spec(1, "lining", ""), spec(2, "lining", "LEGACY LINING", "PINK"),
      spec(3, "sock", null), spec(4, "sock", "LEGACY SOCK", "PINK"),
      spec(5, "wedge_cover", "   "), spec(6, "wedge_name", "  Saved name\nwith spacing  "),
    ] });
    expect(result.components).toEqual({ lining: "", sock: "", wedge_name: "  Saved name\nwith spacing  ", wedge_cover: "   " });
  });

  it("selects latest duplicate values by updatedAt then id, not array order or truthiness", () => {
    const result = snapshot({ specRows: [
      spec(1, "lining", "LATEST SMALL ID", " pink   satin ", new Date("2026-11-10T02:00:00Z")),
      spec(99, "lining", "OLDER HIGH ID", "PINK SATIN", "2026-11-09T02:00:00Z"),
      spec(5, "sock", "", "PINK SATIN", 42), spec(3, "sock", "OLDER TIE", "PINK SATIN", 42),
      spec(8, "wedge_name", null), spec(2, "wedge_name", "OLDER NO TIMESTAMP"),
    ] });
    expect(result.components.lining).toBe("LATEST SMALL ID");
    expect(result.components.sock).toBe("");
    expect(result.components.wedge_name).toBe("");
  });

  it("supports full dual-upper/raw/short candidate keys without borrowing another source SKU", () => {
    const result = snapshot({
      sourceColourLabel: "PINK SATIN/BLACK MESH", sourceRawColour: "PINK SATIN/BLACK",
      specRows: [
        spec(1, "lining", "PINK FIRST UPPER", "PINK SATIN"),
        spec(2, "sock", "SHORT LEGACY", "PINK"),
        spec(3, "wedge_cover", "OTHER DUAL UPPER", "PINK SATIN/WHITE MESH"),
        spec(4, "wedge_name", "OTHER LEATHER", "PINK NAPPA"),
      ],
    });
    expect(result.components).toEqual({ lining: "PINK FIRST UPPER", sock: "SHORT LEGACY", wedge_name: "", wedge_cover: "" });
  });

  it("lets an exact blank/null custom SKU cell override legacy and shared values", () => {
    const result = snapshot({ customRows: [
      custom(1, "Wedge Cover", "SHARED OLD"), custom(2, "Wedge Cover", "LEGACY OLD", "PINK"), custom(3, "Wedge Cover", "", "PINK SATIN"),
      custom(4, "Wedge Name", "SHARED NAME"), custom(5, "Wedge Name", null, "PINK SATIN"),
      custom(6, "Binding", "SHARED BINDING"), custom(7, "Binding", "ANOTHER SKU", "BLUE SATIN"),
    ] });
    expect(result.customRows).toEqual([
      { section: "components", title: "Wedge Cover", value: "", sortOrder: 1 },
      { section: "components", title: "Wedge Name", value: "", sortOrder: 4 },
      { section: "components", title: "Binding", value: "SHARED BINDING", sortOrder: 6 },
    ]);
  });

  it("groups custom rows by section plus normalized title and uses the minimum member id stably", () => {
    const result = snapshot({ customRows: [
      custom(20, " WEDGE   COVER ", "EXACT", "PINK SATIN", { sortOrder: 8 }),
      custom(2, "Wedge Cover", "SHARED", "__all__", { sortOrder: 4 }),
      custom(4, "Wedge Cover", "HEEL SECTION", "__all__", { section: "heel", sortOrder: 3 }),
      custom(8, "  ", "NO TITLE"),
    ], rowKeys: ["c:20", "c:2", "c:4"] });
    expect(result.customRows).toEqual([
      { section: "components", title: "Wedge Cover", value: "EXACT", sortOrder: 4 },
      { section: "heel", title: "Wedge Cover", value: "HEEL SECTION", sortOrder: 3 },
    ]);
    expect(result.sourceRows.filter((row) => row.kind === "custom").map((row) => row.rowKey)).toEqual(["c:2", "c:4"]);
  });

  it("honours a tombstone on ANY custom group member, including another colour's member", () => {
    const result = snapshot({ customRows: [
      custom(2, "Wedge Cover", "CURRENT", "PINK SATIN"), custom(8, "WEDGE COVER", "OTHER", "BLUE SATIN"),
      custom(10, "Visible", "KEEP"),
    ], rowKeys: ["c:2", "deleted:c:8", "c:8", "deleted:c:404"] });
    expect(result.customRows).toEqual([{ section: "components", title: "Visible", value: "KEEP", sortOrder: 10 }]);
    expect(result.sourceRows.some((row) => row.rowKey === "c:2")).toBe(false);
  });

  it("chooses the newest duplicate custom cell within its group and colour, preserving exact values", () => {
    const result = snapshot({ customRows: [
      custom(2, "Binding", "  NEW\nVALUE  ", "PINK SATIN", { updatedAt: "2026-11-10T02:00:00Z" }),
      custom(30, "BINDING", "OLD", "PINK SATIN", { updatedAt: "2026-11-09T02:00:00Z" }),
      custom(1, "Binding", "SHARED NEWER", "__all__", { updatedAt: "2026-11-11T02:00:00Z" }),
      custom(5, "Wedge Cover", "OLD", "PINK SATIN", { updatedAt: 1 }),
      custom(8, "Wedge Cover", "", "PINK SATIN", { updatedAt: 1 }),
    ] });
    expect(result.customRows.map((row) => row.value)).toEqual(["  NEW\nVALUE  ", ""]);
  });

  it("keeps a visible custom row blank when it has values only for a different SKU", () => {
    const result = snapshot({ customRows: [custom(1, "Binding", "BLUE ONLY", "BLUE SATIN")] });
    expect(result.customRows).toEqual([{ section: "components", title: "Binding", value: "", sortOrder: 1 }]);
  });

  it("preserves saved interleaved order, appends true new rows, and ignores stale keys", () => {
    const result = snapshot({ customRows: [custom(2, "Binding", "MATCHING"), custom(7, "New Field", "NEW")],
      rowKeys: ["t:wedge_cover", "c:2", "t:lining", "t:wedge_cover", "t:old_inherited", "c:999", "deleted:t:sock"],
    });
    expect(result.sourceRows.map((row) => row.rowKey)).toEqual(["t:wedge_cover", "c:2", "t:lining", "t:wedge_name", "c:7"]);
    expect(Object.keys(result.components)).toEqual(["wedge_cover", "lining", "wedge_name"]);
    expect(result.customRows.map((row) => row.title)).toEqual(["Binding", "New Field"]);
  });

  it("accepts historical row-key spelling and keeps template defaults only when no tombstone exists", () => {
    const result = snapshot({ rowKeys: ["template:wedge_cover", "deleted:template:lining", "custom:2", "deleted:custom:9"],
      customRows: [custom(2, "Binding", "KEEP"), custom(9, "Old Field", "HIDE")],
    });
    expect(result.sourceRows.map((row) => row.rowKey)).toEqual(["t:wedge_cover", "c:2", "t:sock", "t:wedge_name"]);
    expect(snapshot({ rowKeys: [] }).components).toEqual(snapshot({ rowKeys: null }).components);
  });

  it("does not reincarnate inherited or hidden source keys in SOURCE_A -> SOURCE_B -> TARGET copies", () => {
    const sourceATemplate = getTemplateForCategory("Dress Shoe", { style: "ROXIE" });
    const a = snapshot({ template: sourceATemplate, specRows: [spec(1, "roxie_leather_bow", "A VALUE"), spec(2, "lining", "A LINING")] });
    const bTemplate = getTemplateForCategory("Dress Shoe", { style: "RAZZLE" });
    const aToB = planCrossStyleComponentCopies("RAZZLE", ["PINK SATIN"], a.components, bTemplate);
    const bCustom = aToB.customRows.map((row, index) => custom(100 + index, row.title, "LATEST B EDIT", "PINK SATIN", { section: row.section, sortOrder: row.sortOrder }));
    const b = snapshot({ template: bTemplate,
      specRows: [spec(1, "roxie_leather_bow", "STALE LEGACY A VALUE"), spec(2, "lining", "HIDDEN B LINING")],
      customRows: bCustom, rowKeys: ["deleted:t:lining", "c:100"],
    });
    expect(b.components).not.toHaveProperty("roxie_leather_bow");
    expect(b.components).not.toHaveProperty("lining");
    expect(b.customRows.find((row) => row.title === "Leather Bow")?.value).toBe("LATEST B EDIT");
    const bHidden = snapshot({ template: bTemplate, customRows: bCustom, rowKeys: ["deleted:c:100"] });
    expect(bHidden.customRows).toEqual([]);
    expect(planCrossStyleComponentCopies("TARGET", ["STONE"], b.components, getTemplateForCategory("Wedge")).customRows).toEqual([]);
  });

  it("copies Wedge Name and Wedge Cover unchanged to every selected target, never Upper 1", () => {
    const result = snapshot({ specRows: [spec(1, "upper_1", "PINK SATIN"), spec(2, "wedge_name", "SOURCE WEDGE"), spec(3, "wedge_cover", "UPPER 1")] });
    const copied = buildCrossStyleComponentCopies("TARGET", ["BLACK NAPPA", "STONE SUEDE"], result.components);
    expect(copied).toEqual([
      { style: "TARGET", colour: "BLACK NAPPA", component: "wedge_name", value: "SOURCE WEDGE" },
      { style: "TARGET", colour: "BLACK NAPPA", component: "wedge_cover", value: "UPPER 1" },
      { style: "TARGET", colour: "STONE SUEDE", component: "wedge_name", value: "SOURCE WEDGE" },
      { style: "TARGET", colour: "STONE SUEDE", component: "wedge_cover", value: "UPPER 1" },
    ]);
  });

  it("does not mutate source arrays, rows, template, or saved keys", () => {
    const specRows = Object.freeze([Object.freeze(spec(1, "lining", ""))]);
    const customRows = Object.freeze([Object.freeze(custom(2, "Binding", ""))]);
    const rowKeys = Object.freeze(["c:2", "t:lining"]);
    const frozenTemplate = Object.freeze(template.map((component) => Object.freeze({ ...component })));
    const result = snapshot({ specRows, customRows, rowKeys, template: frozenTemplate });
    expect(result.components.lining).toBe("");
    expect(result.customRows[0].value).toBe("");
    expect(rowKeys).toEqual(["c:2", "t:lining"]);
  });
});
