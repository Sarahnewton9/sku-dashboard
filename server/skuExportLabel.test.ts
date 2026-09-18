import { describe, expect, it } from "vitest";
import {
  formatSkuExportLabel,
  getSkuExportFields,
  toTitleCaseSkuExportLabel,
} from "@shared/skuExportLabel";

describe("SKU export upper labels", () => {
  it("keeps each dual-upper pair together with a compact slash", () => {
    expect(formatSkuExportLabel({
      style: "EMILY",
      colour: "BLACK",
      leather: "VINTAGE",
      colour2: "BLACK",
      leather2: "SUEDE",
    })).toBe("BLACK VINTAGE/BLACK SUEDE");
  });

  it("does not split a dual upper across Full Data Export colour and leather fields", () => {
    expect(getSkuExportFields({
      style: "EMILY",
      colour: "VANILLA",
      leather: "VINTAGE",
      colour2: "STONE",
      leather2: "SUEDE",
    })).toMatchObject({
      colour: "VANILLA VINTAGE/STONE SUEDE",
      leather: "",
      colourLeather: "VANILLA VINTAGE/STONE SUEDE",
      isDualUpper: true,
    });
  });

  it("keeps a single upper in the legacy Colour and Leather fields", () => {
    expect(getSkuExportFields({ colour: "BLACK", leather: "NAPPA" })).toMatchObject({
      colour: "BLACK",
      leather: "NAPPA",
      colourLeather: "BLACK NAPPA",
      isDualUpper: false,
    });
  });

  it("title-cases compact dual-upper labels without adding slash spaces", () => {
    expect(toTitleCaseSkuExportLabel("BLACK VINTAGE/BLACK SUEDE"))
      .toBe("Black Vintage/Black Suede");
  });
});
