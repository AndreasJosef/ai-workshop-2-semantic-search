import { requiredEnv } from "../env.js";
import { createOpenRouterEmbedder } from "../kb/embeddings.js";
import { createSupabaseClient } from "../kb/supabase.js";
import { COMPARE_MODES, type QueryComparison } from "./compare.js";
import { compareQuery } from "./compare.js";
import type { SearchMode } from "./search.js";

function title(sourceUrl: string): string {
  const page = sourceUrl.split("/wiki/")[1] ?? sourceUrl;
  return decodeURIComponent(page).replace(/_/g, " ");
}

function snippet(content: string, length = 140): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

function modeLabel(mode: SearchMode): string {
  return mode === "keyword" ? "keyword" : `${mode}-dim`;
}

function printSide(mode: SearchMode, comparison: QueryComparison): void {
  console.log(`  ${modeLabel(mode)}:`);
  const rankedMatches = comparison.results[mode];
  if (rankedMatches.length === 0) {
    console.log("    (no results)");
    return;
  }
  for (const { rank, match } of rankedMatches) {
    console.log(`    ${rank}. [${match.score.toFixed(4)}] ${title(match.sourceUrl)} — ${snippet(match.content)}`);
  }
}

function printComparison(comparison: QueryComparison): void {
  const { resultsDiffer, topResultDiffers, rankChanges, onlyIn } = comparison.comparison;
  if (!resultsDiffer) {
    console.log("  identical");
    return;
  }
  const uniqueCounts = COMPARE_MODES.map((mode) => `${onlyIn[mode].length} only-${modeLabel(mode)}`).join("; ");
  console.log(
    `  DIFFERS (top result ${topResultDiffers ? "differs" : "same"}; ${rankChanges.length} rank change(s); ${uniqueCounts})`,
  );
  for (const mode of COMPARE_MODES) {
    for (const { rank, match } of onlyIn[mode]) {
      console.log(`    only in ${modeLabel(mode)}: #${rank} [${match.score.toFixed(4)}] ${title(match.sourceUrl)}`);
    }
  }
}

async function main(): Promise<void> {
  const queries = process.argv.slice(2).filter((arg) => arg !== "--");
  if (queries.length === 0) {
    console.error("Usage: pnpm compare -- \"query one\" \"query two\" ...");
    process.exit(1);
  }

  const embed = createOpenRouterEmbedder(requiredEnv("OPENROUTER_API_KEY"));
  const db = createSupabaseClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE"));

  for (const query of queries) {
    const comparison = await compareQuery(query, { embed, db });

    console.log(`\n=== "${query}" ===`);
    for (const mode of COMPARE_MODES) {
      printSide(mode, comparison);
    }
    printComparison(comparison);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
