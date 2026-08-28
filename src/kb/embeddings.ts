import type { FetchLike } from "../corpus/api.js";

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

export const EMBEDDING_MODEL = "google/gemini-embedding-001";

export type EmbedDimensions = 768 | 3072;

export type Embed = (texts: readonly string[], dimensions: EmbedDimensions) => Promise<number[][]>;

interface EmbeddingsResponse {
  data?: { index?: number; embedding?: number[] }[];
}

export function createOpenRouterEmbedder(apiKey: string, fetchImpl: FetchLike = fetch): Embed {
  return async (texts, dimensions) => {
    const response = await fetchImpl(OPENROUTER_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: [...texts],
        dimensions,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: HTTP ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as EmbeddingsResponse;
    const vectors = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (vectors.length !== texts.length) {
      throw new Error(`Embedding response mismatch: expected ${texts.length} vectors, got ${vectors.length}`);
    }

    if (vectors.some((entry, i) => entry.index !== i)) {
      throw new Error("Embedding response mismatch: expected indices to be 0..n-1 with no duplicates");
    }

    return vectors.map((entry) => {
      const embedding = entry.embedding;

      if (!embedding || embedding.length !== dimensions) {
        throw new Error(
          `Embedding response mismatch: expected ${dimensions} dimensions, got ${embedding?.length ?? 0}`,
        );
      }

      return embedding;
    });
  };
}
