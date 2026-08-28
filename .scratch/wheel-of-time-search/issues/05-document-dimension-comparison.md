# 05: Document the 768 vs 3072 comparison

**What to build:** The specific analysis deliverable called out in the spec's scope: evidence, in the repo, that the two embedding dimensions were actually compared and that someone reasoned about why their results diverge.

**Blocked by:** 04 (Search backend + web UI)

**Status:** ready-for-agent

- [ ] Using the working search UI's 768/3072 toggle, find 5 queries where the top results genuinely differ between the two dimensions
- [ ] For each of the 5 queries, record: the query text, the differing results (or ranking) at 768 vs 3072, and a brief explanation of why the results likely diverge
- [ ] The write-up is committed to the repo (e.g. alongside the spec) so it's part of the workshop deliverable, not just a chat transcript
