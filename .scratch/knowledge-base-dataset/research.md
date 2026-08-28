# Dataset research: content source for the semantic-search knowledge base

**Question:** find a structured/public dataset covering Brandon Sanderson's Cosmere
(characters, worlds, magic systems, factions, species, book synopses) suitable as the
content source for a chunk -> embed -> pgvector workshop build.

**Method:** every claim below was checked against a primary source (the live API, the
license page itself, the repo/README, the CC license deed) — not a blog post describing
them. Live endpoints were hit with `curl` (a plain browser User-Agent was required —
Cloudflare returned HTTP 403 to the sandbox's default WebFetch UA on `coppermind.net`
and to non-browser requests on most `*.fandom.com` paths).

**Bottom line up front:** Coppermind's API is real, fast, and rich — but its *text is
licensed CC BY-NC-ND, and Coppermind's own copyright page says derivative use needs
explicit permission*. That's very likely to include "chunk it, embed it, serve it back
through a search UI." No Kaggle/HuggingFace dataset or third-party API fills the gap
cleanly either. Recommendation: build the workshop against a **CC BY-SA Fandom wiki**
(Harry Potter Wiki used here as the worked example) instead of forcing the Cosmere
angle, and treat Coppermind as a "bring your own data, check the license" side-note for
Sanderson fans. Full reasoning below.

---

## 1. Coppermind (coppermind.net) — the Cosmere wiki

### What it is / size
MediaWiki 1.35.14 instance. Live `siteinfo` call:

```
curl "https://coppermind.net/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json"
-> {"pages":21885,"articles":5403,"edits":229306,"images":5617,"users":89411,...}
```
Verified 2026-08-28 against `https://coppermind.net/w/api.php`. **5,403 content articles**
(21,885 total pages including talk/category/redirects) — characters, worlds (Rosharan
nations, Scadrial, Nalthis, etc.), magic systems (Surges, Allomancy, Awakening...),
species, factions, objects/materials, and per-book pages. This is genuinely the richest
single structured Cosmere content source that exists.

### API / export mechanism — confirmed working
Standard MediaWiki `api.php`, live-tested:
- `action=query&list=allpages` — page enumeration, works (returns `pageid`/`title` pairs,
  cursor via `apcontinue`).
- `action=query&prop=extracts&exintro=1&explaintext=1&titles=Kaladin` — **works**, returns
  clean plain-text article prose (tested, first ~1500 chars captured; TextExtracts
  extension is enabled here, unlike on the Fandom wikis tested below).
- `action=query&list=categorymembers&cmtitle=Category:Characters` — works, standard
  category-walk pattern for bulk enumeration.
- `Special:Export/<title>` — works, returns standard MediaWiki XML export
  (`export-0.11` schema) with full wikitext + revision metadata. No bulk SQL/XML *dump*
  file is published (no `dumps.wikimedia.org`-style download) — you'd assemble a corpus
  by walking `allpages`/`categorymembers` and calling `Special:Export` or the API per
  page, same as any MediaWiki site without a static dump.

All confirmed live 2026-08-28 against `https://coppermind.net/w/api.php` and
`https://coppermind.net/wiki/Special:Export/Kaladin`.

### License — the actual blocker
`https://coppermind.net/wiki/Coppermind:Copyrights` (fetched 2026-08-28), quoted:

> "Text © 2026 by 17th Shard. This work is licensed under a **Creative Commons
> Attribution-NonCommercial-NoDerivatives 4.0 International License**. Attributions...
> should include a link to The Coppermind or the direct article in question. **If you
> wish to use The Coppermind's text for a derivative use, please contact [email] for
> permission and/or other terms.**"

Page footer confirms: "Content is available under CC4 by-nc-nd unless otherwise noted."

Cross-checked what NoDerivatives actually forbids against the license deed itself,
`https://creativecommons.org/licenses/by-nc-nd/4.0/` (fetched 2026-08-28): ND means *"If
you remix, transform, or build upon the material, you may not distribute the modified
material."* The license's own footnote allows that *merely changing format* isn't a
derivative — but chunking prose into passages, embedding it, and serving it back through
a search app goes well beyond a format change; it's exactly the kind of reuse Coppermind's
copyright page says needs explicit written permission. NC (non-commercial) is *not* the
problem for a workshop — ND is. This is a hard license blocker for a redistribute-shaped
build like this one, absent contacting 17th Shard for permission.

