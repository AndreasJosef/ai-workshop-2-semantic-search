import { describe, expect, it, vi } from "vitest";

import { fetchWikitext, type FetchLike } from "./api.js";
import { runPipeline, type FetchPage } from "./pipeline.js";
import { CURATED_PAGES } from "./pages.js";

const WIKITEXTS: Record<string, string> = {
  "Rand al'Thor":
    "Lead about Rand.\n\n== Biography ==\nRand was born in the Two Rivers.\n\n== Powers ==\nHe can channel saidin.",
  "One Power": "The One Power is drawn from the True Source.",
};

function stubFetchPage(wikitexts: Record<string, string>): FetchPage {
  return vi.fn(async (title: string) => {
    const wikitext = wikitexts[title];

    if (!wikitext) throw new Error(`Failed to fetch "${title}": HTTP 500`);

    return wikitext;
  });
}

function stubFetchResponse(wikitexts: Record<string, string>): FetchLike {
  return async (input: string) => {
    const title = new URL(input).searchParams.get("titles") ?? "";
    const wikitext = wikitexts[title];

    if (!wikitext) {
      return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        query: {
          pages: {
            "1": { title, revisions: [{ slots: { main: { "*": wikitext } } }] },
          },
        },
      }),
    } as unknown as Response;
  };
}

describe("runPipeline", () => {
  it("fetches, cleans, sections, and chunks each curated page", async () => {
    const { chunks } = await runPipeline(["Rand al'Thor", "One Power"], stubFetchPage(WIKITEXTS));

    expect(chunks).toHaveLength(4);
    expect(chunks.map((c) => c.metadata.articleTitle)).toEqual([
      "Rand al'Thor",
      "Rand al'Thor",
      "Rand al'Thor",
      "One Power",
    ]);
    expect(chunks[0]?.content).toBe("Lead about Rand.");
    expect(chunks[1]?.metadata.sectionHeading).toBe("Biography");
    expect(chunks[2]?.content).toBe("He can channel saidin.");
    expect(chunks[3]?.metadata.sourceUrl).toBe("https://wot.fandom.com/wiki/One_Power");
  });

  it("continues past a page that fails and reports it", async () => {
    const { chunks, failures } = await runPipeline(
      ["Broken Page", "One Power"],
      stubFetchPage({ "One Power": "Fine prose here." }),
    );

    expect(chunks).toHaveLength(1);
    expect(failures).toEqual([
      { title: "Broken Page", reason: expect.stringMatching(/HTTP 500/) },
    ]);
  });

  it("covers every curated page with the same fetch interface", async () => {
    const { chunks, failures } = await runPipeline(
      CURATED_PAGES,
      stubFetchPage(Object.fromEntries(CURATED_PAGES.map((title) => [title, "Stub lead.\n\n== Section ==\nStub body."]))),
    );

    expect(failures).toEqual([]);
    expect(chunks.length).toBeGreaterThanOrEqual(CURATED_PAGES.length);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(CURATED_PAGES).toContain(chunk.metadata.articleTitle);
    }
  });

  it("passes each page title to the fetcher", async () => {
    const fetchPage = stubFetchPage({ "One Power": "Lead." });
    await runPipeline(["One Power"], fetchPage);

    expect(fetchPage).toHaveBeenCalledWith("One Power");
  });
});

describe("runPipeline with the real fetchWikitext", () => {
  it("works end to end through the FetchLike interface", async () => {
    const { chunks } = await runPipeline(
      ["One Power"],
      (title) => fetchWikitext(title, stubFetchResponse({ "One Power": "The One Power text." })),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("The One Power text.");
  });
});
