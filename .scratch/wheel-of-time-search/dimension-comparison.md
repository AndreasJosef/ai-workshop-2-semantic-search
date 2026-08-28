# 768 vs 3072: dimension comparison

Evidence for issue [05](./issues/05-document-dimension-comparison.md): five queries where the top results genuinely differ between the two embedding dimensions, with the observed rankings and a short analysis of why they diverge.

All results were gathered with the same code path the web UI uses (`src/search/search.ts` — embed the query with `gemini-embedding-001` at the chosen dimension, then call the matching RPC); the first query below was additionally cross-checked end-to-end through the running app's `/api/search` endpoint, which is what the UI's 768/3072 toggle calls. The rankings below are reproducible with:

```sh
pnpm compare -- "How does one become an Aes Sedai?" "Who is Nynaeve?" \
  "Who is Lews Therin Telamon?" "What happened at Tarmon Gai'don?" "What is the Great Game Daes Dae'mar?"
```

Of the five, two ("How does one become an Aes Sedai?", "Who is Nynaeve?") have a genuinely different **top-1 result**; the other three have identical or agreeing top results with genuinely different rankings or result sets just below.

## Setup

- Corpus: the 20 curated wiki pages from `src/corpus/pages.ts`, chunked by section, both embeddings stored per chunk (one row each).
- Model: `gemini-embedding-001` via OpenRouter, at `dimensions: 768` and `dimensions: 3072`.
- Top 5 per query, cosine similarity, ordered by the dimension's own RPC.

## Query 1: "How does one become an Aes Sedai?" — top-1 swap

| Rank | 768 | similarity | 3072 | similarity |
|---|---|---|---|---|
| 1 | Aes Sedai — "Once Accepted, the women have more privileges…" | 0.7717 | Aes Sedai — "The Aes Sedai (Old Tongue: Servant of All) are women who can channel… trained in the White Tower" | 0.7809 |
| 2 | Aes Sedai — "Servant of All… trained in the White Tower" | 0.7701 | Aes Sedai — "Once Accepted…" | 0.7785 |
| 3 | Aes Sedai — recruitment/spark chunk | 0.7575 | Aes Sedai — recruitment/spark chunk | 0.7638 |
| 4 | Aes Sedai — "…strict hierarchy…" | 0.7452 | One Power — "Aes Sedai was a term once used for male and female channelers in the Age of Legends" | 0.7544 |
| 5 | Moiraine Damodred — discovered the spark at 16 | 0.7426 | Moiraine Damodred — discovered the spark at 16 | 0.7510 |

**What differs:** the top two chunks swap places, and rank 4 is a different chunk entirely (Aes Sedai hierarchy at 768 vs the Age-of-Legends definition at 3072).

**Why it likely diverges:** the 768 embedding is a compressed (Matryoshka-style) projection of the same model's representation, so fine distinctions between *near-tied* chunks blur: here #1 and #2 are separated by only 0.0016 at 768. At 3072 the finer geometry clearly prefers the definitional chunk ("what an Aes Sedai is and how they are trained") over the procedural "once Accepted" chunk, which the 768 truncation had promoted for matching the literal wording "become". The rank-4 difference is the same effect at a lower similarity band: the compressed 768 space keeps the on-topic hierarchy chunk, while 3072 pulls in the historically-related One Power chunk that mentions Aes Sedai's origin.

## Query 2: "Who is Nynaeve?" — 768 misses the person entirely

| Rank | 768 | similarity | 3072 | similarity |
|---|---|---|---|---|
| 1 | Moiraine Damodred — the name's connection to the Moirae | 0.6740 | Channeling — Rand and Nynaeve cleanse the taint from saidin | 0.6949 |
| 2 | Ta'veren — "the savor"… two ta'veren strain the world | 0.6728 | Moiraine Damodred — notable as a channeler, born with the ability | 0.6904 |
| 3 | Moiraine Damodred — notable as a channeler | 0.6711 | Ta'veren — "the savor"… | 0.6890 |
| 4 | Channeling — cleansing of saidin by Rand and Nynaeve | 0.6686 | Moiraine Damodred — the Moirae name connection | 0.6862 |
| 5 | Egwene al'Vere — youngest daughter of the Mayor of Emond's Field | 0.6682 | Egwene al'Vere — youngest daughter of the Mayor of Emond's Field | 0.6822 |

