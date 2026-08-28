import { requiredEnv } from "../env.js";
import { createOpenRouterEmbedder } from "../kb/embeddings.js";
import { createSupabaseClient } from "../kb/supabase.js";
import type { RankedMatch } from "./compare.js";
import { compareQuery } from "./compare.js";

function title(sourceUrl: string): string {
  const page = sourceUrl.split("/wiki/")[1] ?? sourceUrl;
  return decodeURIComponent(page).replace(/_/g, " ");
}

function snippet(content: string, length = 140): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

function printSide(label: string, ranked: readonly RankedMatch[]): void {
  console.log(`  ${label}:`);
  for (const { rank, match } of ranked) {
    console.log(`    ${rank}. [${match.similarity.toFixed(4)}] ${title(match.sourceUrl)} — ${snippet(match.content)}`);
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
    const { at768, at3072, comparison } = await compareQuery(query, { embed, db });

    console.log(`\n=== "${query}" ===`);
    printSide("768", at768);
    printSide("3072", at3072);

    console.log(
      comparison.resultsDiffer
        ? `  DIFFERS (top result ${comparison.topResultDiffers ? "differs" : "same"}; ${comparison.rankChanges.length} rank change(s); ${comparison.onlyIn768.length} only-768; ${comparison.onlyIn3072.length} only-3072)`
        : "  identical",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
