import { describe, expect, it } from "vitest";
import { FIXTURES } from "./fixtures";
import { normalizeScan } from "./normalize";
import { visionResultSchema } from "./types";

describe("scan normalization", () => {
  it("validates every fixture against the response schema", () => {
    for (const [name, fixture] of Object.entries(FIXTURES)) {
      expect(() => visionResultSchema.parse(fixture), name).not.toThrow();
    }
  });

  it("splits a full scan into confirmed, review and unmatched", () => {
    const scan = normalizeScan(FIXTURES.full);
    const confirmed = scan.confirmed.map((i) => i.slug);

    expect(confirmed).toContain("whole_wheat_bread");
    expect(confirmed).toContain("hummus");
    // 0.41 confidence: below the review threshold, so not applied silently.
    expect(confirmed).not.toContain("pickles");
    expect(scan.needsReview.map((i) => i.slug)).toContain("pickles");
    // A pot of stew matches nothing in the catalog and must not become inventory.
    expect(scan.unmatched.map((u) => u.displayName)).toContain("סיר חמין משבת");
  });

  it("carries availability through", () => {
    const scan = normalizeScan(FIXTURES.full);
    const all = [...scan.confirmed, ...scan.needsReview];
    expect(all.find((i) => i.slug === "cream_cheese")?.availability).toBe("low");
    expect(all.find((i) => i.slug === "hummus")?.availability).toBe("plenty");
  });

  it("drops items below the confidence floor", () => {
    const scan = normalizeScan({
      shots_processed: ["shelf"],
      unreadable_shots: [],
      items: [
        {
          slug: "hummus",
          display_name: "Maybe hummus",
          category: "spread",
          availability: "plenty",
          confidence: 0.1,
        },
      ],
    });
    expect(scan.confirmed).toHaveLength(0);
    expect(scan.needsReview).toHaveLength(0);
  });

  it("fuzzy-matches onto the catalog but always asks the parent first", () => {
    const scan = normalizeScan(FIXTURES.fuzzy);
    expect(scan.confirmed).toHaveLength(0);
    const review = scan.needsReview.map((i) => i.slug);
    expect(review).toContain("yellow_cheese");
    expect(review).toContain("whole_wheat_bread");
    expect(scan.needsReview[0]?.matchedFrom).toBeDefined();
  });

  it("matches a Hebrew display name onto the catalog", () => {
    const scan = normalizeScan({
      shots_processed: ["shelf"],
      unreadable_shots: [],
      items: [
        {
          slug: "sliced_yellow_cheese",
          display_name: "גבינה צהובה פרוסה",
          category: "protein",
          availability: "plenty",
          confidence: 0.9,
        },
      ],
    });
    expect(scan.needsReview[0]?.slug).toBe("yellow_cheese");
  });

  it("does not match an unrecognised name onto an arbitrary catalog entry", () => {
    // Every Hebrew name normalised to "" under the old ASCII-only tokenizer,
    // which silently matched the first catalog row.
    const scan = normalizeScan({
      shots_processed: ["shelf"],
      unreadable_shots: [],
      items: [
        {
          slug: "סיר_חמין",
          display_name: "סיר חמין משבת",
          category: "other",
          availability: "plenty",
          confidence: 0.9,
        },
      ],
    });
    expect(scan.confirmed).toHaveLength(0);
    expect(scan.needsReview).toHaveLength(0);
    expect(scan.unmatched.map((u) => u.displayName)).toContain("סיר חמין משבת");
  });

  it("reports unreadable photos instead of inventing items", () => {
    const scan = normalizeScan(FIXTURES.unreadable);
    expect(scan.confirmed).toHaveLength(0);
    expect(scan.unreadableShots).toHaveLength(2);
  });

  it("deduplicates items that appear in more than one shot", () => {
    const scan = normalizeScan({
      shots_processed: ["door", "shelf"],
      unreadable_shots: [],
      items: [
        { slug: "hummus", display_name: "Hummus", category: "spread", availability: "plenty", confidence: 0.9 },
        { slug: "hummus", display_name: "Hummus tub", category: "spread", availability: "low", confidence: 0.8 },
      ],
    });
    expect([...scan.confirmed, ...scan.needsReview]).toHaveLength(1);
  });
});
