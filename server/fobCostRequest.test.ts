import { describe, expect, it } from "vitest";
import {
  formatFobRequestColour,
  getFobCostRequestFilename,
  isFobCostRequestEligible,
  resolveFobRequestSku,
} from "../shared/fobCostRequest";

describe("FOB cost request eligibility", () => {
  it("includes a received new-season SKU when FOB is missing", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "received",
      currentFobUsd: null,
    })).toBe(true);
  });

  it("drops the SKU from the rolling request immediately after an FOB import", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "received",
      currentFobUsd: 31.5,
    })).toBe(false);
  });

  it("includes fitting samples and excludes carry-over or waiting SKUs", () => {
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "fitting_sample",
      currentFobUsd: null,
    })).toBe(true);
    expect(isFobCostRequestEligible({
      isNewSeasonSku: false,
      sampleStatus: "received",
      currentFobUsd: null,
    })).toBe(false);
    expect(isFobCostRequestEligible({
      isNewSeasonSku: true,
      sampleStatus: "waiting",
      currentFobUsd: null,
    })).toBe(false);
  });
});

describe("FOB request workbook template", () => {
  it("uses the all-caps factory wording and compact Sydney date-stamped filename", () => {
    expect(formatFobRequestColour({ style: "EMILY", colour: "RED", leather: "CROCO" })).toBe("RED CROCO");
    expect(formatFobRequestColour({ style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" })).toBe("ECRU SNAKE/ROYAL SUEDE");
    expect(getFobCostRequestFilename(new Date("2026-10-06T14:00:00.000Z"))).toBe("FOBCOSTNEEDED07.10.xlsx");
  });

  it("maps a factory template row back to a complete dual-upper SKU only when unambiguous", () => {
    const knownSkus = [
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "ROYAL", leather2: "SUEDE" },
      { style: "ROBYN", colour: "ECRU", leather: "SNAKE", colour2: "LIPSTICK", leather2: "SUEDE" },
    ];
    expect(resolveFobRequestSku(knownSkus, "robyn", "Ecru Snake/Royal Suede")).toEqual(knownSkus[0]);
    expect(resolveFobRequestSku(knownSkus, "robyn", "Ecru Snake")).toBeNull();
  });
});
