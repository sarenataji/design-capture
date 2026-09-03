import type { Job } from "./types";

export const JOBS: { id: Job; label: string; sentence: string }[] = [
  {
    id: "rebuild",
    label: "Rebuild",
    sentence:
      "Rebuild this pattern in our product. Keep measured numbers. Swap brand and copy.",
  },
  {
    id: "restyle",
    label: "Restyle",
    sentence:
      "Keep our screens. Absorb this look (type, density, radius, color roles).",
  },
  {
    id: "system",
    label: "System",
    sentence: "DESIGN.md only. No page. Tokens, rules, and anti-patterns.",
  },
  {
    id: "translate",
    label: "Translate",
    sentence:
      "Same pattern, other stack. Preserve hierarchy and rhythm. Drop hover-only fluff that has no native equivalent.",
  },
  {
    id: "motion",
    label: "Motion",
    sentence:
      "Layout stays. Copy measured states and timing only. Do not restyle.",
  },
];

export function jobSentence(job: Job): string {
  return JOBS.find((item) => item.id === job)?.sentence ?? JOBS[0]!.sentence;
}
