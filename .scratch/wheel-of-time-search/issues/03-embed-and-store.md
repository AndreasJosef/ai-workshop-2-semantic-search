# 03: Embed & store pipeline

**What to build:** Running the pipeline takes the chunks produced in ticket 02 and populates the `documents` table from ticket 01, so the knowledge base actually exists in Supabase with both embedding dimensions filled in.

**Blocked by:** 01 (Provision Supabase project & dual-embedding schema), 02 (Corpus fetch, clean & chunk pipeline)

**Status:** ready-for-agent

- [ ] Each chunk from ticket 02 is embedded via `gemini-embedding-001` through OpenRouter's `/embeddings` endpoint (`OPENROUTER_API_KEY`, not `GEMINI_API_KEY` — see [ADR-0003](../../../docs/adr/0003-openrouter-proxy-for-gemini-embeddings.md)), called twice with `dimensions` set to 768 and to 3072 respectively (same source content, two representations)
- [ ] Each chunk is upserted into `documents` as one row: content, both embedding columns, and the source-article pointer
- [ ] Running the full pipeline end-to-end (curated page list → fetch → clean → chunk → embed → store) leaves the `documents` table populated with rows spanning multiple source articles
- [ ] Querying the table directly confirms both `embedding_768` and `embedding_3072` are non-null for every row
