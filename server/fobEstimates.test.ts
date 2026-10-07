import { describe, expect, it } from "vitest";
import { summariseStyleFobCosts } from "../shared/fobEstimates";

describe("style FOB estimates", () => {
  it("estimates missing same-material colourways without inventing unmatched material costs", () => {
    const summaries = summariseStyleFobCosts([
      { style: "CHERRY", leather: "SUEDE", actualFobUsd: 33.5 },
      { style: "CHERRY", leather: "SUEDE", actualFobUsd: 33.5 },
      { style: "CHERRY", leather: "SUEDE", actualFobUsd: null },
      { style: "CHERRY", leather: "SUEDE", actualFobUsd: null },
      { style: "CHERRY", leather: "SNAKE", actualFobUsd: null },
    ]);

    expect(summaries.CHERRY).toMatchObject({
      totalColourways: 5,
      costedColourways: 2,
      estimatedColourways: 2,
      missingColourways: 1,
      rolledUpFobUsd: 33.5,
      minFobUsd: 33.5,
      maxFobUsd: 33.5,
    });
  });

  it("keeps estimates inside their own style and material combination", () => {
    const summaries = summariseStyleFobCosts([
      { style: "ALPHA", leather: "SUEDE", actualFobUsd: 31 },
      { style: "BETA", leather: "SUEDE", actualFobUsd: 45 },
      { style: "ALPHA", leather: "SUEDE", actualFobUsd: null },
      { style: "ALPHA", leather: "SUEDE", leather2: "NAPPA", actualFobUsd: null },
    ]);

    expect(summaries.ALPHA).toMatchObject({
      costedColourways: 1,
      estimatedColourways: 1,
      missingColourways: 1,
      rolledUpFobUsd: 31,
    });
  });
});
