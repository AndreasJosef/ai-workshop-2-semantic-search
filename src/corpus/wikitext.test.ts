import { describe, expect, it } from "vitest";

import { cleanWikitext } from "./wikitext.js";

const INFOBOX_WIKITEXT = `{{character
| image=Rand al'thor.jpg
| nationality=Andoran
| title=Dragon Reborn
| gender=Male
}}'''Rand al'Thor''' is the protagonist of the series. He was born in the [[Two Rivers]] region of [[Andor]].{{ref|chapter 1}}

His mentor was [[Moiraine Damodred|Moiraine]], an ''Aes Sedai'' of the [[Blue Ajah]].<ref name="teotw1">Some citation.</ref>

== Biography ==
<!-- This comment should vanish. -->
He grew up as a shepherd in {{Egwene|Emond's Field}} before leaving with the [[Tinker]]s.

{| class="wikitable"
! Column
|-
| Cell
|}

=== Early life ===
''See also: {{main|Two Rivers}}''
Rand spent his youth in [[Emond's Field]].
`;

describe("cleanWikitext", () => {
  it("strips infobox-style templates, refs, links, and emphasis", () => {
    const result = cleanWikitext(INFOBOX_WIKITEXT);

    expect(result).not.toContain("{{");
    expect(result).not.toContain("image=");
    expect(result).not.toContain("[[");
    expect(result).not.toContain("<ref");
    expect(result).not.toContain("<!--");
    expect(result).not.toContain("{|");
    expect(result).toContain("Rand al'Thor is the protagonist of the series.");
    expect(result).toContain("His mentor was Moiraine");
  });

  it("keeps section headers intact", () => {
    const result = cleanWikitext(INFOBOX_WIKITEXT);

    expect(result).toContain("== Biography ==");
    expect(result).toContain("=== Early life ===");
  });

  it("resolves [[target|label]] links to their label", () => {
    const result = cleanWikitext("He was guided by [[Moiraine Damodred|Moiraine]] to [[Tar Valon]].");

    expect(result).toBe("He was guided by Moiraine to Tar Valon.");
  });

  it("resolves plain [[links]] to their target", () => {
    const result = cleanWikitext("She traveled to [[Caemlyn]] at once.");

    expect(result).toBe("She traveled to Caemlyn at once.");
  });

  it("removes nested templates entirely", () => {
    const result = cleanWikitext("He wielded {{weapon|{{heron-marked blade}}}} proudly.");

    expect(result).toBe("He wielded proudly.");
  });

  it("removes headings that carry no body text", () => {
    const result = cleanWikitext("== Trivia ==\n=== Sub ===\n== Appearance ==\nHe is tall.");

    expect(result).toBe("== Appearance ==\nHe is tall.");
  });

  it("collapses runs of blank lines", () => {
    const result = cleanWikitext("First paragraph.\n\n\n\nSecond paragraph.");

    expect(result).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("tidies punctuation artifacts left behind by removed templates", () => {
    const result = cleanWikitext("At level {{strength}}, Rand was strong.");

    expect(result).toBe("At level, Rand was strong.");
  });

  it("removes empty parentheses left behind by removed templates", () => {
    const result = cleanWikitext("He carried an angreal () at all times.");

    expect(result).toBe("He carried an angreal at all times.");
  });

  it("removes file links whose captions contain nested links", () => {
    const result = cleanWikitext(
      "Text before.\n[[File:Mat.jpg|thumb|Mat with his [[ashblade]] sword]]\nText after.",
    );

    expect(result).not.toContain("File:");
    expect(result).not.toContain("[[");
    expect(result).toContain("Text before.");
    expect(result).toContain("Text after.");
  });

  it("removes references tags, interlanguage links, and leftover bullet markers", () => {
    const result = cleanWikitext("* on [[es:Ta'veren]] <references />\n\nBody text.");

    expect(result).not.toContain("[[");
    expect(result).not.toContain("<references");
    expect(result).not.toContain("es:");
    expect(result).toContain("Body text.");
  });

  it("replaces nbsp entities with spaces", () => {
    const result = cleanWikitext("Flame chapter&nbsp;icon");

    expect(result).toBe("Flame chapter icon");
  });

  it("decodes common HTML entities", () => {
    const result = cleanWikitext("He said &quot;stop&quot; &amp; went &mdash; south &ndash; &lt;fast&gt;.");

    expect(result).toBe('He said "stop" & went — south – <fast>.');
  });

  it("returns empty string for a wikitext that is only an infobox", () => {
    const result = cleanWikitext("{{stub|date=August 2026}}");

    expect(result).toBe("");
  });
});
