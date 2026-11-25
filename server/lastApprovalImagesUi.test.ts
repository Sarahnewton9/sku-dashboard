import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StyleFixture = {
  style: string;
  last: string;
  category: string;
  newSKUs: number;
  imageUrl?: string;
};
type ApprovalFixture = {
  lastName: string;
  status: "approved" | "waiting_revised";
  notes?: string;
  size7Approved?: boolean;
  size5Approved?: boolean;
  proceedWithSamples?: boolean;
};
type SeasonFixture = {
  lasts: string[];
  styles: StyleFixture[];
  approvals: ApprovalFixture[];
  deleted: string[];
  customLasts: Array<{ lastName: string; isRunOn: boolean }>;
  customStyles: Array<{ id: number; style: string; lastName: string }>;
};

const fixture = vi.hoisted(() => ({
  season: "W27",
  seasons: {} as Record<string, SeasonFixture>,
  stateCall: 0,
  expandedLast: null as string | null,
  filter: "all" as "all" | "approved" | "waiting_revised",
  overrides: [] as Array<{ style: string; imageUrl: string }>,
  queryCalls: [] as Array<{ name: string; input: unknown; options: unknown }>,
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
  confetti: vi.fn(),
}));

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: any) => {
      const index = fixture.stateCall++;
      // Seed the existing parent slots only; real thumbnails/StyleCards keep their own state.
      const seeds: Record<number, unknown> = { 2: fixture.expandedLast, 5: fixture.filter };
      return actual.useState(index in seeds ? seeds[index] : initial);
    },
  };
});
vi.stubGlobal("React", React);
vi.mock("canvas-confetti", () => ({ default: fixture.confetti }));
vi.mock("@/contexts/SeasonContext", () => ({ useSeason: () => ({ season: fixture.season }) }));
vi.mock("@shared/const", () => ({
  getNewLastsForSeason: (season: string) => fixture.seasons[season].lasts,
}));
vi.mock("@/hooks/useStyleCategories", () => ({
  useStyleCategories: () => ({ getCategory: (_style: string, category: string) => category }),
}));
vi.mock("@/hooks/useCustomSkus", () => ({
  useCustomSkus: () => ({
    mergedStyles: fixture.seasons[fixture.season].styles,
    customStyleRows: fixture.seasons[fixture.season].customStyles,
    refetchCustomStyles: fixture.refetch,
    refetchImageOverrides: fixture.refetch,
  }),
}));
vi.mock("@/lib/trpc", () => {
  const endpoint = (path: string[] = []): any => new Proxy({}, {
    get: (_target, key: string) => {
      if (key === "useMutation") return () => ({
        mutate: fixture.mutate, mutateAsync: fixture.mutateAsync, isPending: false,
      });
      if (key === "useQuery") return (input?: unknown, options?: unknown) => {
        const name = path.join(".");
        fixture.queryCalls.push({ name, input, options });
        const season = (input as { season?: string } | undefined)?.season ?? fixture.season;
        const data = fixture.seasons[season];
        const responses: Record<string, unknown> = {
          "lastApproval.getAll": data.approvals,
          "lastApproval.getDeleted": data.deleted,
          "customLast.getAll": data.customLasts,
          "styleImage.getAll": fixture.overrides,
        };
        // An unexpected query is a regression: this tab must reuse merged image fallbacks.
        if (!(name in responses)) throw new Error(`Unexpected Last Approval query: ${name}`);
        return { data: responses[name], isLoading: false, isError: false, refetch: fixture.refetch };
      };
      return endpoint([...path, key]);
    },
  });
  return { trpc: endpoint() };
});

// Do not mock either visual: these regressions exercise the actual tab, StyleCard,
// LastApprovalStyleThumbnail, and season-aware LastApprovalSizeChecks SSR markup.
import LastApprovalTab from "@/components/dashboard/LastApprovalTab";

