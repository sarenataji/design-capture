import type { OutputKind } from "./types";

export const OUTPUTS: { id: OutputKind; label: string; plain: string }[] = [
  {
    id: "photocopy",
    label: "Photocopy",
    plain:
      "An exact recipe of the thing you clicked — every colour, size and gap, measured, not guessed.",
  },
  {
    id: "prompt",
    label: "Prompt",
    plain: "That recipe plus your instructions, ready to paste into an AI chat.",
  },
  {
    id: "design-md",
    label: "DESIGN.md",
    plain: "A style guide for your project so everything you build later matches.",
  },
  {
    id: "skill-md",
    label: "SKILL.md",
    plain: "A reusable file that teaches your AI assistant this style for next time.",
  },
  {
    id: "css",
    label: "CSS",
    plain: "Finished styling code you can drop into a normal web page.",
  },
  {
    id: "tailwind",
    label: "Tailwind",
    plain: "The same styling written as Tailwind's shorthand classes.",
  },
];
