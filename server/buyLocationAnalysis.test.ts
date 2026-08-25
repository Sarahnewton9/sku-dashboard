import { describe, expect, it } from "vitest";
import {
  getLocationQuantity,
  groupBoughtStylesByLocation,
} from "@shared/buyLocationAnalysis";

describe("Buy location analysis", () => {
  const items = [
    { style: "ASTI", auQty: 4, usaQty: 2, nycQty: 0, laQty: 8 },
    { style: "ASTI", auQty: 1, usaQty: 0, nycQty: 0, laQty: 3 },
    { style: "ZOE", auQty: 7, usaQty: 1, nycQty: 2, laQty: 0 },
  ];

  it("reads the quantity for the selected store location", () => {
    expect(getLocationQuantity(items[0], "la")).toBe(8);
    expect(getLocationQuantity(items[0], "au")).toBe(4);
  });

  it("shows only styles bought for the selected location and groups their SKU quantities", () => {
    expect(groupBoughtStylesByLocation(items, "la")).toEqual([
      expect.objectContaining({ style: "ASTI", quantity: 11 }),
    ]);
  });
});
