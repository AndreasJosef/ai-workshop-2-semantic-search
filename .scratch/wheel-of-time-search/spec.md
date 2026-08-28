# Spec: Wheel of Time Semantic Search

Status: ready-for-agent

## Goal

Build Alternativ A of the workshop (semantic search over a knowledge base) in this from-scratch repo: chunk Wheel of Time Fandom wiki content, embed it, store in Supabase/pgvector, and serve a small web search UI. Scoped as a quick, single-day build — core required steps only, no stretch extras.

## Decisions

- **Alternative**: A (semantic search), not B (recommendations).
- **Domain/content source**: The Wheel of Time Fandom wiki (`wot.fandom.com`), CC BY-SA licensed. Chosen over Coppermind (the actual Cosmere wiki), which is CC BY-NC-ND and explicitly opts out of AI/derivative use — see [ADR-0002](../../docs/adr/0002-wheel-of-time-over-coppermind.md) and the full dataset research at [.scratch/knowledge-base-dataset/research.md](../knowledge-base-dataset/research.md).
- **Corpus scope**: A curated subset, not the full 6,563 articles — pick a deliberate mix across characters, locations, the magic system, factions/nations, and book synopses. Exact page list is an implementation-time choice, not pinned here.
- **Chunking**: Split each article along its own section headers first (one semantic thought per chunk, per the article authors' own structure); fall back to fixed-size splitting (200–400 tokens, 50–100 overlap, per the README) only for sections that run long. Content arrives as wikitext (no `extracts` clean-text shortcut on this wiki, per research) — needs template/link stripping before chunking.
- **Schema**: One `documents` table, one row per chunk, with both `embedding_768 vector(768)` and `embedding_3072 vector(3072)` columns (not two separate tables) — see [ADR-0001](../../docs/adr/0001-single-table-dual-embedding-columns.md). Two RPC functions (e.g. `match_documents_768`, `match_documents_3072`), each ordering by its own column.
- **Embedding provider**: Gemini (`gemini-embedding-001`), called via OpenRouter's OpenAI-compatible `/embeddings` endpoint (`OPENROUTER_API_KEY`), using its `dimensions` parameter to produce both 768 and 3072 from the same model — not Google's direct Gemini API as originally planned, since the provisioned `GEMINI_API_KEY` stopped working; see [ADR-0003](../../docs/adr/0003-openrouter-proxy-for-gemini-embeddings.md).
- **Pipeline language**: Node.js/TypeScript.
- **UI**: A small web app — query input, 5 results per query (content snippet, similarity score, source-article link for CC BY-SA attribution), likely a 768/3072 toggle to support the required comparison task.
- **Scope**: Core required steps only (ingest, dual-dimension search, document 5 queries whose results differ across dimensions). The README's "Extra" stretch goals (add-new-text endpoint, LLM chat layer) are explicitly out of scope for now.
- **Environment**: No Supabase project exists yet — creating one (with the `vector` extension enabled) and populating `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `OPENROUTER_API_KEY`) is a prerequisite step before the pipeline can actually run.

## Not yet decided (left to implementation judgment)

- Exact list of WoT wiki pages/categories for the curated subset.
- Specific Node tooling for the tiny web app — deliberately unspecified; pick the simplest thing that works for a one-day build.

## References

- [CONTEXT.md](../../CONTEXT.md) — domain glossary (Document, Knowledge Base)
- [ADR-0001](../../docs/adr/0001-single-table-dual-embedding-columns.md) — dual-dimension schema shape
- [ADR-0002](../../docs/adr/0002-wheel-of-time-over-coppermind.md) — content-source license swap
- [Dataset research](../knowledge-base-dataset/research.md) — full primary-source findings
