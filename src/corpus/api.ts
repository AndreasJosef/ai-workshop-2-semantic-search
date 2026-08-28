const API_ORIGIN = "https://wot.fandom.com/api.php";
const WIKI_BASE_URL = "https://wot.fandom.com/wiki";
const USER_AGENT =
  "WheelOfTimeSemanticSearch/0.1 (workshop project; contact: repo owner)";

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

interface RevisionSlot {
  "*": string;
}

interface Revision {
  slots?: { main?: RevisionSlot };
}

interface Page {
  title?: string;
  missing?: boolean;
  revisions?: Revision[];
}

interface QueryResponse {
  query?: { pages?: Record<string, Page> };
}

export async function fetchWikitext(title: string, fetchImpl: FetchLike = fetch): Promise<string> {
  const url = new URL(API_ORIGIN);

  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "1");

  const response = await fetchImpl(url.toString(), {
    headers: { "user-agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch "${title}": HTTP ${response.status}`);
  }

  const body = (await response.json()) as QueryResponse;
  const pages = Object.values(body.query?.pages ?? {});
  const page = pages[0];

  if (!page || page.missing) {
    throw new Error(`Page missing on wot.fandom.com: "${title}"`);
  }

  const wikitext = page.revisions?.[0]?.slots?.main?.["*"];

  if (wikitext === undefined) {
    throw new Error(`No wikitext revision found for "${title}"`);
  }

  return wikitext;
}

export function sourceUrlFor(title: string): string {
  return `${WIKI_BASE_URL}/${encodeURIComponent(title.replaceAll(" ", "_")).replace(/'/g, "%27")}`;
}