const style = (name: string, last = "OASIS", extra: Partial<StyleFixture> = {}): StyleFixture => ({
  style: name, last, category: "DRESS SHOE", newSKUs: 0, ...extra,
});
const seasonData = (lasts: string[], styles: StyleFixture[]): SeasonFixture => ({
  lasts, styles, approvals: [], deleted: [], customLasts: [], customStyles: [],
});
const current = () => fixture.seasons[fixture.season];
function render() {
  fixture.stateCall = 0;
  return renderToStaticMarkup(React.createElement(LastApprovalTab));
}
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Extract one complete marked element, balancing same-tag children instead of
// matching the first closing div (SSR has no DOM dependency in this repository).
function markedElement(html: string, attribute: string, value: string): string {
  const opening = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\b${attribute}="${escapeRegExp(value)}"[^>]*>`, "i").exec(html);
  if (!opening) return "";
  const tag = opening[1];
  const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  tokens.lastIndex = opening.index;
  let depth = 0;
  for (let token = tokens.exec(html); token; token = tokens.exec(html)) {
    if (token[0].startsWith("</")) depth--;
    else if (!token[0].endsWith("/>")) depth++;
    if (depth === 0) return html.slice(opening.index, tokens.lastIndex);
  }
  throw new Error(`Unbalanced SSR element: ${attribute}=${value}`);
}
const lastRow = (html: string, last = "OASIS") => markedElement(html, "data-last-approval", last);
const strip = (html: string, last = "OASIS") => markedElement(html, "data-last-style-thumbnails", last);
const thumbnail = (html: string, name: string) => markedElement(html, "data-last-style-thumbnail", name);
const styleCard = (html: string, name: string) => markedElement(html, "data-last-style-card", name);
const imageTag = (html: string) => html.match(/<img\b[^>]*>/)?.[0] ?? "";
const imageSrc = (html: string) => imageTag(html).match(/\bsrc="([^"]*)"/)?.[1];
const thumbnailNames = (html: string) => Array.from(html.matchAll(/data-last-style-thumbnail="([^"]+)"/g), match => match[1]);
const rowNames = (html: string) => Array.from(html.matchAll(/data-last-approval="([^"]+)"/g), match => match[1]);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(fixture, {
    season: "W27", stateCall: 0, expandedLast: null, filter: "all", overrides: [], queryCalls: [],
    seasons: {
      W27: seasonData(["OASIS", "EMPTY"], [
        style("ALPHA", "OASIS", { newSKUs: 2, imageUrl: "/images/alpha-merged.jpg" }),
        style("BETA", "OASIS", { category: "DRESS SANDAL", newSKUs: 1, imageUrl: "/images/beta-static.jpg" }),
        style("GAMMA", "OASIS", { category: "CASUAL FLAT" }),
      ]),
      SS26: seasonData(["ARCHIVE"], [style("OLD-STYLE", "ARCHIVE", { imageUrl: "/images/archive.jpg" })]),
    },
  });
});

describe("Last Approval style recognition images (actual tab SSR)", () => {
  it("shows every labelled style while collapsed, in the existing category/alphabetical order", () => {
    current().styles.push(
      style("ZETA", "OASIS", { imageUrl: "/images/zeta.jpg" }),
      style("DELTA", "OASIS", { imageUrl: "/images/delta.jpg" }),
      style("ETA", "OASIS", { category: "DRESS ANKLE BOOT", imageUrl: "/images/eta.jpg" }),
    );
    const html = render();
    const images = strip(html);
    expect(images).not.toBe("");
    expect(thumbnailNames(images)).toEqual(["BETA", "ALPHA", "DELTA", "ZETA", "GAMMA", "ETA"]);
    for (const item of current().styles) {
      const button = thumbnail(images, item.style);
      expect(button).toContain(`>${item.style}</span>`);
    }
    expect(lastRow(html)).toMatch(/6 styles/);
    expect(html).not.toContain("data-last-style-card=");
    expect(html).not.toContain("Styles on this last</p>");
  });

  it("renders real read-only thumbnail buttons with descriptive alt text, contained lazy images", () => {
    const button = thumbnail(strip(render()), "ALPHA");
    expect(button).toMatch(/^<button\b/);
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-label="Show ALPHA on OASIS"');
    expect(imageTag(button)).toContain('alt="ALPHA style"');
    expect(imageTag(button)).toContain('loading="lazy"');
    expect(imageTag(button)).toMatch(/class="[^"]*\bobject-contain\b/);
    expect(button).not.toContain('type="file"');
    expect(button).not.toContain("upload");
  });

  it("prioritizes the explicit manual override over the merged fallback", () => {
    fixture.overrides = [{ style: "ALPHA", imageUrl: "/uploads/alpha-manual.jpg" }];
    const button = thumbnail(strip(render()), "ALPHA");
    expect(imageSrc(button)).toBe("/uploads/alpha-manual.jpg");
    expect(button).not.toContain("alpha-merged.jpg");
  });

  it("normalizes mixed-case/whitespace override keys against mixed-case merged style names", () => {
    current().styles = [style("aLpHa", "OASIS", { imageUrl: "/images/alpha-stale.jpg" })];
    fixture.overrides = [{ style: " ALpHa ", imageUrl: "/uploads/alpha-fresh.jpg" }];
    const button = thumbnail(strip(render()), "aLpHa");
    expect(imageSrc(button)).toBe("/uploads/alpha-fresh.jpg");
    expect(imageTag(button)).toContain('alt="aLpHa style"');
  });

  it.each([
    ["website", "https://images.example.test/website/alpha.jpg"],
    ["static", "/manus-storage/alpha-static.png"],
  ])("uses the already-merged %s fallback URL without another image source", (_source, url) => {
    current().styles = [style("ALPHA", "OASIS", { imageUrl: url })];
    expect(imageSrc(thumbnail(strip(render()), "ALPHA"))).toBe(url);
    expect(fixture.queryCalls.map(call => call.name)).toEqual([
      "lastApproval.getAll", "lastApproval.getDeleted", "styleImage.getAll", "customLast.getAll",
    ]);
  });

  it("does not let blank manual records suppress a valid merged image", () => {
    fixture.overrides = [{ style: "ALPHA", imageUrl: "   " }, { style: "BETA", imageUrl: "" }];
    const html = strip(render());
    expect(imageSrc(thumbnail(html, "ALPHA"))).toBe("/images/alpha-merged.jpg");
    expect(imageSrc(thumbnail(html, "BETA"))).toBe("/images/beta-static.jpg");
  });

  it("labels a missing image without borrowing an arbitrary sibling's photograph", () => {
    const html = strip(render());
    const missing = thumbnail(html, "GAMMA");
    expect(missing).toContain("No image");
    expect(missing).toContain(">GAMMA</span>");
    expect(imageTag(missing)).toBe("");
    expect(missing).not.toContain("alpha-merged.jpg");
    expect(missing).not.toContain("beta-static.jpg");
    expect(thumbnailNames(html)).toContain("GAMMA");
  });

  it("keeps a last with no styles visible without fabricating a representative image", () => {
    const html = render();
    const empty = lastRow(html, "EMPTY");
    expect(empty).not.toBe("");
    expect(empty).toMatch(/0 styles/);
    expect(imageTag(empty)).toBe("");
    expect(thumbnailNames(empty)).toEqual([]);
    expect(strip(html, "EMPTY")).toBe("");
    fixture.expandedLast = "EMPTY";
    expect(lastRow(render(), "EMPTY")).toContain("No styles on this last yet.");
  });

  it("uses the exact same resolved images in existing expanded StyleCards and removes the collapsed strip", () => {
    fixture.overrides = [{ style: " alpha ", imageUrl: "/uploads/alpha-manual.jpg" }];
    const collapsed = render();
    fixture.expandedLast = "OASIS"; // Existing LastApprovalTab useState slot 2.
    const expanded = render();
    expect(strip(expanded)).toBe("");
    expect(thumbnailNames(lastRow(expanded))).toEqual([]);
    for (const name of ["ALPHA", "BETA", "GAMMA"]) {
      const card = styleCard(expanded, name);
      expect(card).not.toBe("");
      expect(imageSrc(card)).toBe(imageSrc(thumbnail(collapsed, name)));
    }
    expect(imageSrc(styleCard(expanded, "ALPHA"))).toBe("/uploads/alpha-manual.jpg");
    expect(imageSrc(styleCard(expanded, "BETA"))).toBe("/images/beta-static.jpg");
    expect(expanded).toContain("Styles on this last");
    expect(expanded).toContain("Add Style");
    expect(expanded).toContain('type="file"'); // Existing upload capability remains in expanded cards only.
  });

  it("isolates seasonal lasts, styles, approvals and queries when switching W27 to SS26 and back", () => {
    current().approvals = [{ lastName: "OASIS", status: "approved", notes: "Winter only notes" }];
    fixture.seasons.SS26.approvals = [{ lastName: "ARCHIVE", status: "waiting_revised", notes: "Summer only notes" }];
    expect(rowNames(render())).toEqual(["OASIS", "EMPTY"]);
    fixture.season = "SS26";
    fixture.queryCalls = [];
    const summer = render();
    expect(rowNames(summer)).toEqual(["ARCHIVE"]);
    expect(thumbnailNames(summer)).toEqual(["OLD-STYLE"]);
    expect(summer).toContain("Summer only notes");
    expect(summer).not.toContain("Winter only notes");
    expect(summer).not.toContain("alpha-merged.jpg");
    for (const name of ["lastApproval.getAll", "lastApproval.getDeleted", "customLast.getAll"]) {
      expect(fixture.queryCalls.find(call => call.name === name)?.input).toEqual({ season: "SS26" });
    }
    fixture.season = "W27";
    const winter = render();
    expect(rowNames(winter)).toEqual(["OASIS", "EMPTY"]);
    expect(winter).toContain("Winter only notes");
    expect(winter).not.toContain("archive.jpg");
  });

  it("excludes deleted and run-on custom lasts while retaining eligible custom styles and deduplicating lasts", () => {
    current().deleted = ["EMPTY", "DELETED"];
    current().customLasts = [
      { lastName: "OASIS", isRunOn: false },
      { lastName: "DELETED", isRunOn: false },
      { lastName: "RUN-ON", isRunOn: true },
      { lastName: "CUSTOM", isRunOn: false },
    ];
    current().styles.push(
      style("REMOVED-STYLE", "DELETED", { imageUrl: "/images/deleted.jpg" }),
      style("RUN-ON-STYLE", "RUN-ON", { imageUrl: "/images/run-on.jpg" }),
      style("NEW-CUSTOM", "CUSTOM", { imageUrl: "/images/custom.jpg" }),
    );
    current().customStyles = [{ id: 42, style: "NEW-CUSTOM", lastName: "CUSTOM" }];
    const html = render();
    expect(rowNames(html)).toEqual(["OASIS", "CUSTOM"]);
    expect(thumbnailNames(strip(html, "CUSTOM"))).toEqual(["NEW-CUSTOM"]);
    expect(html).not.toContain("deleted.jpg");
    expect(html).not.toContain("run-on.jpg");
    fixture.expandedLast = "CUSTOM";
    const card = styleCard(render(), "NEW-CUSTOM");
    expect(card).toContain(">NEW</span>");
    expect(card).toContain('title="Remove NEW-CUSTOM"');
  });

  it("preserves approval filters, notes, new-SKU counts, season sizing and Proceed controls beside the images", () => {
    current().approvals = [{
      lastName: "OASIS", status: "approved", notes: "Keep toe shape", size7Approved: true,
      size5Approved: true, proceedWithSamples: true,
    }];
    const html = render();
    const row = lastRow(html);
    expect(row).toContain('title="Click to mark as Waiting on Revised"');
    expect(row).toContain("Keep toe shape");
    expect(row).toContain("3 new SKUs");
    expect(row).toContain("3 styles");
    expect(row).toContain("2/4 sizes");
    expect(row.match(/aria-label="Size [^"]+"/g)).toEqual([
      'aria-label="Size 7 — first fitting"', 'aria-label="Size 5"', 'aria-label="Size 6.5"', 'aria-label="Size 9"',
    ]);
    expect(row.match(/aria-pressed="(true|false)"/g)).toEqual([
      'aria-pressed="true"', 'aria-pressed="true"', 'aria-pressed="false"', 'aria-pressed="false"',
    ]);
    expect(row).toContain('title="Proceed with Samples — click to uncheck"');
    expect(row).toContain(">Proceed</span>");
    expect(html).toContain("Import Notes");
    fixture.filter = "approved";
    expect(rowNames(render())).toEqual(["OASIS"]);
    expect(thumbnailNames(strip(render()))).toEqual(["BETA", "ALPHA", "GAMMA"]);
    fixture.filter = "waiting_revised";
    expect(rowNames(render())).toEqual(["EMPTY"]);
    fixture.filter = "all";
    fixture.expandedLast = "OASIS";
    expect(lastRow(render())).toContain("Keep toe shape");
  });

  it("only reads existing data and never uploads, mutates, refetches or celebrates during either render mode", () => {
    render();
    fixture.expandedLast = "OASIS";
    render();
    expect(fixture.mutate).not.toHaveBeenCalled();
    expect(fixture.mutateAsync).not.toHaveBeenCalled();
    expect(fixture.refetch).not.toHaveBeenCalled();
    expect(fixture.confetti).not.toHaveBeenCalled();
    expect(new Set(fixture.queryCalls.map(call => call.name))).toEqual(new Set([
      "lastApproval.getAll", "lastApproval.getDeleted", "styleImage.getAll", "customLast.getAll",
    ]));
  });

  it("refreshes manual image overrides on mount/window focus without adding a seasonal image source", () => {
    render();
    const query = fixture.queryCalls.find(call => call.name === "styleImage.getAll");
    expect(query?.input).toBeUndefined();
    expect(query?.options).toMatchObject({
      staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always",
    });
  });
});
