import { describe, expect, it } from "vitest";
import { dedupeSkusByCompositeIdentity } from "@shared/dedupeSkus";

describe("dedupeSkusByCompositeIdentity", () => {
  it("removes only an exact duplicate and retains the first row", () => {
    const rows = dedupeSkusByCompositeIdentity([
      { style: "CITY", colour: "BLACK", leather: "NAPPA", source: "first" },
      { style: "CITY", colour: "BLACK", leather: "NAPPA", source: "duplicate" },
      { style: "CITY", colour: "DOVE", leather: "NAPPA", source: "distinct" },
    ]);

    expect(rows).toEqual([
      { style: "CITY", colour: "BLACK", leather: "NAPPA", source: "first" },
      { style: "CITY", colour: "DOVE", leather: "NAPPA", source: "distinct" },
    ]);
  });

  it("retains two physical SKUs when their Upper 2 constructions differ", () => {
    const rows = dedupeSkusByCompositeIdentity([
      { style: "EMILY", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
      { style: "EMILY", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
      { style: "EMILY", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.colour2)).toEqual(["ROYAL", "LIPSTICK"]);
  });
});
