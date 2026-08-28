import { describe, expect, it, vi } from "vitest";

import type { Chunk } from "../corpus/chunker.js";
import type { Embed } from "./embeddings.js";
import { storeChunks, type SupabaseStore } from "./store.js";

function chunk(content: string, articleTitle: string, chunkIndex: number): Chunk {
  return {
    content,
    metadata: {
      articleTitle,
      sectionHeading: "Biography",
      sourceUrl: `https://wot.fandom.com/wiki/${articleTitle.replaceAll(" ", "_")}`,
      chunkIndex,
    },
  };
}

function fakeEmbed(vectors: number[][]): Embed {
  return vi.fn(async (texts: readonly string[]) => texts.map(() => vectors[0]!));
}

function fakeDb(): SupabaseStore {
  return {
    insertDocuments: vi.fn(async () => undefined),
    deleteDocumentsForSourceUrls: vi.fn(async () => undefined),
  };
}

describe("storeChunks", () => {
  it("embeds each chunk at both dimensions and builds one row per chunk", async () => {
    const embed = fakeEmbed([[0.1, 0.2]]);
    const db = fakeDb();
    const chunks = [chunk("First chunk.", "One Power", 0), chunk("Second chunk.", "One Power", 1)];

    const result = await storeChunks(chunks, embed, db);

    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed).toHaveBeenNthCalledWith(1, ["First chunk.", "Second chunk."], 768);
    expect(embed).toHaveBeenNthCalledWith(2, ["First chunk.", "Second chunk."], 3072);

    const rows = vi.mocked(db.insertDocuments).mock.calls[0]![0];
    expect(rows).toEqual([
      {
        content: "First chunk.",
        source_url: "https://wot.fandom.com/wiki/One_Power",
        embedding_768: "[0.1,0.2]",
        embedding_3072: "[0.1,0.2]",
      },
      {
        content: "Second chunk.",
        source_url: "https://wot.fandom.com/wiki/One_Power",
        embedding_768: "[0.1,0.2]",
        embedding_3072: "[0.1,0.2]",
      },
    ]);
    expect(result).toEqual({ stored: 2, articles: 1 });
  });

  it("deletes existing rows for the covered articles before inserting (idempotent re-run)", async () => {
    const embed = fakeEmbed([[0.1]]);
    const db = fakeDb();
    const chunks = [chunk("A.", "One Power", 0), chunk("B.", "Rand al'Thor", 0)];

    await storeChunks(chunks, embed, db);

    expect(db.deleteDocumentsForSourceUrls).toHaveBeenCalledWith([
      "https://wot.fandom.com/wiki/One_Power",
      "https://wot.fandom.com/wiki/Rand_al'Thor",
    ]);
    const order = vi
      .mocked(db.deleteDocumentsForSourceUrls)
      .mock.invocationCallOrder[0]!;
    expect(order).toBeLessThan(vi.mocked(db.insertDocuments).mock.invocationCallOrder[0]!);
  });

  it("embeds in batches of the configured size", async () => {
    const embed = fakeEmbed([[0.1]]);
    const db = fakeDb();
    const chunks = Array.from({ length: 5 }, (_, i) => chunk(`chunk ${i}`, "One Power", i));

    await storeChunks(chunks, embed, db, { batchSize: 2 });

    expect(embed).toHaveBeenCalledTimes(6); // 3 batches × 2 dimensions
    expect(vi.mocked(embed).mock.calls[0]![0]).toEqual(["chunk 0", "chunk 1"]);
    expect(vi.mocked(embed).mock.calls[0]![1]).toBe(768);
    expect(vi.mocked(embed).mock.calls[1]![0]).toEqual(["chunk 0", "chunk 1"]);
    expect(vi.mocked(embed).mock.calls[1]![1]).toBe(3072);
    expect(vi.mocked(embed).mock.calls[5]![0]).toEqual(["chunk 4"]);
  });

  it("leaves the table untouched when embedding fails", async () => {
    const embed: Embed = async () => {
      throw new Error("Embedding request failed: HTTP 429");
    };
    const db = fakeDb();
    const chunks = [chunk("A.", "One Power", 0)];

    await expect(storeChunks(chunks, embed, db)).rejects.toThrow(/HTTP 429/);
    expect(db.deleteDocumentsForSourceUrls).not.toHaveBeenCalled();
    expect(db.insertDocuments).not.toHaveBeenCalled();
  });

  it("handles an empty chunk list without touching the database", async () => {
    const embed = fakeEmbed([[0.1]]);
    const db = fakeDb();

    const result = await storeChunks([], embed, db);

    expect(result).toEqual({ stored: 0, articles: 0 });
    expect(db.deleteDocumentsForSourceUrls).not.toHaveBeenCalled();
    expect(db.insertDocuments).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
  });
});
