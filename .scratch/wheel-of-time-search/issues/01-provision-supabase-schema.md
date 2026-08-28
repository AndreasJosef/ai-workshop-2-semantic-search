# 01: Provision Supabase project & dual-embedding schema

**What to build:** A live Supabase project (pgvector extension enabled) that the rest of the pipeline can connect to, with the `documents` table and both similarity-search RPCs created and callable. This is the infrastructure prerequisite the spec calls out: no Supabase project exists yet.

**Blocked by:** None (can start immediately)

**Status:** done

Creating the Supabase account/project and running the migration in the dashboard SQL editor needs a human; the migration SQL itself can be authored by an agent and just needs to be run by the human doing this ticket.

- [x] A Supabase project exists with the `vector` extension enabled
- [x] `.env` at the repo root is populated with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, and `OPENROUTER_API_KEY` (was `GEMINI_API_KEY` — see [ADR-0003](../../../docs/adr/0003-openrouter-proxy-for-gemini-embeddings.md))
- [x] A `documents` table exists: one row per chunk, with `content`, both `embedding_768 vector(768)` and `embedding_3072 vector(3072)` columns (per [ADR-0001](../../../docs/adr/0001-single-table-dual-embedding-columns.md)), and a pointer back to the source article URL (for CC BY-SA attribution, per [ADR-0002](../../../docs/adr/0002-wheel-of-time-over-coppermind.md))
- [x] Row-level security is enabled with a public-read policy (write access restricted to the service role)
- [x] Two RPC functions exist and are callable: one ordering by `embedding_768` (e.g. `match_documents_768`), one ordering by `embedding_3072` (e.g. `match_documents_3072`), each taking a query embedding of the matching dimension and returning the top-N matches with similarity scores
- [x] A trivial manual test (e.g. inserting one dummy row and calling each RPC) confirms both RPCs return results end-to-end

## Comments

- Schema migration authored at `.scratch/wheel-of-time-search/schema.sql`; provisioning walked via `scripts/setup-supabase.sh` (a committed wizard script).
- Smoke test initially returned zero rows because the test SQL combined the dummy `INSERT ... RETURNING` and both RPC calls into one `WITH` statement — every part of a single statement shares one MVCC snapshot, so the RPCs' internal `select from documents` couldn't see the row inserted earlier in the same statement. Fixed by splitting into two separate statements (insert, then select). Re-run confirmed both RPCs return the dummy row with similarity ≈ 1; the dummy rows were then deleted via the REST API using the service-role key.
- The original `GEMINI_API_KEY` stopped working partway through this ticket. Switched to calling the same model (`gemini-embedding-001`) through OpenRouter's `/embeddings` endpoint instead — confirmed live that its `dimensions` parameter correctly returns 768- and 3072-length vectors. `.env` now holds `OPENROUTER_API_KEY` in place of `GEMINI_API_KEY`; see [ADR-0003](../../../docs/adr/0003-openrouter-proxy-for-gemini-embeddings.md). This changes the embed call in issue 03.
- Removed the now-unused `GEMINI_API_KEY` line from `.env`. Ticket closed.
