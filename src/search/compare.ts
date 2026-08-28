import type { SearchMode, SearchDeps } from "./search.js";
import { searchDocuments } from "./search.js";
import type { SearchMatch } from "../kb/supabase.js";

export const COMPARE_MODES: readonly SearchMode[] = [768, 3072, "keyword"];

export interface RankedMatch {
  rank: number;
  match: SearchMatch;
}

export interface RankChange {
  id: number;
  sourceUrl: string;
  ranks: Partial<Record<SearchMode, number>>;
}

export interface ResultComparison {
  onlyIn: Record<SearchMode, RankedMatch[]>;
  rankChanges: RankChange[];
  topResultDiffers: boolean;
  resultsDiffer: boolean;
}

export interface QueryComparison {
  query: string;
  results: Record<SearchMode, RankedMatch[]>;
  comparison: ResultComparison;
}

export function ranked(results: readonly SearchMatch[]): RankedMatch[] {
  return results.map((result, i) => ({ rank: i + 1, match: result }));
}

export function compareResults(resultsByMode: Readonly<Record<SearchMode, readonly SearchMatch[]>>): ResultComparison {
  const rankedByMode = new Map(COMPARE_MODES.map((mode) => [mode, ranked(resultsByMode[mode])]));
  const ranksById = new Map<number, { sourceUrl: string; ranks: Partial<Record<SearchMode, number>> }>();
  for (const mode of COMPARE_MODES) {
    for (const { rank, match } of rankedByMode.get(mode)!) {
      const entry = ranksById.get(match.id);
      if (entry) {
        entry.ranks[mode] = rank;
      } else {
        ranksById.set(match.id, { sourceUrl: match.sourceUrl, ranks: { [mode]: rank } });
      }
    }
  }

  const onlyIn = Object.fromEntries(
    COMPARE_MODES.map((mode) => [
      mode,
      rankedByMode.get(mode)!.filter(({ match }) => {
        const entry = ranksById.get(match.id)!;
        return COMPARE_MODES.filter((other) => entry.ranks[other] !== undefined).length === 1;
      }),
    ]),
  ) as Record<SearchMode, RankedMatch[]>;

  const rankChanges: RankChange[] = [];
  for (const [id, entry] of ranksById) {
    const ranks = Object.values(entry.ranks);
    const appearsInMultipleModes = ranks.length > 1;
    const allRanksEqual = ranks.every((rank) => rank === ranks[0]);
    if (appearsInMultipleModes && !allRanksEqual) {
      rankChanges.push({ id, sourceUrl: entry.sourceUrl, ranks: entry.ranks });
    }
  }

  const topIds = COMPARE_MODES.map((mode) => resultsByMode[mode][0]?.id);
  const topResultDiffers = topIds.some((id) => id !== topIds[0]);
  const referenceIds = resultsByMode[COMPARE_MODES[0]!].map((m) => m.id);
  const resultsDiffer =
    topResultDiffers ||
    COMPARE_MODES.some((mode) => {
      const ids = resultsByMode[mode].map((m) => m.id);
      return ids.length !== referenceIds.length || ids.some((id, i) => id !== referenceIds[i]);
    });

  return { onlyIn, rankChanges, topResultDiffers, resultsDiffer };
}

export async function compareQuery(
  query: string,
  deps: SearchDeps,
  options: { matchCount?: number } = {},
): Promise<QueryComparison> {
  const resultsByMode = Object.fromEntries(
    await Promise.all(
      COMPARE_MODES.map(async (mode) => [mode, await searchDocuments(query, mode, deps, options)] as const),
    ),
  ) as Record<SearchMode, SearchMatch[]>;

  return {
    query,
    results: Object.fromEntries(COMPARE_MODES.map((mode) => [mode, ranked(resultsByMode[mode])])) as Record<
      SearchMode,
      RankedMatch[]
    >,
    comparison: compareResults(resultsByMode),
  };
}