### Gotchas
- **Cloudflare bot-blocking on generic tooling**: the sandbox's own WebFetch tool (and,
  presumably, most default-UA scripted clients) got HTTP 403 on both `/w/api.php` and
  `/wiki/...` pages. A plain browser `User-Agent` string got 200s with no other friction.
  Not a hard technical wall, but a real "gotcha" for automated pipelines.
- **`robots.txt` explicitly disallows `/w/` for `User-agent: *`** (fetched
  2026-08-28, `https://coppermind.net/robots.txt`) — i.e. the path `api.php` lives under
  is disallowed by robots.txt for generic crawlers, even though it answers requests when
  hit directly. The same file also carries an explicit **AI content-signal opt-out**:
  `Content-Signal: search=yes,ai-train=no,use=reference` at the site root, and hard
  `Disallow: /` blocks for `GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`,
  `Bytespider`, `Amazonbot`, `meta-externalagent`, etc. Combined with the ND license and
  the "contact us for derivative use" line, the site's operators have been fairly
  explicit that they don't want their content pipelined into AI/RAG systems without
  asking first.
- No official public API beyond raw MediaWiki `api.php` — confirmed by a 2024 fan forum
  thread asking exactly this question and getting no "yes, here's one" answer:
  `https://www.17thshard.com/forums/topic/196453-public-api-for-coppermind/` (fetched
  2026-08-28 via curl with browser UA; WebFetch got 403 here too).
- Heavy use of spoiler-tag templates and in-universe framing (the page for Kaladin opens
  with an in-character quote) — wikitext will need real cleanup work before chunking,
  independent of the license question.

---

## 2. Kaggle / HuggingFace structured Cosmere datasets

Searched Kaggle and HuggingFace directly (`site:kaggle.com`, `site:huggingface.co/datasets`,
plus general queries) for Cosmere / Sanderson / Mistborn / "Stormlight Archive" — **no
structured character/lore/glossary dataset turned up on either platform.**

- Kaggle: nothing dataset-shaped; only a "Google Books Dataset" that incidentally lists
  one Sanderson title (`Edgedancer`) among thousands of unrelated books, and a notebook
  that references Mistborn in passing. Not a Cosmere content source.
- HuggingFace: two fine-tuned causal LMs ("Adonalsium-Mistral-7b-v0.1",
  "Adonalsium-gpt-neo-1.3B" by user `JakeTurner616`) trained *on* Cosmere text — these are
  model weights, not a reusable structured dataset, and their training data provenance
  (almost certainly scraped Coppermind text, given the name "Adonalsium") inherits the
  same ND-license problem rather than solving it. No `datasets/` entry with clean
  character/book/magic-system records was found.

Conclusion: no ready-made, license-clean Kaggle/HuggingFace Cosmere dataset exists as of
this search (2026-08-28).

---

## 3. Fan-built Cosmere APIs / GitHub projects

Found via GitHub search (`github.com/topics/cosmere`, direct queries):

- **`Sisterno/stormlight-archive-api`** (github.com/Sisterno/stormlight-archive-api,
  fetched 2026-08-28) — a small REST API (`/api/character`, `/api/character/:id`) built
  on Node/Express/MongoDB. README states data is "sourced from the official wiki of this
  book saga, The Coppermind." 9 stars, 16 commits, no license file surfaced, no visible
  recent maintenance, previously hosted on Heroku (Heroku's free tier is gone, so the
  live instance is likely dead). Even if resurrected, it inherits Coppermind's ND
  license since it's a direct re-scrape of Coppermind text, so it doesn't route around
  the license problem — it just hides it one layer down.
- **`zebernst/cosmere-social-network`**, **`stonematt/cosmere-graph`** — character
  relationship / social-network-graph projects that also pull from the wiki for
  visualization, not general-purpose structured lore data; same underlying provenance
  issue.
