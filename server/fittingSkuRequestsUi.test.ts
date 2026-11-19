import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ season: "W27", withSupra: true, cancelled: false, withSyntheticParents: false }));
vi.stubGlobal("React", React);
vi.mock("@/contexts/SeasonContext", () => ({ useSeason: () => ({ season: fixture.season }) }));
vi.mock("@/hooks/useCustomSkus", () => ({ useCustomSkus: () => ({
  customStyleRows: fixture.withSyntheticParents && fixture.season === "W27" ? [
    { id: 101, style: "BRITT", lastName: "lastBRITT", category: "Dress Shoe", isSize11: false, createdAt: new Date() },
    { id: 102, style: "BILLIE", lastName: "BILLIE", category: "Dress Shoe", isSize11: false, createdAt: new Date() },
  ] : [],
  mergedStyles: [
    { style: "CUBA", last: "CUBA", category: "Casual Flat", hasNew: true, isAllNew: false, newSKUs: 1, totalSKUs: 2, colours: ["BLACK"], _isCustomStyle: false },
    { style: "ANJA", last: "ANJA", category: "Dress Shoe", hasNew: true, isAllNew: false, newSKUs: 1, totalSKUs: 2, colours: ["BLACK"], _isCustomStyle: false },
    ...(fixture.withSyntheticParents ? [
      { style: "BRITT", last: "lastBRITT", category: "Dress Shoe", hasNew: true, isAllNew: true, newSKUs: 1, totalSKUs: 1, colours: ["BLACK"], _isCustomStyle: true },
      { style: "BILLIE", last: "BILLIE", category: "Dress Shoe", hasNew: true, isAllNew: true, newSKUs: 1, totalSKUs: 1, colours: ["BLACK"], _isCustomStyle: true },
    ] : []),
  ],
  mergedRawSkus: [
    { style: "CUBA", colour: "BLACK", leather: "NAPPA" },
    ...(fixture.withSupra ? [{ style: "CUBA", colour: "BLACK", leather: "SUPRA" }] : []),
    { style: "ANJA", colour: "BLACK", leather: "SUPRA" },
    ...(fixture.withSyntheticParents ? [
      { style: "BRITT", colour: "BLACK", leather: "COMO", is_new: true },
      { style: "BILLIE", colour: "BLACK", leather: "COMO", is_new: true },
    ] : []),
  ],
}) }));
vi.mock("@/lib/trpc", () => {
  const endpoint = (path: string[] = []): any => new Proxy({}, { get: (_, key: string) => {
    if (key === "useUtils") return () => endpoint();
    if (key === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
    if (key === "useQuery") return (input?: { season?: string }) => ({
      data: path.join(".") === "style.getAll"
        ? [{ style: "CUBA", fitRating: "runs_large", fitApproved: false, fittingNotes: null, sizeRecommendation: "half_size_down" }]
        : path.join(".") === "customStyle.getAll" && fixture.withSyntheticParents && input?.season === "W27"
          ? [
            { id: 101, style: "BRITT", lastName: "lastBRITT", category: "Dress Shoe", isSize11: false, createdAt: new Date() },
            { id: 102, style: "BILLIE", lastName: "BILLIE", category: "Dress Shoe", isSize11: false, createdAt: new Date() },
          ]
        : path.join(".") === "styles.listCancelled" && fixture.cancelled ? [{ style: "CUBA" }] : [],
      isLoading: false, refetch: vi.fn(),
    });
    if (key === "invalidate") return vi.fn();
    return endpoint([...path, key]);
  } });
  return { trpc: endpoint() };
});
import { FittingTab } from "../client/src/components/dashboard/FittingTab";

beforeEach(() => Object.assign(fixture, { season: "W27", withSupra: true, cancelled: false, withSyntheticParents: false }));

describe("requested physical SKU Fitting entry", () => {
  it("excludes an all-new W27 BRITT custom parent while retaining BILLIE and the CUBA Supra exception", () => {
    fixture.withSyntheticParents = true;
    const html = renderToStaticMarkup(React.createElement(FittingTab));
    expect(html).toContain(">BILLIE<");
    expect(html).toContain("BLACK SUPRA");
    expect(html).not.toContain(">BRITT<");
  });

  it("renders existing CUBA with a BLACK SUPRA badge, keeping other existing patterns excluded and its saved rating intact", () => {
    const html = renderToStaticMarkup(React.createElement(FittingTab));
    expect(html).toContain("BLACK SUPRA");
    expect(html).toContain("Runs Large");
    expect(html).not.toContain(">ANJA<");
    expect(html).not.toContain("All New");
  });

  it("does not reintroduce CUBA when the requested Supra physical SKU is absent", () => {
    fixture.withSupra = false;
    const html = renderToStaticMarkup(React.createElement(FittingTab));
    expect(html).not.toContain("BLACK SUPRA");
    expect(html).not.toContain(">CUBA<");
  });

  it("honours an explicit cancelled style even when the physical request is present", () => {
    fixture.cancelled = true;
    expect(renderToStaticMarkup(React.createElement(FittingTab))).not.toContain("BLACK SUPRA");
  });
});
