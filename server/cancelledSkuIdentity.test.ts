import { describe, expect, it } from "vitest";
import {
  buildCancelledSkuKeySet,
  getExactCancelledSkuKey,
  getLegacyCancelledSkuKey,
  isCancelledSku,
} from "@shared/cancelledSkuIdentity";

describe("composite SKU cancellation identity", () => {
  it("keeps a legacy Upper 1 cancellation broad for backwards compatibility", () => {
    const keys = new Set([getLegacyCancelledSkuKey("DONTE", "BLACK", "NYLON")]);

    expect(isCancelledSku(keys, {
      style: "DONTE", colour: "BLACK", leather: "NYLON", colour2: "BLACK", leather2: "NAPPA",
    })).toBe(true);
    expect(isCancelledSku(keys, {
      style: "DONTE", colour: "BLACK", leather: "NYLON", colour2: "ECRU", leather2: "SNAKE",
    })).toBe(true);
  });

  it("cancels only the exact Upper 2 construction when one is stored", () => {
    const keys = new Set([getExactCancelledSkuKey({
      style: "ELECTRIC", colour: "BLACK", leather: "NYLON", colour2: "ECRU", leather2: "SNAKE",
    })]);

    expect(isCancelledSku(keys, {
      style: "ELECTRIC", colour: "BLACK", leather: "NYLON", colour2: "ECRU", leather2: "SNAKE",
    })).toBe(true);
    expect(isCancelledSku(keys, {
      style: "ELECTRIC", colour: "BLACK", leather: "NYLON", colour2: "BLACK", leather2: "NAPPA",
    })).toBe(false);
  });

  it("turns persisted legacy and exact rows into compatible keys", () => {
    const keys = buildCancelledSkuKeySet([
      { style: "EMILY", colour: "BLACK", leather: "VINTAGE" },
      { style: "EMILY", colour: "VIPER", leather: "SNAKE", colour2: "STONE", leather2: "SUEDE" },
    ]);

    expect(isCancelledSku(keys, {
      style: "EMILY", colour: "BLACK", leather: "VINTAGE", colour2: "BLACK", leather2: "SUEDE",
    })).toBe(true);
    expect(isCancelledSku(keys, {
      style: "EMILY", colour: "VIPER", leather: "SNAKE", colour2: "STONE", leather2: "SUEDE",
    })).toBe(true);
    expect(isCancelledSku(keys, {
      style: "EMILY", colour: "VIPER", leather: "SNAKE", colour2: "WHEAT", leather2: "SUEDE",
    })).toBe(false);
  });
});
