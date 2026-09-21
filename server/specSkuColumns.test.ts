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

  it("maps matching Upper 1 rows with distinct Upper 2 values to separate columns", () => {
    const allSkus = [
      { style: "EMILY", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
      { style: "EMILY", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
    ];
    const customSkus = [
      { id: 1, ...allSkus[0] },
      { id: 2, ...allSkus[1] },
    ];

    const columns = buildEditableCustomSkuColumns("EMILY", allSkus, customSkus);

    expect(columns["ECRU SNAKE/ROYAL SUEDE"]?.id).toBe(1);
    expect(columns["ECRU SNAKE/LIPSTICK SUEDE"]?.id).toBe(2);
  });
});
