# 04: Search backend + web UI

**What to build:** A small web app implementing the workshop's core required feature: a user types a query and gets back ranked semantic-search results from the Wheel of Time knowledge base, with the ability to compare the 768- and 3072-dimension embeddings.

**Blocked by:** 03 (Embed & store pipeline)

**Status:** ready-for-agent

- [ ] A query input accepts a free-text search string
- [ ] The query string is embedded via Gemini at the currently-selected dimension (see toggle below) and passed to the matching RPC (`match_documents_768` or `match_documents_3072`)
- [ ] Results show the top 5 matches, each with: a content snippet, its similarity score, and a link back to the source article (CC BY-SA attribution, per [ADR-0002](../../../docs/adr/0002-wheel-of-time-over-coppermind.md))
- [ ] A 768/3072 toggle lets the user re-run the same query against the other embedding dimension and see the results change
- [ ] The app runs locally and is demoable end-to-end: type a query, see 5 ranked, attributed results
