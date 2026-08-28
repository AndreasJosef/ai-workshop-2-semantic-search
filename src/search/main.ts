import { requiredEnv } from "../env.js";
import { createOpenRouterEmbedder } from "../kb/embeddings.js";
import { createSupabaseClient } from "../kb/supabase.js";
import { searchDocuments } from "./search.js";
import { createSearchServer } from "./server.js";

const DEFAULT_PORT = 3000;

function main(): void {
  const openRouterApiKey = requiredEnv("OPENROUTER_API_KEY");
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseServiceRole = requiredEnv("SUPABASE_SERVICE_ROLE");
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  const embed = createOpenRouterEmbedder(openRouterApiKey);
  const db = createSupabaseClient(supabaseUrl, supabaseServiceRole);
  const server = createSearchServer({
    search: (query, mode) => searchDocuments(query, mode, { embed, db }),
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop whatever is using it, or set PORT to a different value.`);
    } else {
      console.error(`Failed to start server: ${error.message}`);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Wheel of Time semantic search listening on http://localhost:${port}`);
  });
}

main();