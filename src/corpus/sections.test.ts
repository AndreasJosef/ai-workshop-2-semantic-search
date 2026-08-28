import { describe, expect, it } from "vitest";

import { splitSections } from "./sections.js";

describe("splitSections", () => {
  it("uses the article's lead as the first section with an empty heading", () => {
    const result = splitSections("Lead paragraph text.\n\n== History ==\nMore text.");

    expect(result).toEqual([
      { heading: "", text: "Lead paragraph text." },
      { heading: "History", text: "More text." },
    ]);
  });

  it("keeps the full heading hierarchy in the heading name", () => {
    const result = splitSections("Intro.\n\n== Biography ==\nBio.\n\n=== Early life ===\nYoung.");

    expect(result).toEqual([
      { heading: "", text: "Intro." },
      { heading: "Biography", text: "Bio." },
      { heading: "Biography > Early life", text: "Young." },
    ]);
  });

  it("pops back to the parent heading when a subsection ends", () => {
    const result = splitSections(
      "Intro.\n\n== A ==\na.\n\n=== B ===\nb.\n\n== C ==\nc.",
    );

    expect(result.map((s) => s.heading)).toEqual(["", "A", "A > B", "C"]);
  });

  it("merges consecutive blank-separated paragraphs of one section into one text", () => {
    const result = splitSections("== Plot ==\nPara one.\n\nPara two.\n\nPara three.");

    expect(result).toEqual([{ heading: "Plot", text: "Para one.\n\nPara two.\n\nPara three." }]);
  });

  it("drops sections whose text is empty", () => {
    const result = splitSections("Lead.\n\n== Empty ==\n\n== Next ==\nWords.");

    expect(result.map((s) => s.heading)).toEqual(["", "Next"]);
  });
});
