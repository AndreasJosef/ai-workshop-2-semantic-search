import { describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../corpus/api.js";
import {
  createSupabaseClient,
  type DocumentRow,
} from "./supabase.js";

const URL = "https://example.supabase.co";
const KEY = "service-role-key";

function stubFetch(handler: (input: string, init?: RequestInit) => unknown): FetchLike {
  return vi.fn(async (input: string, init?: RequestInit) => {
    handler(input, init);
    return { ok: true, status: 200, json: async () => [] } as unknown as Response;
  });
}

function row(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    content: "chunk text",
    source_url: "https://wot.fandom.com/wiki/Rand_al%27Thor",
    embedding_768: "[0.1,0.2]",
    embedding_3072: "[0.3,0.4]",
    ...overrides,
  };
}

describe("createSupabaseClient", () => {
  it("inserts rows into documents with service-role auth", async () => {
    const fetchImpl = stubFetch(() => undefined);
    const db = createSupabaseClient(URL, KEY, fetchImpl);

    await db.insertDocuments([row()]);

    const [input, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(input).toBe(`${URL}/rest/v1/documents`);
    expect(init.headers).toMatchObject({
      apikey: KEY,
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    });
    expect(JSON.parse(init.body as string)).toEqual([row()]);
  });

  it("inserts in batches of at most 100 rows", async () => {
    const fetchImpl = stubFetch(() => undefined);
    const db = createSupabaseClient(URL, KEY, fetchImpl);

    await db.insertDocuments(Array.from({ length: 250 }, (_, i) => row({ content: `chunk ${i}` })));

    const calls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    expect(calls).toHaveLength(3);
    expect(JSON.parse(calls[0]![1].body as string)).toHaveLength(100);
    expect(JSON.parse(calls[1]![1].body as string)).toHaveLength(100);
    expect(JSON.parse(calls[2]![1].body as string)).toHaveLength(50);
  });

  it("deletes existing rows for the given source urls", async () => {
    const fetchImpl = stubFetch(() => undefined);
    const db = createSupabaseClient(URL, KEY, fetchImpl);

    await db.deleteDocumentsForSourceUrls(["https://wot.fandom.com/wiki/A", "https://wot.fandom.com/wiki/B"]);

    const [input, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(input).toContain(`${URL}/rest/v1/documents?`);
    expect(decodeURIComponent(input)).toContain(
      'source_url=in.("https://wot.fandom.com/wiki/A","https://wot.fandom.com/wiki/B")',
    );
    expect(init.method).toBe("DELETE");
  });

  it("counts documents with a missing embedding via a filtered select", async () => {
    const fetchImpl = vi.fn(async () =>
      ({ ok: true, status: 200, json: async () => [{ id: 1 }, { id: 2 }] }) as unknown as Response,
    );
    const db = createSupabaseClient(URL, KEY, fetchImpl);

    const count = await db.countDocumentsWithMissingEmbeddings();

    expect(count).toBe(2);
    const [input] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(decodeURIComponent(input)).toContain("or=(embedding_768.is.null,embedding_3072.is.null)");
    expect(decodeURIComponent(input)).toContain("select=id");
  });

  it("counts all documents", async () => {
    const fetchImpl = vi.fn(async () =>
      ({ ok: true, status: 200, json: async () => [{ id: 1 }, { id: 2 }, { id: 3 }] }) as unknown as Response,
    );
    const db = createSupabaseClient(URL, KEY, fetchImpl);

    const count = await db.countDocuments();

    expect(count).toBe(3);
    const [input] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(decodeURIComponent(input)).toContain("select=id");
  });

  it("rejects with the HTTP status on failure", async () => {
    const fetchImpl: FetchLike = async () =>
      ({ ok: false, status: 401, statusText: "Unauthorized" }) as unknown as Response;
    const db = createSupabaseClient(URL, KEY, fetchImpl);

    await expect(db.insertDocuments([row()])).rejects.toThrow(/HTTP 401/);
  });
});
