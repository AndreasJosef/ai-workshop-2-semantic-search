import type { Embed, EmbedDimensions } from "../kb/embeddings.js";
import type { MatchDocumentsQuery, SearchMatch, SupabaseClient } from "../kb/supabase.js";

export type SearchMode = EmbedDimensions | "keyword";

export interface SearchDeps {
  embed: Embed;
  db: Pick<SupabaseClient, "matchDocuments">;
}

export interface SearchOptions {
  matchCount?: number;
}

const DEFAULT_MATCH_COUNT = 5;

export async function searchDocuments(
  query: string,
  mode: SearchMode,
  deps: SearchDeps,
  options: SearchOptions = {},
): Promise<SearchMatch[]> {
  const matchCount = options.matchCount ?? DEFAULT_MATCH_COUNT;

  if (mode === "keyword") {
    return deps.db.matchDocuments({ rpc: "match_documents_keyword", queryText: query }, matchCount);
  }

  const [vector] = await deps.embed([query], mode);

  if (!vector) {
    throw new Error(`Embedding response mismatch: expected 1 vector for the query, got 0`);
  }

  const rpc: MatchDocumentsQuery = {
    rpc: mode === 768 ? "match_documents_768" : "match_documents_3072",
    queryEmbedding: vector,
  };
  return deps.db.matchDocuments(rpc, matchCount);
}
