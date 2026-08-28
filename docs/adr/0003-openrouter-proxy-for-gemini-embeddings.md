# Embed via OpenRouter's `/embeddings` endpoint, not Google's Gemini API directly

The spec called for embedding via Gemini's own API (`GEMINI_API_KEY`, `output_dimensionality` param), but the provisioned Gemini key stopped working. Rather than chase a new direct key, we route embedding calls through OpenRouter's OpenAI-compatible `/embeddings` endpoint instead (`model: google/gemini-embedding-001`, auth via `OPENROUTER_API_KEY`).

Before switching, we confirmed live that OpenRouter's endpoint honors a `dimensions` request parameter for this model — `dimensions: 768` and `dimensions: 3072` return vectors of those exact lengths, and omitting it defaults to 3072, matching Gemini's own default. So the dual-dimension requirement (ADR-0001) still holds; only the request shape changes: OpenAI-style `dimensions` instead of Google's `output_dimensionality`, and `OPENROUTER_API_KEY` instead of `GEMINI_API_KEY`.

Considered and rejected: generating a fresh Gemini API key and staying on the direct API. Rejected because a working OpenRouter key was already on hand, and OpenRouter's proxy is confirmed to preserve the one behavior (dimension control) the pipeline actually depends on.
