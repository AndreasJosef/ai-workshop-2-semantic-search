import type { Embed, EmbedDimensions } from "../kb/embeddings.js";
import type { MatchDocumentsRpc, SearchMatch, SupabaseClient } from "../kb/supabase.js";

export interface SearchDeps {
  embed: Embed;
  db: Pick<SupabaseClient, "matchDocuments">;
}

export interface SearchOptions {
  matchCount?: number;
}

const DEFAULT_MATCH_COUNT = 5;

function rpcFor(dimensions: EmbedDimensions): MatchDocumentsRpc {
  return dimensions === 768 ? "match_documents_768" : "match_documents_3072";
}

export async function searchDocuments(
  query: string,
  dimensions: EmbedDimensions,
  deps: SearchDeps,
  options: SearchOptions = {},
): Promise<SearchMatch[]> {
  const matchCount = options.matchCount ?? DEFAULT_MATCH_COUNT;
  const [vector] = await deps.embed([query], dimensions);

  if (!vector) {
    throw new Error(`Embedding response mismatch: expected 1 vector for the query, got 0`);
  }

  return deps.db.matchDocuments(rpcFor(dimensions), vector, matchCount);
}