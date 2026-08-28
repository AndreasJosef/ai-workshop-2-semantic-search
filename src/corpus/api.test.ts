import { describe, expect, it, vi } from "vitest";

import { fetchWikitext } from "./api.js";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const PAGE_RESPONSE = {
  batchcomplete: "",
  query: {
    pages: {
      "161": {
        pageid: 161,
        ns: 0,
        title: "Rand al'Thor",
        revisions: [
          {
            slots: {
              main: { contentmodel: "wikitext", contentformat: "text/x-wiki", "*": "{{character}}\nLead." },
            },
          },
        ],
      },
    },
  },
};

describe("fetchWikitext", () => {
  it("returns the wikitext of the requested page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE_RESPONSE));

    const wikitext = await fetchWikitext("Rand al'Thor", fetchMock);

    expect(wikitext).toBe("{{character}}\nLead.");
  });

  it("sends the MediaWiki revisions query with a descriptive user agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE_RESPONSE));

    await fetchWikitext("Tar Valon", fetchMock);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://wot.fandom.com");
    expect(parsed.pathname).toBe("/api.php");
    expect(parsed.searchParams.get("action")).toBe("query");
    expect(parsed.searchParams.get("prop")).toBe("revisions");
    expect(parsed.searchParams.get("rvprop")).toBe("content");
    expect(parsed.searchParams.get("rvslots")).toBe("main");
    expect(parsed.searchParams.get("redirects")).toBe("1");
    expect(parsed.searchParams.get("titles")).toBe("Tar Valon");
    expect(new Headers(init.headers).get("user-agent")).toContain("WheelOfTimeSemanticSearch");
  });

  it("throws for a missing page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ batchcomplete: "", query: { pages: { "-1": { ns: 0, title: "Nope", missing: true } } } }),
    );

    await expect(fetchWikitext("Nope", fetchMock)).rejects.toThrow(/missing/i);
  });

  it("throws when the API response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));

    await expect(fetchWikitext("Anything", fetchMock)).rejects.toThrow(/HTTP 500/);
  });
});
