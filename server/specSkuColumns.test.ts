import { describe, expect, it } from "vitest";
import { buildEditableCustomSkuColumns } from "@shared/specSkuColumns";

describe("editable Specs SKU columns", () => {
  it("maps duplicate colour/leather combinations to their own editable columns", () => {
    const allSkus = [
      { style: "TAMMY", colour: "BLACK", leather: "NAPPA" },
      { style: "TAMMY", colour: "BLACK", leather: "MESH" },
      { style: "TAMMY", colour: "PETAL", leather: "MESH" },
    ];
    const customSkus = [
      { id: 1, style: "TAMMY", colour: "BLACK", leather: "NAPPA" },
      { id: 2, style: "TAMMY", colour: "BLACK", leather: "MESH" },
      { id: 3, style: "TAMMY", colour: "PETAL", leather: "MESH" },
    ];

    const columns = buildEditableCustomSkuColumns("TAMMY", allSkus, customSkus);

    expect(columns["BLACK NAPPA"]?.id).toBe(1);
    expect(columns["BLACK MESH"]?.id).toBe(2);
    expect(columns["PETAL"]?.id).toBe(3);
  });
});