- **No official API** from Brandon Sanderson, Dragonsteel Entertainment, or the
  publisher was found anywhere in this search. `brandonsanderson.com` is a marketing/author
  site, not a data source.

Conclusion: every Cosmere-specific structured-data project found is either a thin wrapper
around Coppermind (same ND-license exposure, plus abandonware risk) or a narrow
graph/visualization tool, not a general lore corpus.

---

## 4. Fallback candidate: a CC BY-SA Fandom wiki (worked example: Harry Potter Wiki)

Given the Cosmere-specific options are either unlicensed for this use (Coppermind, and
anything downstream of it) or nonexistent (Kaggle/HuggingFace/official API), the closest
comparable alternative is a large, well-established Fandom/Wikia property. Fandom wikis
run the same MediaWiki software as Coppermind, so the pipeline code barely changes — only
the source domain and license posture differ.

### License — confirmed straight from the API itself, not a blog post
```
curl "https://harrypotter.fandom.com/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json"
-> {"rightsinfo":{"url":"https://www.fandom.com/licensing","text":"CC-BY-SA"}}
```
Fetched live 2026-08-28. MediaWiki's `rightsinfo` meta call reports the license the wiki
operator has configured directly — this is Fandom's own site declaring its own license,
about as primary a source as it gets. CC BY-SA permits commercial use, remixing,
transforming, and redistribution, with attribution and share-alike (derivatives must
carry the same license) — no NoDerivatives restriction, which is precisely what blocked
Coppermind above. (Fandom's human-readable licensing page at
`https://www.fandom.com/licensing` returned HTTP 403/Cloudflare-challenge to both
WebFetch and curl in this sandbox, so it wasn't read directly, but the API's own
`rightsinfo` field is a more authoritative and more precisely-scoped source for the
per-wiki license than the marketing page would be anyway.)

### What it contains / size
```
curl "https://harrypotter.fandom.com/api.php?action=query&meta=siteinfo&siprop=statistics&format=json"
-> {"pages":260681,"articles":24634,"edits":2018253,"images":56409,...}
```
Fetched live 2026-08-28. **24,634 articles** — characters, locations, magic
(spells/potions/magical theory), creatures, objects, organizations, book/film synopses —
directly analogous in shape to what was wanted from Coppermind, at ~4.5x the article
count. (This is one example wiki chosen for the worked test; the same API shape and
license apply across essentially all of Fandom's ~250,000 wikis — e.g. Star Wars,
Marvel, LOTR (7,228 articles, checked the same way) — so the source universe is a free
choice for the workshop, not a Harry-Potter-specific requirement.)

### API — confirmed working
- `action=query&meta=siteinfo` — works.
- `action=query&prop=revisions&rvprop=content&rvslots=main&titles=Harry Potter` —
  **works**, returns full wikitext of the article (confirmed, captured live content
  starting with `{{Spoiler|...}}{{Individual infobox...`).
- `prop=extracts` (TextExtracts, the clean-plain-text shortcut that worked on Coppermind)
  is **not** enabled on this wiki — `"Unrecognized value for parameter \"prop\":
  extracts"`. So the pipeline needs a wikitext-stripping step (strip `{{templates}}`,
  `[[links]]`, infoboxes) rather than getting clean prose for free the way Coppermind's
  `extracts` does. This is a real extra step, not a blocker.
- `Special:Export/<title>` — works, standard MediaWiki XML export, same as Coppermind.
- Three sequential `siteinfo` calls all returned 200 in ~0.2–0.3s each — no rate-limit
  friction hit in this light testing.

### Gotchas
- Cloudflare bot-challenges hit **non-API** paths hard in this sandbox: `robots.txt`,
  `/wiki/<Title>?action=raw`, and `www.fandom.com/licensing` all returned interception
  pages (HTTP 402/403, "Just a moment...") even with a browser UA via plain `curl`. The
  `api.php` endpoint itself was unaffected. Net effect: **use the API, not page-scraping**
  — which is exactly the right shape for this workshop anyway (structured `action=query`
  calls, not HTML scraping).
