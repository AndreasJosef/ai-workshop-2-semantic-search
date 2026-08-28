-- Wheel of Time semantic search: dual-embedding schema
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent (if not exists / or replace).
--
-- Shape: ADR-0001 (single `documents` table, two embedding columns instead
-- of two tables) — .scratch/../docs/adr/0001-single-table-dual-embedding-columns.md
-- source_url: ADR-0002 (CC BY-SA attribution requirement) —
-- .scratch/../docs/adr/0002-wheel-of-time-over-coppermind.md

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