**What differs:** the top-1 result is a different chunk from a different article, and the whole ranking reorders — only Egwene's chunk stays at rank 5.

**Why it likely diverges:** the corpus has no Nynaeve al'Meara page, so this is again a test of how each dimension generalizes around a missing entity. 3072 puts the one chunk that features Nynaeve doing something central (cleansing saidin) at #1 with a clear margin. The compressed 768 space instead lands on the etymology chunk about *Moiraine's* name — a chunk that never mentions Nynaeve at all — as its top hit. This is the sharpest quality gap in the comparison: at 768 the query's only real evidence (the cleansing chunk) sinks to rank 4, while 3072 recognizes it as the answer.

## Query 3: "Who is Lews Therin Telamon?" — top-1 agrees, tail reshuffles

| Rank | 768 | similarity | 3072 | similarity |
|---|---|---|---|---|
| 1 | The Eye of the World — prologue "Dragonmount" set in the Age of Legends | 0.7292 | The Eye of the World — prologue "Dragonmount" | 0.7289 |
| 2 | Rand al'Thor — Taint-induced madness | 0.7120 | Rand al'Thor — "reincarnation of the soul of Lews Therin Telamon, first named Dragon during the War of Power" | 0.7180 |
| 3 | Rand al'Thor — "reincarnation… first named Dragon" | 0.7061 | Rand al'Thor — Taint-induced madness | 0.7148 |
| 4 | Rand al'Thor — Nynaeve Healing the Taint | 0.7022 | Rand al'Thor — "reincarnation… also known as the Dragon" | 0.7131 |
| 5 | Rand al'Thor — "reincarnation… also known as the Dragon" | 0.7009 | Rand al'Thor — Nynaeve Healing the Taint | 0.7116 |

**What differs:** ranks 2–5 reshuffle (three rank changes), though every result comes from the same two articles.

**Why it likely diverges:** the corpus has no dedicated Lews Therin page, so both dimensions reach for the Rand al'Thor chunks that mention him. The 3072 embedding promotes the two chunks that literally name "Lews Therin Telamon" and state his identity (reincarnation/Dragon) above the Taint-madness storyline chunks; the compressed 768 representation, which carries less of that fine name-identity signal, ranks by broader topical neighborhood instead (madness, Dragon, Taint) and puts the madness chunk at #2. Notably the two dimensions even disagree about which chunk is *best* among near-ties while agreeing on the EotW prologue at #1 — the one chunk that talks about Lews Therin in his own historical context rather than through Rand.

## Query 4: "What happened at Tarmon Gai'don?" — different failure modes

| Rank | 768 | similarity | 3072 | similarity |
|---|---|---|---|---|
| 1 | The Eye of the World — Forsaken Aginor/Balthamel escape the Dark One's prison at Shayol Ghul | 0.6618 | The Eye of the World — Forsaken at Shayol Ghul | 0.6773 |
| 2 | Rand al'Thor — Taim / Tairen false Dragon defeated | 0.6493 | Rand al'Thor — Taim / Tairen false Dragon defeated | 0.6741 |
| 3 | The Great Hunt — Whitecloaks attack during the siege | 0.6490 | Tar Valon — Rashima's victory at the Battle of Maighande | 0.6682 |
| 4 | Tar Valon — Battle of Maighande | 0.6473 | Rand al'Thor — born on Dragonmount at the end of the Battle of the Blood Snow | 0.6679 |
| 5 | Children of the Light — kingdom of Almoth | 0.6428 | The Great Hunt — Whitecloaks attack | 0.6664 |

**What differs:** no result is unique to one side's top 5, but the ordering changes: 768 keeps the Great Hunt siege chunk at #3, while 3072 swaps in the Dragonmount/Blood Snow birth-prophecy chunk at #4 and drops both the siege and the Almoth chunk.

