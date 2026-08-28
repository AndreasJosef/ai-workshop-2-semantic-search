import { describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../corpus/api.js";
import { EMBEDDING_MODEL, createOpenRouterEmbedder } from "./embeddings.js";

function stubFetchResponse(vectors: number[][]): FetchLike {
  return async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        data: vectors.map((embedding, index) => ({ index, embedding })),
      }),
    }) as unknown as Response;
}

describe("createOpenRouterEmbedder", () => {
  it("posts the model, inputs, and requested dimensions to OpenRouter's embeddings endpoint", async () => {
    const fetchImpl = vi.fn(
      stubFetchResponse([Array(768).fill(0.1), Array(768).fill(0.2)]),
    );
    const embed = createOpenRouterEmbedder("test-key", fetchImpl);

    await embed(["first text", "second text"], 768);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/embeddings");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      authorization: "Bearer test-key",
      "content-type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: EMBEDDING_MODEL,
      input: ["first text", "second text"],
      dimensions: 768,
    });
  });

  it("returns vectors in input order regardless of response index order", async () => {
    const fetchImpl: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { index: 1, embedding: Array(768).fill(0.3) },
            { index: 0, embedding: Array(768).fill(0.1) },
          ],
        }),
      }) as unknown as Response;
    const embed = createOpenRouterEmbedder("test-key", fetchImpl);

    const vectors = await embed(["first", "second"], 768);

    expect(vectors).toEqual([Array(768).fill(0.1), Array(768).fill(0.3)]);
  });

  it("rejects when the response omits a vector", async () => {
    const fetchImpl: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ index: 0, embedding: Array(768).fill(0.1) }] }),
      }) as unknown as Response;
    const embed = createOpenRouterEmbedder("test-key", fetchImpl);

    await expect(embed(["first", "second"], 768)).rejects.toThrow(/expected 2 vectors, got 1/);
  });

  it("rejects when a returned vector has the wrong length", async () => {
    const fetchImpl = stubFetchResponse([[0.1, 0.2]]);
    const embed = createOpenRouterEmbedder("test-key", fetchImpl);

    await expect(embed(["first"], 768)).rejects.toThrow(/expected 768 dimensions, got 2/);
  });

  it("rejects when response indices are not a permutation of 0..n-1", async () => {
    const fetchImpl: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { index: 0, embedding: Array(768).fill(0.1) },
            { index: 0, embedding: Array(768).fill(0.2) },
          ],
        }),
      }) as unknown as Response;
    const embed = createOpenRouterEmbedder("test-key", fetchImpl);

    await expect(embed(["first", "second"], 768)).rejects.toThrow(/indices/);
  });

  it("rejects with the HTTP status when the request fails", async () => {
    const fetchImpl: FetchLike = async () =>
      ({ ok: false, status: 429, statusText: "Too Many Requests" }) as unknown as Response;
    const embed = createOpenRouterEmbedder("test-key", fetchImpl);

    await expect(embed(["first"], 768)).rejects.toThrow(/HTTP 429/);
  });
});
