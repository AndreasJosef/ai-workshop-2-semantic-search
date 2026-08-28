import { fetchWikitext } from "./api.js";
import { chunkSection, type Chunk } from "./chunker.js";
import { cleanWikitext } from "./wikitext.js";
import { splitSections } from "./sections.js";

export type FetchPage = (title: string) => Promise<string>;

export interface PipelineResult {
  chunks: Chunk[];
  failures: { title: string; reason: string }[];
}

export async function runPipeline(
  pages: readonly string[],
  fetchPage: FetchPage = (title) => fetchWikitext(title),
): Promise<PipelineResult> {
  const chunks: Chunk[] = [];
  const failures: { title: string; reason: string }[] = [];

  for (const title of pages) {
    try {
      const wikitext = await fetchPage(title);
      const prose = cleanWikitext(wikitext);
      const sections = splitSections(prose);

      for (const section of sections) {
        chunks.push(...chunkSection(section, title));
      }
    } catch (error) {
      failures.push({
        title,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { chunks, failures };
}
