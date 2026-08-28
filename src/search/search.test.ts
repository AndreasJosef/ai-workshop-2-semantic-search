import { describe, expect, it, vi } from "vitest";

import type { Embed } from "../kb/embeddings.js";
import type { SearchMatch, SupabaseClient } from "../kb/supabase.js";
import { searchDocuments } from "./search.js";

const RPC_ROW: SearchMatch = {
  id: 1,
  content: "The One Power is the force that drives the Wheel of Time.",
  sourceUrl: "https://wot.fandom.com/wiki/One_Power",
  score: 0.91,
};

function fakeEmbed(): Embed {
  return vi.fn(async (texts: readonly string[]) => texts.map(() => [0.1, 0.2]));
}

function fakeDb(rows: SearchMatch[] = [RPC_ROW]): Pick<SupabaseClient, "matchDocuments"> {
  return {
    matchDocuments: vi.fn(async () => rows),
  };
}

describe("searchDocuments", () => {
  it("embeds the query at the requested dimension and calls the matching RPC", async () => {
    const embed = fakeEmbed();
    const db = fakeDb();

    const results = await searchDocuments("the one power", 768, { embed, db });

    expect(embed).toHaveBeenCalledWith(["the one power"], 768);
    expect(db.matchDocuments).toHaveBeenCalledWith({ rpc: "match_documents_768", queryEmbedding: [0.1, 0.2] }, 5);
    expect(results).toEqual([RPC_ROW]);
  });

  it("selects the 3072 RPC when searching at 3072 dimensions", async () => {
    const embed = fakeEmbed();
    const db = fakeDb();

    await searchDocuments("tel'aran'rhiod", 3072, { embed, db });

    expect(embed).toHaveBeenCalledWith(["tel'aran'rhiod"], 3072);
    expect(db.matchDocuments).toHaveBeenCalledWith({ rpc: "match_documents_3072", queryEmbedding: [0.1, 0.2] }, 5);
  });

  it("does not embed and passes the raw query text when searching in keyword mode", async () => {
    const embed = fakeEmbed();
    const db = fakeDb();

    const results = await searchDocuments("the one power", "keyword", { embed, db });

    expect(embed).not.toHaveBeenCalled();
    expect(db.matchDocuments).toHaveBeenCalledWith({ rpc: "match_documents_keyword", queryText: "the one power" }, 5);
    expect(results).toEqual([RPC_ROW]);
  });

  it("returns the configured number of matches", async () => {
    const embed = fakeEmbed();
    const db = fakeDb();

    await searchDocuments("the one power", 768, { embed, db }, { matchCount: 3 });

    expect(db.matchDocuments).toHaveBeenCalledWith({ rpc: "match_documents_768", queryEmbedding: [0.1, 0.2] }, 3);
  });

  it("throws when the embedder returns no vector for the query", async () => {
    const embed: Embed = async () => [];
    const db = fakeDb();

    await expect(searchDocuments("the one power", 768, { embed, db })).rejects.toThrow(
      /expected 1 vector/,
    );
    expect(db.matchDocuments).not.toHaveBeenCalled();
  });
});