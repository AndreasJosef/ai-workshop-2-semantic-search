import { describe, expect, it } from "vitest";

import type { SearchMatch } from "../kb/supabase.js";
import { compareResults } from "./compare.js";

function row(id: number, sourceUrl: string, similarity: number): SearchMatch {
  return { id, content: `content ${id}`, sourceUrl, similarity };
}

describe("compareResults", () => {
  it("reports no differences for identical rankings", () => {
    const results = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(2, "https://wot.fandom.com/wiki/B", 0.8)];

    const comparison = compareResults(results, results);

    expect(comparison.topResultDiffers).toBe(false);
    expect(comparison.resultsDiffer).toBe(false);
    expect(comparison.onlyIn768).toEqual([]);
    expect(comparison.onlyIn3072).toEqual([]);
    expect(comparison.rankChanges).toEqual([]);
  });

  it("flags a different top result", () => {
    const at768 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(2, "https://wot.fandom.com/wiki/B", 0.8)];
    const at3072 = [row(2, "https://wot.fandom.com/wiki/B", 0.9), row(1, "https://wot.fandom.com/wiki/A", 0.8)];

    const comparison = compareResults(at768, at3072);

    expect(comparison.topResultDiffers).toBe(true);
    expect(comparison.resultsDiffer).toBe(true);
    expect(comparison.rankChanges).toEqual([
      { id: 1, sourceUrl: "https://wot.fandom.com/wiki/A", rank768: 1, rank3072: 2 },
      { id: 2, sourceUrl: "https://wot.fandom.com/wiki/B", rank768: 2, rank3072: 1 },
    ]);
  });

  it("separates documents that only appear on one side", () => {
    const at768 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(3, "https://wot.fandom.com/wiki/C", 0.8)];
    const at3072 = [row(2, "https://wot.fandom.com/wiki/B", 0.9), row(3, "https://wot.fandom.com/wiki/C", 0.8)];

    const comparison = compareResults(at768, at3072);

    expect(comparison.topResultDiffers).toBe(true);
    expect(comparison.onlyIn768).toEqual([{ rank: 1, match: row(1, "https://wot.fandom.com/wiki/A", 0.9) }]);
    expect(comparison.onlyIn3072).toEqual([{ rank: 1, match: row(2, "https://wot.fandom.com/wiki/B", 0.9) }]);
    expect(comparison.rankChanges).toEqual([]);
  });

  it("treats a doc that appears on only one side as differing even with the same top result", () => {
    const at768 = [row(1, "https://wot.fandom.com/wiki/A", 0.9)];
    const at3072 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(2, "https://wot.fandom.com/wiki/B", 0.85)];

    const comparison = compareResults(at768, at3072);

    expect(comparison.topResultDiffers).toBe(false);
    expect(comparison.resultsDiffer).toBe(true);
    expect(comparison.onlyIn3072).toEqual([{ rank: 2, match: row(2, "https://wot.fandom.com/wiki/B", 0.85) }]);
  });
});
