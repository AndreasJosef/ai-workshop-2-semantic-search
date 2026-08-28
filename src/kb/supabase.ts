import type { FetchLike } from "../corpus/api.js";

export interface DocumentRow {
  content: string;
  source_url: string;
  embedding_768: string;
  embedding_3072: string;
}

export type MatchDocumentsRpc = "match_documents_768" | "match_documents_3072";

export interface SearchMatch {
  id: number;
  content: string;
  sourceUrl: string;
  similarity: number;
}

export interface SupabaseClient {
  insertDocuments(rows: readonly DocumentRow[]): Promise<void>;
  deleteDocumentsForSourceUrls(urls: readonly string[]): Promise<void>;
  countDocuments(): Promise<number>;
  countDocumentsWithMissingEmbeddings(): Promise<number>;
  matchDocuments(rpc: MatchDocumentsRpc, queryEmbedding: readonly number[], matchCount: number): Promise<SearchMatch[]>;
}

const INSERT_BATCH_SIZE = 100;

async function request(
  fetchImpl: FetchLike,
  url: string,
  serviceRoleKey: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: HTTP ${response.status} ${response.statusText}`);
  }

  return response;
}

export function createSupabaseClient(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchImpl: FetchLike = fetch,
): SupabaseClient {
  const documentsUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/documents`;

  async function selectIds(query: string): Promise<number[]> {
    const response = await request(fetchImpl, `${documentsUrl}?${query}`, serviceRoleKey, {
      headers: { "accept-profile": "public" },
    });
    const rows = (await response.json()) as { id: number }[];
    return rows.map((r) => r.id);
  }

  return {
    async insertDocuments(rows) {
      for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        await request(fetchImpl, documentsUrl, serviceRoleKey, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            prefer: "return=minimal",
          },
          body: JSON.stringify(batch),
        });
      }
    },

    async deleteDocumentsForSourceUrls(urls) {
      if (urls.length === 0) return;
      const values = urls.map((u) => encodeURIComponent(`"${u}"`)).join(",");
      await request(fetchImpl, `${documentsUrl}?source_url=in.(${values})`, serviceRoleKey, {
        method: "DELETE",
        headers: { prefer: "return=minimal" },
      });
    },

    async countDocuments() {
      const ids = await selectIds("select=id");
      return ids.length;
    },

    async countDocumentsWithMissingEmbeddings() {
      const ids = await selectIds("select=id&or=(embedding_768.is.null,embedding_3072.is.null)");
      return ids.length;
    },

    async matchDocuments(rpc, queryEmbedding, matchCount) {
      const response = await request(
        fetchImpl,
        `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${rpc}`,
        serviceRoleKey,
        {
          method: "POST",
          headers: { "content-type": "application/json", "accept-profile": "public" },
          body: JSON.stringify({
            query_embedding: `[${queryEmbedding.join(",")}]`,
            match_count: matchCount,
          }),
        },
      );

      const rows = (await response.json()) as {
        id: number;
        content: string;
        source_url: string;
        similarity: number;
      }[];

      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        sourceUrl: r.source_url,
        similarity: r.similarity,
      }));
    },
  };
}
