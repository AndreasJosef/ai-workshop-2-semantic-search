# Dual-dimension embeddings as two columns on one table, not two tables

The workshop requires comparing 768-dim vs 3072-dim embeddings for the same content (README steps 4–5: vary dimensionality, document 5 queries whose results differ). The README's own tip suggests two parallel tables (`documents_768` / `documents_3072`) with matching RPCs to avoid migrating back and forth.

We instead use one `documents` table per chunk, with both `embedding_768 vector(768)` and `embedding_3072 vector(3072)` columns, and one RPC per dimension ordering by its own column. Content is authored once; both embeddings live on the same row, so they can never drift out of sync with each other, and comparing how a given chunk's ranking differs across dimensions is a same-`id` lookup instead of matching rows across two tables.

Considered and rejected: two separate tables as the README suggests — simpler to read as literally "two experiments," but risks the two copies of content silently diverging, and makes the required comparison task more bookkeeping than it needs to be.
