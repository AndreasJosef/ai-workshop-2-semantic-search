# Wheel of Time Fandom wiki instead of Coppermind as the content source

Coppermind (the Cosmere wiki) was the natural first choice for this knowledge base, but research (`.scratch/knowledge-base-dataset/research.md`) found its text is licensed **CC BY-NC-ND 4.0** — the No-Derivatives clause blocks exactly what a chunk → embed → search pipeline does — and its `robots.txt` independently sets `Content-Signal: ai-train=no` and disallows every major AI crawler by name. Coppermind's own copyright page requires contacting them for permission for any derivative use; we didn't have that permission.

We instead source content from the **Wheel of Time Fandom wiki** (`wot.fandom.com`), which Fandom licenses **CC BY-SA** — verified live via the wiki's own `rightsinfo` API call, not a secondary source — permitting the transform-and-redistribute use this project needs, with attribution. Wheel of Time was picked over other license-clean Fandom wikis (Harry Potter, Star Wars, LOTR — all same platform license) for thematic proximity to Cosmere: epic fantasy with a well-documented hard magic system, and a series Brandon Sanderson himself completed.

Consequence: any chunk shown in the UI should carry a pointer back to its source article (satisfies CC BY-SA attribution).
