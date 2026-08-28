import { describe, expect, it } from "vitest";

import type { SearchMode } from "./search.js";
import type { SearchMatch } from "../kb/supabase.js";
import { compareResults } from "./compare.js";

function row(id: number, sourceUrl: string, score: number): SearchMatch {
  return { id, content: `content ${id}`, sourceUrl, score };
}

const MODES: SearchMode[] = [768, 3072, "keyword"];

function byMode(at768: SearchMatch[], at3072: SearchMatch[], atKeyword: SearchMatch[]) {
  return { 768: at768, 3072: at3072, keyword: atKeyword } as Record<SearchMode, SearchMatch[]>;
}

describe("compareResults", () => {
  it("reports no differences when all three modes agree", () => {
    const results = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(2, "https://wot.fandom.com/wiki/B", 0.8)];

    const comparison = compareResults(byMode(results, results, results));

    expect(comparison.topResultDiffers).toBe(false);
    expect(comparison.resultsDiffer).toBe(false);
    for (const mode of MODES) {
      expect(comparison.onlyIn[mode]).toEqual([]);
    }
    expect(comparison.rankChanges).toEqual([]);
  });

  it("flags when one mode's top result differs from the other two", () => {
    const at768 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(2, "https://wot.fandom.com/wiki/B", 0.8)];
    const at3072 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(2, "https://wot.fandom.com/wiki/B", 0.8)];
    const atKeyword = [row(2, "https://wot.fandom.com/wiki/B", 0.9), row(1, "https://wot.fandom.com/wiki/A", 0.8)];

    const comparison = compareResults(byMode(at768, at3072, atKeyword));

    expect(comparison.topResultDiffers).toBe(true);
    expect(comparison.resultsDiffer).toBe(true);
    expect(comparison.rankChanges).toEqual([
      {
        id: 1,
        sourceUrl: "https://wot.fandom.com/wiki/A",
        ranks: { 768: 1, 3072: 1, keyword: 2 },
      },
      {
        id: 2,
        sourceUrl: "https://wot.fandom.com/wiki/B",
        ranks: { 768: 2, 3072: 2, keyword: 1 },
      },
    ]);
  });

  it("separates results that only appear in one mode", () => {
    const at768 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(3, "https://wot.fandom.com/wiki/C", 0.8)];
    const at3072 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(3, "https://wot.fandom.com/wiki/C", 0.8)];
    const atKeyword = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(4, "https://wot.fandom.com/wiki/D", 0.8)];

    const comparison = compareResults(byMode(at768, at3072, atKeyword));

    expect(comparison.topResultDiffers).toBe(false);
    expect(comparison.resultsDiffer).toBe(true);
    expect(comparison.onlyIn[768]).toEqual([]);
    expect(comparison.onlyIn[3072]).toEqual([]);
    expect(comparison.onlyIn.keyword).toEqual([
      { rank: 2, match: row(4, "https://wot.fandom.com/wiki/D", 0.8) },
    ]);
  });

  it("only reports rank changes for results present in more than one mode", () => {
    const at768 = [row(1, "https://wot.fandom.com/wiki/A", 0.9), row(2, "https://wot.fandom.com/wiki/B", 0.8)];
    const at3072 = [row(2, "https://wot.fandom.com/wiki/B", 0.9)];
    const atKeyword = [row(2, "https://wot.fandom.com/wiki/B", 0.9), row(1, "https://wot.fandom.com/wiki/A", 0.8)];

    const comparison = compareResults(byMode(at768, at3072, atKeyword));

    expect(comparison.rankChanges).toEqual([
      {
        id: 1,
        sourceUrl: "https://wot.fandom.com/wiki/A",
        ranks: { 768: 1, keyword: 2 },
      },
      {
        id: 2,
        sourceUrl: "https://wot.fandom.com/wiki/B",
        ranks: { 768: 2, 3072: 1, keyword: 1 },
      },
    ]);
    expect(comparison.onlyIn[768]).toEqual([]);
    expect(comparison.onlyIn[3072]).toEqual([]);
    expect(comparison.onlyIn.keyword).toEqual([]);
  });
});
