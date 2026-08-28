# The Wheel of Time Knowledge Base

Semantic search over a knowledge base built from The Wheel of Time Fandom wiki (`wot.fandom.com`, CC BY-SA): source text is chunked, embedded, and stored in Supabase/pgvector so a query string can retrieve the most similar chunks. Chosen as a license-clean substitute for the workshop's original Cosmere/Coppermind framing — see [ADR-0002](./docs/adr/0002-wheel-of-time-over-coppermind.md).

## Language

**Document**:
One retrievable chunk of Wheel of Time wiki text, stored with two embedding representations (768-dim and 3072-dim) of the same content, so retrieval quality can be compared side by side (see [ADR-0001](./docs/adr/0001-single-table-dual-embedding-columns.md)).
_Avoid_: Item, Object — those describe whole-entity embeddings, as used in the workshop's recommendation-system alternative, which this project isn't building.

**Knowledge Base**:
The full corpus of Documents that a search query is matched against.