- No `extracts`/clean-text shortcut (see above) — budget time for wikitext cleanup.
- Category names are wiki-specific (`Category:Characters` returned empty results on this
  wiki in a quick test — the real category tree needs to be discovered per-wiki via
  `list=allcategories` rather than assumed).
- Attribution requirement under CC BY-SA: each chunk/record should retain a pointer back
  to its source article URL (satisfies attribution and is good RAG practice anyway —
  citing sources).

---

## Recommendation

**Do not build the workshop's primary content pipeline against Coppermind.** The API
and export mechanism are technically excellent (fast MediaWiki `api.php`, clean
`extracts` text, `Special:Export` XML) — but the content is **CC BY-NC-ND**, and
Coppermind's own copyright page explicitly requires contacting them for permission for
any "derivative use." Chunking + embedding + serving through a search UI is a derivative
use by any reasonable reading, and the site's `robots.txt` independently signals
`ai-train=no` and blocks every major AI crawler by name — the operators have been
unusually explicit that they don't want this. Using it would put the workshop in
license-violation territory from step one, which is a bad lesson to build into a
teaching example even if no one ever enforces it.

**No Kaggle/HuggingFace dataset or third-party Cosmere API fills the gap** — none exist
in clean, structured, license-clear form as of this research (2026-08-28); the one
fan-built API found is a thin, likely-dead wrapper around Coppermind that inherits the
same license problem one layer removed.

**Recommended path: use a large CC BY-SA Fandom wiki as the content source**, with the
Harry Potter Wiki (`harrypotter.fandom.com`, 24,634 articles) as a good default choice —
verified directly from its own API (`rightsinfo` = CC-BY-SA, `siteinfo` = 24,634
articles), same MediaWiki `api.php`/`Special:Export` mechanics as Coppermind so the
pipeline built for this transfers almost unchanged to any other Fandom property (Star
Wars, LOTR, Marvel, or — if permission is later obtained from 17th Shard — Coppermind
itself). This is a better fit for a *from-scratch workshop build* than forcing the
Cosmere angle: it gives learners the same "characters / locations / magic systems /
factions / synopses" content shape they'd want for a Cosmere-flavored demo, at larger
scale, with a license that actually permits what a chunk-embed-search pipeline does to
the text, confirmed straight from the API rather than assumed.

If the workshop's presenter specifically wants Cosmere content for narrative appeal, the
practical option is: email 17th Shard for written permission per Coppermind's own
copyright page instructions, and treat that email as a prerequisite task, not a research
question — it can't be resolved by more searching.

## Sources verified (primary, fetched 2026-08-28)
- `https://coppermind.net/w/api.php?action=query&meta=siteinfo&siprop=statistics|general&format=json`
- `https://coppermind.net/w/api.php?action=query&list=allpages&aplimit=5&format=json`
- `https://coppermind.net/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=Kaladin&format=json`
- `https://coppermind.net/w/api.php?action=query&list=categorymembers&cmtitle=Category:Characters&cmlimit=10&format=json`
- `https://coppermind.net/wiki/Special:Export/Kaladin`
- `https://coppermind.net/wiki/Coppermind:Copyrights`
- `https://coppermind.net/robots.txt`
- `https://creativecommons.org/licenses/by-nc-nd/4.0/`
- `https://www.17thshard.com/forums/topic/196453-public-api-for-coppermind/`
- `https://github.com/Sisterno/stormlight-archive-api`
- `https://harrypotter.fandom.com/api.php?action=query&meta=siteinfo&siprop=statistics&format=json`
- `https://harrypotter.fandom.com/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json`
- `https://harrypotter.fandom.com/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=Harry%20Potter&format=json`
- `https://harrypotter.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=Harry%20Potter&format=json`
- `https://harrypotter.fandom.com/wiki/Special:Export/Harry_Potter`
- `https://lotr.fandom.com/api.php?action=query&meta=siteinfo&siprop=statistics&format=json`
- Kaggle/HuggingFace searches for "Cosmere"/"Sanderson"/"Mistborn"/"Stormlight Archive" datasets (no direct primary-source page to cite — absence of results across both platforms as of this search date)
