import { describe, expect, it } from "vitest";
import { buildColourLeatherMaterialGroups } from "@shared/colourLeatherGroups";

describe("Colour Leather material groups", () => {
  it("includes DIMA under Cloud Snake when Cloud Snake is Upper 2", () => {
    const result = buildColourLeatherMaterialGroups([
      { style: "DIMA", colour: "CLOUD", leather: "SUEDE", colour2: "CLOUD", leather2: "SNAKE", isNew: true },
      { style: "KASSY", colour: "CLOUD", leather: "SNAKE", colour2: "CLOUD", leather2: "SUEDE", isNew: true },
      { style: "KISS", colour: "CLOUD", leather: "SNAKE", isNew: true },
      { style: "MISTY", colour: "CLOUD", leather: "SNAKE", isNew: true },
    ]);

    const cloudSnake = result.groups.find((group) => group.key === "CLOUD SNAKE");
    expect(cloudSnake).toMatchObject({ totalCount: 4, newCount: 4 });
    expect(cloudSnake?.skus.map((sku) => [sku.style, sku.upperRole])).toEqual([
      ["DIMA", "Upper 2"],
      ["KASSY", "Upper 1"],
      ["KISS", "Upper 1"],
      ["MISTY", "Upper 1"],
    ]);
  });

  it("retains a dual-upper SKU once when both uppers use the same material", () => {
    const result = buildColourLeatherMaterialGroups([
      { style: "TEST", colour: "BLACK", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA", isNew: false },
    ]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ key: "BLACK NAPPA", totalCount: 1 });
    expect(result.groups[0]?.skus[0]?.upperRole).toBe("Upper 1 + Upper 2");
    expect(result).toMatchObject({ totalSkus: 1, newSkus: 0, existingSkus: 1 });
  });

  it("keeps each unique physical SKU separately when a material is shared", () => {
    const result = buildColourLeatherMaterialGroups([
      { style: "DIMA", colour: "CLOUD", leather: "SUEDE", colour2: "CLOUD", leather2: "SNAKE", isNew: true },
      { style: "DIMA", colour: "VINO", leather: "SUEDE", colour2: "CLOUD", leather2: "SNAKE", isNew: true },
    ]);

    const cloudSnake = result.groups.find((group) => group.key === "CLOUD SNAKE");
    expect(cloudSnake?.totalCount).toBe(2);
    expect(new Set(cloudSnake?.skus.map((sku) => sku.identity)).size).toBe(2);
  });
});
