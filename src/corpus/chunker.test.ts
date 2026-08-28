import { describe, expect, it } from "vitest";

import { chunkSection } from "./chunker.js";

const longText = Array.from({ length: 800 }, (_, i) => `word${i}`).join(" ");

describe("chunkSection", () => {
  it("returns a single chunk for a short section", () => {
    const chunks = chunkSection({ heading: "Biography", text: "He was born in Emond's Field." }, "Rand al'Thor");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      content: "He was born in Emond's Field.",
      metadata: {
        articleTitle: "Rand al'Thor",
        sectionHeading: "Biography",
        sourceUrl: "https://wot.fandom.com/wiki/Rand_al%27Thor",
        chunkIndex: 0,
      },
    });
  });

  it("leaves the heading empty for the lead section", () => {
    const chunks = chunkSection({ heading: "", text: "Lead text." }, "One Power");

    expect(chunks[0]?.metadata.sectionHeading).toBe("");
  });

  it("splits a long section into overlapping fixed-size windows", () => {
    const chunks = chunkSection({ heading: "Biography", text: longText }, "Rand al'Thor");

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const tokens = chunk.content.split(" ").length;
      expect(tokens).toBeGreaterThanOrEqual(200);
      expect(tokens).toBeLessThanOrEqual(400);
    }

    const [first, second] = chunks;
    const firstTail = first!.content.split(" ").slice(-75).join(" ");
    expect(second!.content.startsWith(firstTail)).toBe(true);
    expect(second!.metadata.chunkIndex).toBe(1);
  });

  it("keeps multi-paragraph long sections within the token bounds", () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ${longText.slice(0, 600)}`);
    const chunks = chunkSection({ heading: "Plot", text: paragraphs.join("\n\n") }, "The Eye of the World");

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const tokens = chunk.content.split(" ").length;
      expect(tokens).toBeGreaterThanOrEqual(200);
      expect(tokens).toBeLessThanOrEqual(400);
    }
  });
});
