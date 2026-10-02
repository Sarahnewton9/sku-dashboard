import { describe, expect, it } from "vitest";
import {
  buildAp21SkuColourDescriptionMap,
  resolveAp21SkuColourDescription,
} from "@shared/ap21SkuColourDescription";

describe("approved AP21 SKU colour descriptions", () => {
  const descriptions = buildAp21SkuColourDescriptionMap([
    {
      style: "ROBYN",
      colour: "ECRU",
      leather: "SNAKE",
      colour2: "LIPSTICK",
      leather2: "SUEDE",
      ap21ColourDescription: "Ecru Snake/Lipstick",
    },
    {
      style: "ROBYN",
      colour: "ECRU",
      leather: "SNAKE",
      colour2: "ROYAL",
      leather2: "SUEDE",
      ap21ColourDescription: "Ecru Snake/Royal",
    },
  ]);

  it("resolves the approved wording for the exact dual-upper SKU", () => {
    expect(resolveAp21SkuColourDescription(
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
      "ECRU SNAKE/LIPSTICK SUEDE",
      descriptions,
    )).toBe("Ecru Snake/Lipstick");
  });

  it("does not confuse colourways that share an Upper 1", () => {
    expect(resolveAp21SkuColourDescription(
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
      "ECRU SNAKE/ROYAL SUEDE",
      descriptions,
    )).toBe("Ecru Snake/Royal");
  });

  it("falls back safely until a SKU has an approved AP21 description", () => {
    expect(resolveAp21SkuColourDescription(
      { style: "NEW STYLE", colour: "BLACK", leather: "NAPPA" },
      "BLACK NAPPA",
      descriptions,
    )).toBe("Black Nappa");
  });
});
