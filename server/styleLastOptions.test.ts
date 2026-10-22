import { describe, expect, it } from "vitest";
import { buildStyleLastOptions } from "@shared/styleLastOptions";

describe("By Style last selector", () => {
  it("includes established seasonal carry-over lasts that are absent from the new-last registry", () => {
    const options = buildStyleLastOptions({
      canonicalLasts: ["FERGIE"],
      staticStyleLasts: ["MACK"],
      customLasts: [{ lastName: "ISLA" }],
      seasonalStyleLasts: [
        { lastName: "AYLA" },
        { lastName: "ayla" },
        { lastName: "  AYLA  " },
      ],
    });

    expect(options).toEqual(["AYLA", "FERGIE", "ISLA", "MACK"]);
  });

  it("accepts live custom-last and seasonal style rows together", () => {
    const options = buildStyleLastOptions({
      canonicalLasts: [],
      staticStyleLasts: [],
      customLasts: ["VIVID"],
      seasonalStyleLasts: [{ last: "AYLA" }],
    });

    expect(options).toEqual(["AYLA", "VIVID"]);
  });
});
