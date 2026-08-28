import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { estimateTokens } from "./chunker.js";
import { CURATED_PAGES } from "./pages.js";
import { runPipeline } from "./pipeline.js";

const OUTPUT_PATH = path.resolve("data/chunks.jsonl");

async function main(): Promise<void> {
  console.log(`Fetching ${CURATED_PAGES.length} pages from wot.fandom.com...`);

  const { chunks, failures } = await runPipeline(CURATED_PAGES);

  if (failures.length > 0) {
    for (const { title, reason } of failures) {
      console.error(`FAILED: ${title} — ${reason}`);
    }
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const jsonl = chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + "\n";
  await writeFile(OUTPUT_PATH, jsonl, "utf8");

  const totalTokens = chunks.reduce((sum, c) => sum + estimateTokens(c.content), 0);
  const perArticle = new Map<string, number>();
  for (const chunk of chunks) {
    perArticle.set(chunk.metadata.articleTitle, (perArticle.get(chunk.metadata.articleTitle) ?? 0) + 1);
  }

  console.log(`\nWrote ${chunks.length} chunks to ${OUTPUT_PATH}`);
  console.log(`Estimated tokens: ${totalTokens} (avg ${Math.round(totalTokens / chunks.length)}/chunk)`);
  console.log("\nChunks per article:");
  for (const [title, count] of perArticle) {
    console.log(`  ${count.toString().padStart(3)}  ${title}`);
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
