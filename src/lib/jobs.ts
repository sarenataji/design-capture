import type { Job } from "./types";

export const JOBS: {
  id: Job;
  label: string;
  sentence: string;
  plain: string;
}[] = [
  {
    id: "rebuild",
    label: "Rebuild",
    sentence:
      "Rebuild this pattern in our product. Keep measured numbers. Swap brand and copy.",
    plain:
      "Make the same thing inside your own app — same sizes and spacing, but with your words and your brand.",
  },
  {
    id: "restyle",
    label: "Restyle",
    sentence:
      "Keep our screens. Absorb this look (type, density, radius, color roles).",
    plain:
      "Keep your pages as they are and just borrow the look: fonts, colours, and rounded corners.",
  },
  {
    id: "system",
    label: "System",
    sentence: "DESIGN.md only. No page. Tokens, rules, and anti-patterns.",
    plain:
      "Build nothing yet. Write down the style rules so everything you make later looks consistent.",
  },
  {
    id: "translate",
    label: "Translate",
    sentence:
      "Same pattern, other stack. Preserve hierarchy and rhythm. Drop hover-only fluff that has no native equivalent.",
    plain:
      "Same design, different technology — for moving it to a phone app or another setup.",
  },
  {
    id: "motion",
    label: "Motion",
    sentence:
      "Layout stays. Copy measured states and timing only. Do not restyle.",
    plain:
      "Copy only the movement — hovers, fades, and timing. The look stays untouched.",
  },
];

export function jobSentence(job: Job): string {
  return JOBS.find((item) => item.id === job)?.sentence ?? JOBS[0]!.sentence;
}
