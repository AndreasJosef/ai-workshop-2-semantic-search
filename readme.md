# Embeddings Playground – Workshop

Idag bygger vi **semantiska funktioner** ovanpå er egen data med **embeddings** + **Supabase (pgvector)**.

Utgå från projektet från repot på lektionen igår där vi redan

1. genererar embeddings,
2. laddar upp dem till Supabase, och
3. anropar en färdig **RPC** för att jämföra embeddings,

Detta kan vi bygga på för att lösa någon av uppgifterna längre ner.

---

## Kom igång

### 1) Miljö

* Supabase-projekt (pgvector aktiverat)
* `.env` i rot med:

  ```
  SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE=...
  GEMINI_API_KEY...
  ```

### 2) Databas (om ni behöver återskapa)

Tabell + RPC

```sql
-- Om ni inte lagt till pgvector i gränssnittet, så kan ni också göra detta i editorn i Supabase.
create extension if not exists vector;

-- Lägg märke till att vår embedding har 768 dimensioner. Om vi ändrar i koden, behöver vi också ändra här.
create table if not exists documents (
id bigserial primary key,
content text not null,
embedding vector(768) not null
);

-- Valfritt men rekommenderat. Grundläggande säkerhet för att ingen ska kunna skriva till tabellen. Men alla med anon_key kan läsa.
alter table documents enable row level security;
create policy "public read" on documents for select using (true);

-- Den här funktionen är den som gör våran similarity search möjlig. Ni behöver inte förstå den
-- Det den gör är att den tar emot vår sökvector och sen gör en cosine similarity search på våra embeddings i tabellen documents.
create or replace function match_documents(
query_embedding vector(768),
match_count int default 5
) returns table (
id bigint,
content text,
similarity float
) language sql stable as $$
select d.id,
d.content,
1 - (d.embedding <=> query_embedding) as similarity
from documents d
order by d.embedding <=> query_embedding
limit match_count;
$$;
```

> **Tips:** Om ni vill växla mellan 768 och 3072 dimensioner under dagen, skapa **två tabeller** (t.ex. `documents_768` och `documents_3072`) och **två RPC** med rätt `vector(n)` så ni slipper migrera fram och tillbaka.

---

## Chunking – hur mycket text per embedding?

När vi skapar embeddings utifrån text behöver vi se till att vi inte skickar in för mycket (eller för lite) text. Detta är särskilt viktigt när vi jobbar med större dokument där all text inte får plats. Då brukar man göra något som kallas för "chunking"

Det enklaste är att helt manuellt se till att dela upp sin data men vid större dataset blir en automatisk chunking nödvändig. Det finns verktyg för detta (och vi kan ju skriva vår egen textuppdelar-algoritm).

ALTERNATIVT: Använd AI för att dela upp era texter :)

**Riktlinjer (börja här, iterera sedan):**

* **Chunk size:** 200–400 tokens per chunk.
* **Overlap:** 50–100 tokens.
* **Granularitet:** Bra tumregel är “en semantisk tanke per chunk”. För långa chunks urvattnar signalen; för korta tappar kontext.

Om ni vill läsa mer om chunking strategier finns detta [här](https://www.pinecone.io/learn/chunking-strategies/)

---

## Uppgifter

### Alternativ A) **Semantisk sökning i “kunskapsbas”**

För att till exempel söka i artiklar/anteckningar (.md/.txt) – kursanteckningar, bloggar, dagboksantexkningar, recept.

**Steg:**

1. Välj datakälla: använd antingen AI för att generera ett dataset eller använd material ni redan har.
2. Använd koden från igår för att ladda upp data i Supabase
3. Bygg **en enkel sök-UI** (web eller node.js):
   * input: query-sträng
   * output: 5 träffar (content-snippet, similarity)
4. Testa **768 vs 3072** och se om det blir någon skillnad i resultat.
5. Dokumentera 5 queries där resultaten **skiljer sig** och förklara varför ni tror det blir så.

**Extra (om ni blir klara):**

* Lägg till möjligheten att skicka in ny text i databasen alltså: text -> embeddings -> DB.
* Se om ni kan få in ett anrop till en LLM och därmed kunna få en chat-liknande upplevelse.

---

### Alternativ B) **Rekommendationssystem (liknande objekt)**

**Use case:** “Användare tittade på det här – visa liknande”.

**Data:** En liten produkt-, film- eller boklista med **beskrivningar** (titel, synopsis/description, ev. genre, årtal). Ta ex. MongoDBs exempeldatabas.

**Steg:**

1. Sätt ihop relevant data till **en textsträng per objekt** (t.ex. `title + " — " + description` actors etc.).
2. Embedda *hela objektet* (ofta **1 vektor/objekt**)
3. UI/CLI: välj ett objekt A → hämta **topp-N liknande** via RPC med A:s embedding som query.
4. Variera:
   * **768 vs 3072**,
   * Ta bort data ur objektet (alltså testa med bara "description", får ni andra resultat då?)

**Extra (om ni blir klara):**

* Lägg till semantisk sökning OCKSÅ så att användaren kan be om vilken typ av film ex. som den vill se.

