# 02: Corpus fetch, clean & chunk pipeline

**What to build:** A Node/TypeScript script that turns a curated list of Wheel of Time Fandom wiki (`wot.fandom.com`) page titles into ready-to-embed chunks, with no Supabase dependency — runs and is verifiable standalone by inspecting its output.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] A curated list of page titles is chosen, deliberately spanning characters, locations, the magic system, factions/nations, and book synopses (not the full ~6,563-article corpus)
- [x] For each title, wikitext is fetched via the MediaWiki API (`action=query&prop=revisions&rvprop=content`) — this wiki has no `extracts` clean-text shortcut, confirmed in [dataset research](../../knowledge-base-dataset/research.md)
- [x] Wikitext is cleaned: templates, infoboxes, and `[[links]]` are stripped down to readable prose
- [x] Each article is chunked along its own section headers first (one semantic thought per chunk, matching the article's own structure); any section that runs long falls back to fixed-size splitting (200–400 tokens, 50–100 token overlap)
- [x] Each chunk carries metadata: source article title, section heading, and the source article's URL (needed downstream for CC BY-SA attribution in the UI)
- [x] Running the script against the curated list produces chunk output (e.g. local JSON/JSONL) that can be inspected directly, without needing any Supabase credentials

## Answer

Implemented as `src/corpus/` (`npm run corpus`): `pages.ts` (22 curated titles across all five categories, all verified live), `api.ts` (MediaWiki `action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1` with injected-fetch seam; `sourceUrlFor` for attribution URLs), `wikitext.ts` (template/infobox/ref/table/link/entity stripping), `sections.ts` (splits along the article's own `==` headers, with `>` breadcrumb heading paths), `chunker.ts` (whole section per chunk when ≤ 400 tokens; fixed-size fallback of 200–400 words with 75-word overlap otherwise — word count as the token heuristic), `pipeline.ts` (orchestration, injectable fetcher), `main.ts` (CLI → `data/chunks.jsonl`, gitignored). Live run: 22/22 pages, 332 chunks, zero residual wikitext. 32 vitest tests + typecheck pass. Note: three originally chosen titles were redirects — fixed by `redirects=1` plus canonical titles (`Mat Cauthon`, `The White Tower`) and swapping `True Source` (redirects into One Power) for `Ta'veren`.
