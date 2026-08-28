import type { EmbedDimensions } from "../kb/embeddings.js";
import type { SearchMatch } from "../kb/supabase.js";
import { searchDocuments, type SearchDeps } from "./search.js";

export interface RankedMatch {
  rank: number;
  match: SearchMatch;
}

export interface RankChange {
  id: number;
  sourceUrl: string;
  rank768: number;
  rank3072: number;
}

export interface ResultComparison {
  onlyIn768: RankedMatch[];
  onlyIn3072: RankedMatch[];
  rankChanges: RankChange[];
  topResultDiffers: boolean;
  resultsDiffer: boolean;
}

export function ranked(results: readonly SearchMatch[]): RankedMatch[] {
  return results.map((result, i) => ({ rank: i + 1, match: result }));
}

export function match(rank: number, result: SearchMatch): RankedMatch {
  return { rank, match: result };
}

export function compareResults(at768: readonly SearchMatch[], at3072: readonly SearchMatch[]): ResultComparison {
  const rankBy768 = new Map(at768.map((m, i) => [m.id, i + 1]));
  const rankBy3072 = new Map(at3072.map((m, i) => [m.id, i + 1]));

  const onlyIn768 = ranked(at768).filter(({ match: m }) => !rankBy3072.has(m.id));
  const onlyIn3072 = ranked(at3072).filter(({ match: m }) => !rankBy768.has(m.id));

  const rankChanges: RankChange[] = [];
  for (const [id, rank768] of rankBy768) {
    const rank3072 = rankBy3072.get(id);
    const sourceUrl = at768[rank768 - 1]?.sourceUrl;
    if (rank3072 !== undefined && rank3072 !== rank768 && sourceUrl !== undefined) {
      rankChanges.push({
        id,
        sourceUrl,
        rank768,
        rank3072,
      });
    }
  }

  const top768 = at768[0]?.id;
  const top3072 = at3072[0]?.id;
  const topResultDiffers = top768 !== top3072;
  const resultsDiffer =
    topResultDiffers || at768.length !== at3072.length || at768.some((m, i) => m.id !== at3072[i]?.id);

  return { onlyIn768, onlyIn3072, rankChanges, topResultDiffers, resultsDiffer };
}

export interface QueryComparison {
  query: string;
  at768: RankedMatch[];
  at3072: RankedMatch[];
  comparison: ResultComparison;
}

export async function compareQuery(
  query: string,
  deps: SearchDeps,
  options: { matchCount?: number } = {},
): Promise<QueryComparison> {
  const [at768, at3072] = await Promise.all([
    searchDocuments(query, 768 satisfies EmbedDimensions, deps, options),
    searchDocuments(query, 3072 satisfies EmbedDimensions, deps, options),
  ]);

  return { query, at768: ranked(at768), at3072: ranked(at3072), comparison: compareResults(at768, at3072) };
}
