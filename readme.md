# Wheel of Time Semantic Search

Semantic search over a knowledge base built from [The Wheel of Time Fandom wiki](https://wot.fandom.com) (CC BY-SA): a curated set of pages is chunked, embedded, and stored in Supabase/pgvector, so a free-text query returns the most relevant chunks — with a toggle to compare 768- vs 3072-dimension embeddings side by side.

This started as the "Alternative A" brief from a one-day embeddings workshop (originally a Swedish assignment doc pointing at a Cosmere/Coppermind dataset) and was rebuilt from scratch on The Wheel of Time wiki instead, since Coppermind's license explicitly opts out of AI/derivative use — see [ADR-0002](./docs/adr/0002-wheel-of-time-over-coppermind.md).

## What it does

1. **Corpus** — fetches a curated list of wiki pages, strips wikitext down to prose, and chunks each article along its own section headers (falling back to fixed-size splitting for long sections).
2. **Knowledge base** — embeds every chunk with `gemini-embedding-001` (via OpenRouter) at both 768 and 3072 dimensions, and upserts it into a single Supabase `documents` table.
3. **Search** — a small web UI: type a query, get the top 5 matches (snippet, similarity score, source-article link for attribution), and flip a 768/3072 toggle to see how the ranking changes.
4. **Compare** — a CLI that runs the same query at both dimensions side by side, used to produce the [written comparison](./.scratch/wheel-of-time-search/dimension-comparison.md) of five queries where the two dimensions genuinely disagree.

## Architecture

```
src/corpus/   fetch → clean → chunk (no Supabase dependency, verifiable standalone)
src/kb/       embed chunks (768 + 3072) and store them in Supabase
src/search/   search backend + web UI, and the compare CLI
```

Schema: one `documents` table, one row per chunk, with `embedding_768 vector(768)` and `embedding_3072 vector(3072)` columns and two matching RPCs (`match_documents_768`, `match_documents_3072`) — see [ADR-0001](./docs/adr/0001-single-table-dual-embedding-columns.md) for why it's one table rather than two.

## Getting started

### Prerequisites

- Node.js + [pnpm](https://pnpm.io) (`pnpm@10.34.1`, see `packageManager` in `package.json`)
- A Supabase project with the `vector` extension enabled
- An [OpenRouter](https://openrouter.ai) API key (used to call Gemini's embeddings endpoint — see [ADR-0003](./docs/adr/0003-openrouter-proxy-for-gemini-embeddings.md))

### 1) Install dependencies

```sh
pnpm install
```

### 2) Provision Supabase

Run the setup wizard, which walks you through creating the project, enabling `pgvector`, running the schema migration ([`schema.sql`](./.scratch/wheel-of-time-search/schema.sql)), and populating `.env`:

```sh
./scripts/setup-supabase.sh
```

`.env` needs:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE=...
OPENROUTER_API_KEY=...
```

### 3) Build the knowledge base

```sh
pnpm corpus   # fetch + clean + chunk the curated wiki pages → data/chunks.jsonl
pnpm kb       # embed each chunk (768 + 3072) and store it in Supabase
```

### 4) Search

```sh
pnpm search   # starts the web UI at http://localhost:3000 (set PORT to override)
```

Or compare both dimensions for one or more queries from the CLI:

```sh
pnpm compare -- "Who is Nynaeve?" "What happened at Tarmon Gai'don?"
```

### Tests & typecheck

```sh
pnpm test
pnpm typecheck
```

## Docs

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary (Document, Knowledge Base)
- [`docs/adr/`](./docs/adr/) — architecture decisions (schema shape, content-source choice, embedding provider)
- [`.scratch/wheel-of-time-search/spec.md`](./.scratch/wheel-of-time-search/spec.md) — the build spec
- [`.scratch/wheel-of-time-search/dimension-comparison.md`](./.scratch/wheel-of-time-search/dimension-comparison.md) — the 768 vs 3072 write-up
- Implementation history: [GitHub Issues](https://github.com/AndreasJosef/ai-workshop-2-semantic-search/issues?q=is%3Aissue+is%3Aclosed) (issues #1–#5, all closed — see `docs/agents/issue-tracker.md` for the tracker conventions)

## Attribution

Source content is from [The Wheel of Time Fandom wiki](https://wot.fandom.com), licensed CC BY-SA; every search result links back to its source article.
