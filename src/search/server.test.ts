import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { EmbedDimensions } from "../kb/embeddings.js";
import type { SearchMatch } from "../kb/supabase.js";
import { createSearchServer } from "./server.js";

const RESULT: SearchMatch = {
  id: 1,
  content: "The One Power is the force that drives the Wheel of Time.",
  sourceUrl: "https://wot.fandom.com/wiki/One_Power",
  similarity: 0.91,
};

describe("createSearchServer", () => {
  let baseUrl: string;
  let close: () => Promise<void>;
  const search = vi.fn(async (_query: string, _dimensions: EmbedDimensions) => [RESULT]);

  beforeAll(async () => {
    const server = createSearchServer({ search });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
    close = () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  afterAll(async () => {
    await close();
  });

  it("returns top matches as JSON for a valid query and dimension", async () => {
    const response = await fetch(`${baseUrl}/api/search?q=one%20power&dim=768`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as { results: SearchMatch[] };
    expect(body.results).toEqual([RESULT]);
    expect(search).toHaveBeenCalledWith("one power", 768);
  });

  it("passes the 3072 dimension through to the search", async () => {
    await fetch(`${baseUrl}/api/search?q=rand&dim=3072`);

    expect(search).toHaveBeenCalledWith("rand", 3072);
  });

  it("rejects a request without a query string", async () => {
    const response = await fetch(`${baseUrl}/api/search?dim=768`);

    expect(response.status).toBe(400);
  });

  it("rejects a dimension that is neither 768 nor 3072", async () => {
    const response = await fetch(`${baseUrl}/api/search?q=rand&dim=1536`);

    expect(response.status).toBe(400);
    expect(search).not.toHaveBeenCalledWith("rand", 1536);
  });

  it("returns error JSON when the search fails", async () => {
    const failingSearch = vi.fn(async () => {
      throw new Error("Embedding request failed: HTTP 429");
    });
    const server = createSearchServer({ search: failingSearch });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/search?q=rand&dim=768`);
      expect(response.status).toBe(500);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("HTTP 429");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it("serves the UI page at /", async () => {
    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("search");
  });

  it("returns 404 for unknown paths", async () => {
    const response = await fetch(`${baseUrl}/nope`);

    expect(response.status).toBe(404);
  });
});