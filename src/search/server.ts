import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { SearchMode } from "./search.js";
import type { SearchMatch } from "../kb/supabase.js";

export interface SearchServerDeps {
  search: (query: string, mode: SearchMode) => Promise<SearchMatch[]>;
}

const INDEX_HTML_PATH = fileURLToPath(new URL("./index.html", import.meta.url));

function parseMode(raw: string | null): SearchMode | undefined {
  if (raw === "768") return 768;
  if (raw === "3072") return 3072;
  if (raw === "keyword") return "keyword";
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function handleSearchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: SearchServerDeps,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const query = url.searchParams.get("q")?.trim();
  const mode = parseMode(url.searchParams.get("dim"));

  if (!query) {
    sendJson(res, 400, { error: "Missing required query parameter: q" });
    return;
  }

  if (!mode) {
    sendJson(res, 400, { error: "Query parameter dim must be 768, 3072, or keyword" });
    return;
  }

  try {
    const results = await deps.search(query, mode);
    sendJson(res, 200, { query, mode, results });
  } catch (error) {
    sendJson(res, 500, { error: errorMessage(error) });
  }
}

export function createSearchServer(deps: SearchServerDeps): Server {
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;

      if (path === "/api/search") {
        await handleSearchRequest(req, res, deps);
        return;
      }

      if (path === "/" || path === "/index.html") {
        const html = await readFile(INDEX_HTML_PATH, "utf8");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      sendJson(res, 500, { error: errorMessage(error) });
    }
  });
}