# Keyword vs semantic: full-text search comparison

Evidence for issue [#6](https://github.com/AndreasJosef/ai-workshop-2-semantic-search/issues/6): six queries where lexical (Postgres full-text) search and the two embedding modes genuinely diverge, with the observed rankings and a short analysis of why — the same kind of hands-on comparison as [dimension-comparison.md](./dimension-comparison.md), but across the lexical-vs-semantic axis instead of embedding size.

All results were gathered with the same code path the web UI uses (`src/search/search.ts`: embed the query at the chosen dimension, or pass the raw query text to `match_documents_keyword` for keyword mode). The first query was additionally cross-checked end-to-end through the running app's `/api/search?dim=keyword` endpoint, which is what the UI's new Keyword toggle calls. The rankings below are reproducible with:

```sh
pnpm compare -- "ta'veren" "Who leads the Children of the Light?" \
  "What is the Stone of Tear?" "How do sorcerers cast spells in this world?" \
  "folks who magnetize fortune and bend coincidences around them" \
  "an armada from over the horizon that shackles its mages"
```

**Important caveat, carried over from the dimension comparison:** the score columns are *not* comparable across modes. The embedding scores are cosine similarities (roughly 0–1, higher = more similar); the keyword scores are `ts_rank` values, whose absolute size means nothing outside its own scale (and whose maximum depends on the query's terms). Only the ordering within a mode is meaningful.

## Setup

- Corpus: the curated wiki pages from `src/corpus/pages.ts`, chunked by section — 22 pages, 332 chunks in the `documents` table.
- Semantic modes: `gemini-embedding-001` via OpenRouter at `dimensions: 768` and `dimensions: 3072`; top 5 per query by cosine similarity via `match_documents_768` / `match_documents_3072`.
- Keyword mode: Postgres full-text search — `to_tsvector('english', content)` (generated column), GIN index, top 5 by `ts_rank(content_tsv, websearch_to_tsquery('english', query))` via `match_documents_keyword`. Note `websearch_to_tsquery` **ANDs** the query terms: a chunk must contain every (stemmed) content word of the query to match at all.
- The query set was designed on two axes: three **named-entity / exact-term** queries (keyword search's expected best case) and three **paraphrase** queries whose content words were checked against the corpus so they have essentially no lexical overlap with its wording (keyword search's expected worst case). They deliberately do not reuse the five 768-vs-3072 queries from `dimension-comparison.md`.

## Query 1: "ta'veren" — right page, wrong chunk

| Rank | 768 | sim | 3072 | sim | Keyword | score |
|---|---|---|---|---|---|---|
| 1 | Ta'veren — "people around whom the Wheel of Time specifically weaves the Pattern…" (definition) | 0.7909 | same chunk | 0.8005 | Ta'veren — "Ta'veren change the probability of something happening… fall off a house…" | 0.7845 |
| 2 | Ta'veren — "a central focal point for a Web of Destiny in the Pattern…" | 0.7840 | same chunk | 0.7920 | Ta'veren — "various other individuals… speculated by fans to be ta'veren…" | 0.7080 |
| 3 | Rand al'Thor — "He, together with Mat Cauthon and Perrin Aybara, was a strong ta'veren." | 0.7798 | same chunk | 0.7897 | Ta'veren — "three confirmed ta'veren… Rand, Perrin, Matrim Cauthon" | 0.6812 |
| 4 | Ta'veren — "resemble that of Strange Attractors" | 0.7717 | same chunk | 0.7811 | Ta'veren — the same definition chunk the embeddings rank #1 | 0.5474 |
| 5 | Ta'veren — "change the probability of something happening…" | 0.7423 | Ta'veren — "three confirmed ta'veren…" | 0.7565 | Ta'veren — "Perrin Aybara's ta'veren nature…" | 0.4856 |

**What differs:** every keyword hit comes from the Ta'veren page — the exact-term best case works — but the *ordering* is reshuffled: the definitional chunk ("people around whom the Wheel of Time specifically weaves the Pattern…") drops to rank 4, displaced by a frequency-driven chunk about probability, and the embeddings' rank-5 (probability) chunk becomes keyword's rank-1.

**Why it diverges:** `ts_rank` rewards how often and how densely the query terms appear; the probability chunk repeats the literal token "ta'veren" many times in quick succession, while the definitional chunk spends more of its text on surrounding words ("Wheel", "Pattern", "weaves"). The embeddings, by contrast, rank the chunk that *defines* the queried entity first — the same within-page discrimination the 3072 embedding showed in the dimension comparison. A single-term query is keyword search's purest setting, and even here it only guarantees the right page, not the right passage.

## Query 2: "Who leads the Children of the Light?" — AND semantics strangle the query

| Rank | 768 | sim | 3072 | sim | Keyword | score |
|---|---|---|---|---|---|---|
| 1 | Children of the Light — "The Lord Captain Commander is the supreme head…" | 0.7783 | same chunk | 0.7900 | Children of the Light — "Nicknamed the Questioners… the Hand of the Light…" | 0.2540 |
| 2 | Children of the Light — "The Council of the Anointed… presided over by the Lord Captain Commander" | 0.7519 | same chunk | 0.7639 | — | — |
| 3 | Children of the Light — "Lord Captain Commander — The leader of the Children of the Light…" | 0.7514 | same chunk | 0.7633 | — | — |
| 4 | Children of the Light — "The ranks, beginning with the highest…" | 0.7476 | same chunk | 0.7600 | — | — |
| 5 | Children of the Light — "an independent military organization dedicated to finding Darkfriends…" | 0.7342 | same chunk | 0.7551 | — | — |

**What differs:** keyword mode returned exactly **one** result. `websearch_to_tsquery` turns the question into `lead & children & light`, and only one of the 332 chunks contains all three stemmed terms. The embeddings return the same five Children of the Light chunks in the same order at both dimensions — their most-agreeing query in the whole comparison.

**Why it diverges:** AND semantics make a keyword engine brittle under natural-language questions: "who", "leads", and "the" are dropped or kept without understanding that a question is a request *about* the entity, not a conjunction of constraints. Worse, keyword's single surviving hit is not the answer to the question (it describes the Questioners/Hand of the Light, not who leads), while both embedding modes put the "Lord Captain Commander is the supreme head" chunk at #1 — the actual answer. This is the sharpest single-query gap in the comparison: semantic search answers, keyword search barely participates.

## Query 3: "What is the Stone of Tear?" — keyword's own scale betrays it

| Rank | 768 | sim | 3072 | sim | Keyword | score |
|---|---|---|---|---|---|---|
| 1 | Stone of Tear — "an immense fortress, believed to be mankind's oldest surviving stronghold…" | 0.6969 | same chunk | 0.7162 | Egwene al'Vere — chronology chunk (mentions the Stone in passing) | 0.1844 |
| 2 | Stone of Tear — "houses a collection… of ter'angreal… known as the Great Holding" | 0.6104 | same chunk | 0.6271 | Mat Cauthon — chronology chunk (mentions the Stone in passing) | 0.1815 |
| 3 | Stone of Tear — "the east gate of the Stone is called the Dragonwall Gate…" | 0.6039 | same chunk | 0.6233 | Stone of Tear — "an immense fortress…" (the definitional chunk) | 0.1279 |
| 4 | Stone of Tear — "the Heart of the Stone: a great round room…" | 0.5975 | same chunk | 0.6217 | Rand al'Thor — "current reincarnation of the soul of Lews Therin…" | 0.0985 |
| 5 | Stone of Tear — "The Defenders of the Stone are the elite military group…" | 0.5886 | same chunk | 0.6146 | Rand al'Thor — "associated with many iconic possessions…" | 0.0985 |

**What differs:** keyword mode finds chunks mentioning the Stone, but ranks two long chronology chunks (Egwene's and Mat's) *above* the page's own definitional chunk, which sits at rank 3 with a score of 0.1279 — below a passing mention.

**Why it diverges:** `ts_rank`'s arithmetic (term frequency, positional proximity between query words, and per-term weights) is a heuristic that long narrative chunks can game: the chronology chunks weave "Stone of Tear" into dense, event-packed text in ways the scoring happens to reward. The embeddings again favor the chunk that *defines* the entity. Two lessons: (1) lexical ranking optimizes for textual statistics, not for "what best answers 'what is X?'"; (2) `ts_rank` values are on yet another scale — a 0.18 keyword score is neither better nor worse than a 0.70 cosine similarity, and Postgres's own docs describe the ranking functions as ad hoc. (If lexical ranking quality ever matters more than the comparison itself, `ts_rank_cd` — cover-density ranking — is the standard next step, but it is out of scope here.)

## Query 4: "How do sorcerers cast spells in this world?" — keyword returns nothing

| Rank | 768 | sim | 3072 | sim | Keyword | score |
|---|---|---|---|---|---|---|
| 1 | Channeling — "Not everyone has the ability to channel the One Power…" | 0.6036 | same chunk | 0.6236 | — | — |
| 2 | Saidar — "The name is likely from Seiðr… a type of magic in Norse society" | 0.5948 | same chunk | 0.6192 | — | — |
| 3 | One Power — "Not everyone has the ability to 'channel,' or access, the One Power…" | 0.5896 | same chunk | 0.6101 | — | — |
| 4 | One Power — "Male channelers as a whole usually are much stronger…" | 0.5853 | same chunk | 0.6089 | — | — |
| 5 | Channeling — "Channeling is the act of using the One Power… emanates from the True Source" | 0.5851 | same chunk | 0.6086 | — | — |

**What differs:** keyword mode returned **zero results**. The query's content words — *sorcerers, cast, spells* (and *world*, the only one the corpus contains at all) — must all match under `websearch_to_tsquery`'s AND, and no chunk contains every one. The embeddings, with zero literal overlap to lean on, put the One Power's "how do people channel" chunks 1–3 at both dimensions.

**Why it diverges:** this is keyword search's worst case, engineered deliberately: a synonym paraphrase of "how do people channel the One Power" that shares no corpus vocabulary. Lexical search cannot bridge "sorcerers cast spells" → "channelers channel the One Power" because it has no notion of meaning — only of tokens. Distributional embeddings, trained on text where those concepts co-occur, map the paraphrase and the corpus's wording close together in vector space.

## Query 5: "folks who magnetize fortune and bend coincidences around them" — the paraphrase finds a better answer than the term

| Rank | 768 | sim | 3072 | sim | Keyword | score |
|---|---|---|---|---|---|---|
| 1 | Mat Cauthon — "Mat's most obvious non-personality trait is his extraordinarily good luck…" | 0.6412 | same chunk | 0.6546 | — | — |
| 2 | Ta'veren — "a central focal point for a Web of Destiny in the Pattern…" | 0.6153 | Ta'veren — "three confirmed ta'veren…" | 0.6286 | — | — |
| 3 | Ta'veren — "resemble that of Strange Attractors" | 0.6139 | Ta'veren — "a central focal point for a Web of Destiny…" | 0.6286 | — | — |
| 4 | Ta'veren — "three confirmed ta'veren…" | 0.6068 | Ta'veren — "resemble that of Strange Attractors" | 0.6264 | — | — |
| 5 | Ta'veren — "change the probability of something happening…" | 0.5913 | Ta'veren — "change the probability…" | 0.6133 | — | — |

**What differs:** keyword mode again returned **zero results** (*folks, magnetize, fortune, bend, coincidences* — every content word is absent from the corpus). The embeddings filled the space, and interestingly put Mat's luck chunk at #1, with four ta'veren chunks behind it — the same chunks the two dimensions ordered slightly differently (ranks 2–4 permute, the one 768-vs-3072 shuffle in this query set).

**Why it diverges:** a deliberate zero-overlap paraphrase of the ta'veren concept ("people whose presence warps probability"). Keyword search has no entry point at all; semantic search doesn't just find the literal *ta'veren* concept — it surfaces the corpus's most vivid *instance* of magnetized fortune (Mat's luck), arguably a better answer to this phrasing than the definition. Worth noting for teaching: the embeddings interpreted the *connotation* of the paraphrase (luck, improbability) rather than its referent (ta'veren), which is exactly the behavior that makes vector search feel intelligent — and occasionally wrong in ways lexical search wouldn't be.

## Query 6: "an armada from over the horizon that shackles its mages" — zero overlap, semantic recovers the referent

| Rank | 768 | sim | 3072 | sim | Keyword | score |
|---|---|---|---|---|---|---|
| 1 | Seanchan — "Women who can channel are regarded as animals, kept on a silvery metal leash, the a'dam…" | 0.6318 | same chunk | 0.6407 | — | — |
| 2 | Seanchan — "Slavery has a long history in the Seanchan empire… da'covale, 'those who are property'" | 0.6201 | same chunk | 0.6339 | — | — |
| 3 | Aes Sedai — "Before the arrival of Luthair Paendrag Mondwin, the Seanchan continent…" | 0.5959 | Seanchan — "use the native animals from the continent to kill all of the present Shadowspawn…" | 0.6114 | — | — |
| 4 | One Power — "The damane and sul'dam of the Seanchan… joined to the great linking…" | 0.5959 | Seanchan — "The Seanchan empire has a rigid class structure… the Blood…" | 0.6109 | — | — |
| 5 | Saidar — "Aes Sedai / Aiel Wise Ones / The Kin / Sea Folk Windfinders / Seanchan damane…" | 0.5913 | Seanchan — "During this same time, the Seanchan began…" | 0.6091 | — | — |

**What differs:** keyword mode returned **zero results** for the third paraphrase in a row (*armada, horizon, shackles, mages* — none stem to any corpus word). The embeddings put the damane/a'dam leash chunk at #1 by a clear margin at both dimensions; ranks 3–5 are entirely different chunks per dimension (2 only-768, 2 only-3072), the disjoint-tail pattern from `dimension-comparison.md` reappearing on this axis.

**Why it diverges:** the paraphrase targets the Seanchan method of controlling channelers ("shackles its mages" → "kept on a silvery metal leash, the a'dam") without sharing a single content word with the corpus. Only a meaning-based representation can make that leap. This is the mirror image of query 2: there, keyword's brittleness wasted a query that *contained* the right entity; here, keyword has nothing to stand on and semantic search's generalization is the entire ballgame.

## Overall observations

1. **Keyword search latches onto the literal query token, wherever it appears — not necessarily on the right answer.** In query 1 every keyword hit came from the Ta'veren page (the exact-term best case), but the top-ranked chunk was a frequency artifact, not the definition. In query 3, four of five keyword hits came from *other* pages that merely mention the Stone, and two long chronology chunks outranked the Stone page's own definitional chunk. In query 2 keyword's single survivor didn't answer the question. Both embedding modes ranked the definitional chunk #1 in all three named-entity queries.
2. **Zero-overlap paraphrase is an outright keyword wipeout.** All three engineered paraphrases returned zero keyword results — `websearch_to_tsquery`'s AND semantics mean one unknown word poisons the whole query, even when the *other* words ("world") do appear. Semantic search answered all three sensibly at both dimensions. (An OR-combined query or a lexically-forgiving query parser would soften this, but changing the ranking strategy was out of scope for this comparison.)
3. **The two embedding modes were more alike than either was to keyword.** 768 and 3072 agreed on the top-1 chunk in all six queries (consistent with `dimension-comparison.md`'s finding that they diverge mainly on near-ties); keyword agreed with neither in any query. The lexical-vs-semantic axis produces far more divergence than the dimensionality axis on this corpus.
4. **Three incomparable score scales, not two.** `ts_rank` values (0.09–0.78 here) sit on yet another scale than cosine similarity, and keyword scores are internally noisy too (a passing mention outranking a definition, per query 3). Any cross-mode comparison must be done by rank, never by score.
5. **Where each mode wins, concretely:** keyword wins on rare tokens and exact identifiers (a character name, a term like `sa'angreal`) where an embedding may blur the distinction; semantic search wins everywhere a human phrases a question in their own words — which, for a free-text search box, is the common case. Both are cheap to run side by side, which is what `pnpm compare` and the UI's three-way toggle now exist for.

## Attribution

All retrieved text is from the Wheel of Time Fandom wiki ([wot.fandom.com](https://wot.fandom.com)), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each chunk's source page is `https://wot.fandom.com/wiki/<Article>` for the article named in the tables (the exact `source_url` is stored on every chunk in the database and printed in full by `pnpm compare`).
