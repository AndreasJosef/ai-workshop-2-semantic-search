import { CURATED_PAGES } from "../corpus/pages.js";
import { runPipeline } from "../corpus/pipeline.js";
import { createOpenRouterEmbedder } from "./embeddings.js";
import { createSupabaseClient } from "./supabase.js";
import { storeChunks } from "./store.js";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main(): Promise<void> {
  const openRouterApiKey = requiredEnv("OPENROUTER_API_KEY");
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseServiceRole = requiredEnv("SUPABASE_SERVICE_ROLE");

  console.log(`Fetching ${CURATED_PAGES.length} pages from wot.fandom.com...`);
  const { chunks, failures } = await runPipeline(CURATED_PAGES);

  if (failures.length > 0) {
    for (const { title, reason } of failures) {
      console.error(`FAILED: ${title} — ${reason}`);
    }
  }

  console.log(`Embedding and storing ${chunks.length} chunks...`);
  const embed = createOpenRouterEmbedder(openRouterApiKey);
  const db = createSupabaseClient(supabaseUrl, supabaseServiceRole);
  const { stored, articles } = await storeChunks(chunks, embed, db);

  const total = await db.countDocuments();
  const missingEmbeddings = await db.countDocumentsWithMissingEmbeddings();

  console.log(`\nStored ${stored} rows for ${articles} source articles.`);
  console.log(`documents table now holds ${total} rows.`);
  console.log(`Rows with a missing embedding: ${missingEmbeddings}`);

  if (failures.length > 0 || missingEmbeddings > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
