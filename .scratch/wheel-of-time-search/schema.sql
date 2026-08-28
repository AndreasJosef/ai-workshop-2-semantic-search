-- Wheel of Time semantic search: dual-embedding schema + keyword search
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent (if not exists / or replace).
--
-- Shape: ADR-0001 (single `documents` table, two embedding columns instead
-- of two tables) — docs/adr/0001-single-table-dual-embedding-columns.md
-- source_url: ADR-0002 (CC BY-SA attribution requirement) —
-- docs/adr/0002-wheel-of-time-over-coppermind.md
-- keyword path: ADR-0004 (generated tsvector column + ts_rank RPC) —
-- docs/adr/0004-postgres-full-text-keyword-search.md

create extension if not exists vector;

create table if not exists documents (
  id bigserial primary key,
  content text not null,
  source_url text not null,
  embedding_768 vector(768),
  embedding_3072 vector(3072)
);

-- Row-level security: anyone with the anon key can read; only the
-- service_role key (which bypasses RLS entirely) can write, since no
-- insert/update/delete policy is defined below.
alter table documents enable row level security;

drop policy if exists "public read" on documents;
create policy "public read" on documents for select using (true);

-- One RPC per embedding dimension, each ordering by its own column via
-- cosine distance (<=>) and returning similarity = 1 - distance.

create or replace function match_documents_768(
  query_embedding vector(768),
  match_count int default 5
) returns table (
  id bigint,
  content text,
  source_url text,
  similarity float
) language sql stable as $$
  select d.id,
         d.content,
         d.source_url,
         1 - (d.embedding_768 <=> query_embedding) as similarity
  from documents d
  where d.embedding_768 is not null
  order by d.embedding_768 <=> query_embedding
  limit match_count;
$$;

create or replace function match_documents_3072(
  query_embedding vector(3072),
  match_count int default 5
) returns table (
  id bigint,
  content text,
  source_url text,
  similarity float
) language sql stable as $$
  select d.id,
         d.content,
         d.source_url,
         1 - (d.embedding_3072 <=> query_embedding) as similarity
  from documents d
  where d.embedding_3072 is not null
  order by d.embedding_3072 <=> query_embedding
  limit match_count;
$$;

-- Keyword (lexical) search: ADR-0004. The tsvector column is generated from
-- `content`, so the existing ingestion pipeline (src/corpus, src/kb) needs no
-- changes — existing rows back-fill automatically.

alter table documents add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', content)) stored;

create index if not exists documents_content_tsv_idx on documents using gin (content_tsv);

-- Third RPC, same shape as the two embedding RPCs but ranked by ts_rank
-- (not a cosine similarity — hence the generic `score` output name).
-- websearch_to_tsquery parses free-text input (quoted phrases, OR, -exclusion)
-- without ever erroring on malformed boolean syntax.

create or replace function match_documents_keyword(
  query_text text,
  match_count int default 5
) returns table (
  id bigint,
  content text,
  source_url text,
  score float
) language sql stable as $$
  select d.id,
         d.content,
         d.source_url,
         ts_rank(d.content_tsv, websearch_to_tsquery('english', query_text)) as score
  from documents d
  where d.content_tsv @@ websearch_to_tsquery('english', query_text)
  order by ts_rank(d.content_tsv, websearch_to_tsquery('english', query_text)) desc
  limit match_count;
$$;
