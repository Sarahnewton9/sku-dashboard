import { describe, expect, it } from "vitest";
import { parseFobCostGrid, parseFobUsd } from "../shared/fobCostImport";

describe("factory FOB cost import", () => {
  it.each([
    [40, 40],
    ["US$34.50", 34.5],
    ["$USD40", 40],
    ["USD 40", 40],
    ["US$ 1,234.50", 1234.5],
    ["", null],
    ["TBC", null],
    ["-40", null],
    [0, null],
  ])("normalises %p to %p USD", (value, expected) => {
    expect(parseFobUsd(value)).toBe(expected);
  });

  it("reads the full factory list layout supplied by the factory", () => {
    const result = parseFobCostGrid([
      ["LAST", "STYLE", "COLOUR", "LEATHER", "$USD"],
      ["ANJA", "ALYX", "BLACK", "COMO", "US$34.50"],
      ["ANJA", "AMAR", "ESPRESSO", "SUEDE", "$USD40"],
      ["", "", "", "", ""],
    ]);

    expect(result.format).toBe("factory_list");
    expect(result.formatError).toBeUndefined();
    expect(result.rows).toEqual([
      { style: "ALYX", colour: "BLACK", leather: "COMO", colour2: "", leather2: "", cost: 34.5, sourceRow: 2 },
      { style: "AMAR", colour: "ESPRESSO", leather: "SUEDE", colour2: "", leather2: "", cost: 40, sourceRow: 3 },
    ]);
  });

  it("splits the factory's slash-formatted dual-upper rows into the physical SKU identity", () => {
    const result = parseFobCostGrid([
      ["LAST", "STYLE", "COLOUR", "LEATHER", "$USD"],
      ["CHEEKY/CUBA", "CAPPA", "DOVE / BLACK", "NAPPA / NAPPA", 23.5],
      ["ESSA", "DIMA", "ESPRESSO / CHOC", "SNAKE / NAPPA", "$USD32.50"],
    ]);

    expect(result.rows).toEqual([
      { style: "CAPPA", colour: "DOVE", leather: "NAPPA", colour2: "BLACK", leather2: "NAPPA", cost: 23.5, sourceRow: 2 },
      { style: "DIMA", colour: "ESPRESSO", leather: "SNAKE", colour2: "CHOC", leather2: "NAPPA", cost: 32.5, sourceRow: 3 },
    ]);
  });

  it("keeps the compact SKU Dash request format compatible", () => {
    const result = parseFobCostGrid([
      ["LAST", "STYLE", "COLOUR", "FOB COST"],
      ["ROBYN", "ROBYN", "ECRU SNAKE/ROYAL SUEDE", "USD 49.20"],
    ]);

    expect(result.format).toBe("fob_request");
    expect(result.rows[0]).toMatchObject({
      style: "ROBYN",
      colour: "ECRU SNAKE/ROYAL SUEDE",
      leather: "",
      cost: 49.2,
    });
  });
});
