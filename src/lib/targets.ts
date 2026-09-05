import type { Target } from "./types";

export const TARGETS: { id: Target; label: string; plain: string }[] = [
  {
    id: "auto",
    label: "Match my project",
    plain: "Match whatever your project already uses. Best pick if you're unsure.",
  },
  {
    id: "react",
    label: "React",
    plain: "For websites and web apps built with React — the most common setup.",
  },
  {
    id: "react-native",
    label: "React Native",
    plain: "For real iPhone and Android apps rather than a web page.",
  },
  {
    id: "tailwind",
    label: "Tailwind",
    plain: "For projects that style pages with Tailwind's shorthand classes.",
  },
  {
    id: "html",
    label: "HTML / CSS",
    plain: "Plain web page code with no framework. Works anywhere.",
  },
];
