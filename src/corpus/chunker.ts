import { sourceUrlFor } from "./api.js";
import type { Section } from "./sections.js";

const MAX_TOKENS = 400;
const MIN_TOKENS = 200;
const OVERLAP_TOKENS = 75;

export interface ChunkMetadata {
  articleTitle: string;
  sectionHeading: string;
  sourceUrl: string;
  chunkIndex: number;
}

export interface Chunk {
  content: string;
  metadata: ChunkMetadata;
}

export function estimateTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitFixed(text: string): string[] {
  const words = text.split(/\s+/);

  if (words.length <= MAX_TOKENS) return [text];

  const windows: string[] = [];
  let pos = 0;

  while (pos < words.length) {
    if (words.length - pos <= MAX_TOKENS) {
      windows.push(words.slice(pos).join(" "));
      break;
    }

    let end = pos + MAX_TOKENS;

    if (words.length - (end - OVERLAP_TOKENS) < MIN_TOKENS) {
      end = words.length - MIN_TOKENS + OVERLAP_TOKENS;
    }

    windows.push(words.slice(pos, end).join(" "));
    pos = end - OVERLAP_TOKENS;
  }

  return windows;
}

export function chunkSection(section: Section, articleTitle: string): Chunk[] {
  const estimate = estimateTokens(section.text);

  const contents = estimate > MAX_TOKENS ? splitFixed(section.text) : estimate > 0 ? [section.text] : [];

  return contents.map((content, chunkIndex) => ({
    content,
    metadata: {
      articleTitle,
      sectionHeading: section.heading,
      sourceUrl: sourceUrlFor(articleTitle),
      chunkIndex,
    },
  }));
}