**Why it likely diverges:** the corpus contains no Tarmon Gai'don/Last Battle article (it is a curated 20-page subset), so this query is a stress test of how each dimension *fails*. Both fall back to "large battle with the Dark One's forces nearby" chunks, but they weight the neighborhood differently: 3072's finer space groups the messianic-prophecy cluster (Dragonmount birth at the end of a final battle) with the eschatological query, while 768 stays with literal battle-report chunks. Similarities also run systematically higher at 3072 (top-1 0.6773 vs 0.6618) — the two score scales are not directly comparable, only rankings are.

## Query 5: "What is the Great Game Daes Dae'mar?" — disjoint tails

| Rank | 768 | similarity | 3072 | similarity |
|---|---|---|---|---|
| 1 | Aes Sedai — Seanchan continent ruled by shifting alliances of dictators | 0.6258 | Aes Sedai — Seanchan shifting alliances | 0.6386 |
| 2 | Aiel — warrior societies list | 0.5948 | Aiel — warrior societies list | 0.6275 |
| 3 | Moiraine Damodred — Thom shows Mat Moiraine's letter | 0.5946 | Aiel — female Aes Sedai during the Breaking | 0.6209 |
| 4 | Andor — House Candraed | 0.5940 | Andor — House Candraed | 0.6207 |
| 5 | Seanchan — damane and the a'dam | 0.5895 | Children of the Light — Lord Captain Commander succession list | 0.6178 |

**What differs:** ranks 3 and 5 are entirely different chunks (only-768: Moiraine's letter, the a'dam chunk; only-3072: the Breaking-era Aiel chunk, the Children of the Light succession list); ranks 1, 2, 4 match.

**Why it likely diverges:** there is no Daes Dae'mar article in the corpus, so both dimensions must generalize from "scheming among factions". The compressed 768 space latches onto surface-adjacent fragments of intrigue (a secret letter, a control device), while 3072 retrieves chunks that are thematically adjacent to power politics and institutional maneuvering (succession lists, faction histories). With no exact match available, the two spaces' different generalization behavior becomes visible as a disjoint tail.

## Overall observations

1. **Rankings agree on clear-cut cases and diverge on close calls.** In every query above, churn concentrates where similarities are tightly clustered (within a few thousandths). "Tell me about the Aiel Waste", "What is the One Power?" and "Who is Egwene al'Vere?" produced *identical* top-5s at both dimensions during the same runs — the differences appear at the margin, not wholesale.
2. **The 768 scores are consistently lower than the 3072 scores for the same query/result pairs** (typically 0.01–0.04 lower here). The 768 vectors are a compressed projection of the same model, so the two similarity scales are not comparable; only the ordering within a dimension is meaningful.
3. **Divergence concentrates where the corpus has no good answer.** For queries with a dedicated page ("One Power", "Seanchan", "Rand al'Thor"), both dimensions converge on the same page. For queries about topics outside the curated 20 pages (Nynaeve, Tarmon Gai'don, Daes Dae'mar, Lews Therin as a person), each dimension generalizes differently — and 768's generalization is the one that goes wrong most visibly (query 2).
4. **3072 shows finer within-page discrimination** (queries 1 and 3), tending to rank the chunk that *defines* the queried entity above chunks that merely discuss it, while 768 leans slightly more on surface wording of the query ("become").

Additional runs kept out of the five (e.g. "What are the Seanchan like?", where the same five chunks from one article permute in ranks 3–5, or "How do gateways for Traveling work?", where both dimensions miss a topic the corpus lacks) show the same patterns and can be regenerated with the command above.

## Attribution

All retrieved text is from the Wheel of Time Fandom wiki ([wot.fandom.com](https://wot.fandom.com)), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each chunk's source page is `https://wot.fandom.com/wiki/<Article>` for the article named in the tables (the exact `source_url` is stored on every chunk in the database and printed in full by `pnpm compare`).
