# 02: Corpus fetch, clean & chunk pipeline

**What to build:** A Node/TypeScript script that turns a curated list of Wheel of Time Fandom wiki (`wot.fandom.com`) page titles into ready-to-embed chunks, with no Supabase dependency — runs and is verifiable standalone by inspecting its output.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A curated list of page titles is chosen, deliberately spanning characters, locations, the magic system, factions/nations, and book synopses (not the full ~6,563-article corpus)
- [ ] For each title, wikitext is fetched via the MediaWiki API (`action=query&prop=revisions&rvprop=content`) — this wiki has no `extracts` clean-text shortcut, confirmed in [dataset research](../../knowledge-base-dataset/research.md)
- [ ] Wikitext is cleaned: templates, infoboxes, and `[[links]]` are stripped down to readable prose
- [ ] Each article is chunked along its own section headers first (one semantic thought per chunk, matching the article's own structure); any section that runs long falls back to fixed-size splitting (200–400 tokens, 50–100 token overlap)
- [ ] Each chunk carries metadata: source article title, section heading, and the source article's URL (needed downstream for CC BY-SA attribution in the UI)
- [ ] Running the script against the curated list produces chunk output (e.g. local JSON/JSONL) that can be inspected directly, without needing any Supabase credentials
