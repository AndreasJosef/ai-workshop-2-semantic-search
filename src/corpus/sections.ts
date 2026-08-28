import { HEADING_RE } from "./heading.js";

export interface Section {
  heading: string;
  text: string;
}

export function splitSections(prose: string): Section[] {
  const sections: Section[] = [];
  const stack: string[] = [];

  for (const block of prose.split(/\n(?===)/)) {
    const lines = block.split("\n");
    const first = lines[0] ?? "";
    const headingMatch = first.match(HEADING_RE);

    const body = (headingMatch ? lines.slice(1) : lines)
      .join("\n")
      .trim();

    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const title = headingMatch[2] ?? "";

      stack.length = Math.min(level - 1, stack.length);
      stack[level - 1] = title;

      if (body) sections.push({ heading: stack.filter(Boolean).join(" > "), text: body });
    } else if (body) {
      sections.push({ heading: "", text: body });
    }
  }

  return sections;
}
