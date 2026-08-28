import type { Chunk } from "../corpus/chunker.js";
import type { Embed } from "./embeddings.js";
import type { DocumentRow } from "./supabase.js";

export interface SupabaseStore {
  insertDocuments(rows: readonly DocumentRow[]): Promise<void>;
  deleteDocumentsForSourceUrls(urls: readonly string[]): Promise<void>;
}

export interface StoreResult {
  stored: number;
  articles: number;
}

const DEFAULT_BATCH_SIZE = 64;

function toPgvectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export async function storeChunks(
  chunks: readonly Chunk[],
  embed: Embed,
  db: SupabaseStore,
  options: { batchSize?: number } = {},
): Promise<StoreResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  if (chunks.length === 0) {
    return { stored: 0, articles: 0 };
  }

  const sourceUrls = [...new Set(chunks.map((c) => c.metadata.sourceUrl))];

  const rows: DocumentRow[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const contents = batch.map((c) => c.content);
    const [vectors768, vectors3072] = await Promise.all([
      embed(contents, 768),
      embed(contents, 3072),
    ]);

    for (let j = 0; j < batch.length; j++) {
      rows.push({
        content: batch[j]!.content,
        source_url: batch[j]!.metadata.sourceUrl,
        embedding_768: toPgvectorLiteral(vectors768[j]!),
        embedding_3072: toPgvectorLiteral(vectors3072[j]!),
      });
    }
  }

  await db.deleteDocumentsForSourceUrls(sourceUrls);
  await db.insertDocuments(rows);

  return { stored: rows.length, articles: sourceUrls.length };
}
