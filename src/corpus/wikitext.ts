import { HEADING_RE } from "./heading.js";

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const REF_RE = /<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref>/g;
const REFS_TAG_RE = /<references\b[^>]*\/?>/gi;
const TABLE_RE = /\{\|[\s\S]*?\|\}/g;
const TEMPLATE_RE = /\{\{[^{}]*\}\}/g;
const TEMPLATE_PRESENT_RE = /\{\{[^{}]*\}\}/;
const LINK_RE = /\[\[([^\[\]]*)\]\]/g;
const LINK_PRESENT_RE = /\[\[[^\[\]]*\]\]/;
const DROP_LINK_PREFIXES = /^(?:[a-z]{2,3}:)?(?:file|image|category):/i;
const INTERWIKI_RE = /^[a-z]{2,3}:/i;
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&mdash;": "—",
  "&ndash;": "–",
};

function decodeEntities(text: string): string {
  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(char);
  }

  return text;
}

function resolveLink(_match: string, inner: string): string {
  const [target] = inner.split("|");

  if (!target || DROP_LINK_PREFIXES.test(target) || INTERWIKI_RE.test(target)) return "";

  const label = inner.includes("|") ? inner.slice(inner.lastIndexOf("|") + 1) : target;
  const anchor = label.split("#")[0] ?? "";

  return anchor.trim();
}

function stripEmptyHeadings(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    if (HEADING_RE.test(line)) {
      let j = i + 1;
      while (j < lines.length && lines[j]?.trim() === "") j++;
      const next = lines[j];

      if (next === undefined || HEADING_RE.test(next)) {
        i = j - 1;
        continue;
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

export function cleanWikitext(wikitext: string): string {
  let text = wikitext;

  text = text.replace(COMMENT_RE, "");
  text = text.replace(REF_RE, "");
  text = text.replace(REFS_TAG_RE, "");
  text = text.replace(TABLE_RE, "");

  while (TEMPLATE_PRESENT_RE.test(text)) {
    text = text.replace(TEMPLATE_RE, "");
  }

  while (LINK_PRESENT_RE.test(text)) {
    text = text.replace(LINK_RE, resolveLink);
  }

  text = text.replace(/'''?/g, "");
  text = decodeEntities(text);

  text = text.replace(/\(\s*\)/g, "");
  text = text.replace(/[ \t]+([,.;:!?])/g, "$1");

  text = stripEmptyHeadings(text);

  return text
    .split("\n")
    .map((line) => line.replace(/^[*#]+\s*/, "").replace(/[ \t]+/g, " ").trim())
    .filter((line) => line === "" || line.length > 2 || HEADING_RE.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
