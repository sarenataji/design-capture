import type {
  CaptureResult,
  Direction,
  NodeCapture,
  OutputKind,
  StyleMap,
} from "./types";

function stylesBlock(title: string, styles: StyleMap): string {
  const entries = Object.entries(styles);
  if (!entries.length) return "";
  const body = entries.map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `${title} {\n${body}\n}`;
}

function nodeTree(node: NodeCapture, depth = 0): string {
  const pad = "  ".repeat(depth);
  const meta = [
    node.tag,
    node.id ? `#${node.id}` : "",
    `${node.box.width}×${node.box.height}`,
  ]
    .filter(Boolean)
    .join(" ");
  const text = node.text ? ` "${node.text.slice(0, 60)}"` : "";
  const kids = node.children.map((child) => nodeTree(child, depth + 1)).join("");
  return `${pad}- ${meta}${text}\n${kids}`;
}

function targetHint(capture: CaptureResult): string {
  switch (capture.target) {
    case "react":
      return "Ship a React component. Semantic HTML. Tokens as CSS variables.";
    case "react-native":
      return "Ship React Native. Map px to density-independent units. No DOM. Hover becomes press/focus if it carries meaning; drop decorative hover.";
    case "tailwind":
      return "Ship Tailwind utilities. Map to existing theme tokens before inventing classes.";
    case "html":
      return "Ship semantic HTML + CSS.";
    default:
      return "Use the project's existing stack. Do not introduce a new UI library.";
  }
}

function hasMap(styles: StyleMap): boolean {
  return Object.keys(styles).length > 0;
}

function measuredNotes(capture: CaptureResult): string {
  const missing: string[] = [];
  if (!hasMap(capture.node.hover)) {
    missing.push("Hover styles were not in the stylesheets. Do not invent a hover look.");
  }
  if (!hasMap(capture.node.focus)) {
    missing.push("Focus styles were not observed. Add a visible focus ring that matches the accent, do not skip accessibility.");
  }
  if (!capture.motion.animations.length && !capture.motion.transitions.length) {
    missing.push("No motion was observed. Keep the rebuild still unless intent asks otherwise.");
  }
  if (!capture.tokens.cssVariables.length) {
    missing.push("No CSS variables on :root. Treat listed colors as a palette, name them by role, do not keep hex scattered in components.");
  }
  return missing.map((line) => `- ${line}`).join("\n") || "- All core layers were observed.";
}

const DIRECTION_JOB: Record<Direction, string> = {
  rebuild:
    "Rebuild this one pattern in our product. Translate the design language. Do not photocopy the source site.",
  restyle:
    "Keep our product's information and components. Absorb this capture as visual direction (type, color roles, density, radius, motion).",
  system:
    "Do not build a page. Produce a DESIGN.md the rest of the project can follow. Tokens first, then rules, then anti-patterns.",
  translate:
    "Translate this pattern into the target stack. Preserve hierarchy, rhythm, and contrast. Drop web-only tricks that have no native equivalent.",
  motion:
    "Keep the current layout. Recreate only interaction and motion: hover, focus, active, transition, keyframes, stagger.",
};

const DIRECTION_ORDER: Record<Direction, string> = {
  rebuild: `1. Color roles and type scale
2. Structure and spacing
3. Radius, shadow, density
4. States and motion
5. Copy voice last — replace source marketing text with our product`,
  restyle: `1. Map captured colors onto our existing tokens (do not duplicate palettes)
2. Type scale and weight
3. Density (padding, gap, radius)
4. Motion if it improves clarity
5. Leave our IA and copy unless intent says otherwise`,
  system: `1. Palette with roles (bg, ink, accent, border, muted)
2. Type ramp
3. Spacing and radius ladder
4. Shadow / depth
5. Do / don't
6. One example component, not a full UI`,
  translate: `1. Hierarchy and grouping
2. Contrast and type
3. Spacing rhythm
4. Platform-native controls
5. Motion only if the platform can do it well`,
  motion: `1. Resting state as ground truth
2. Hover / focus / active diffs
3. Timing, easing, delay, stagger
4. Reduced-motion fallback`,
};

function qualityBar(capture: CaptureResult): string {
  return `## Definition of done
A pass looks like a designed product, not an AI default.
- One accent. Identity color sits on labels/content, not on every surface.
- Type hierarchy is obvious at a glance (display / title / body / meta).
- Spacing is a ladder, not random 13px / 17px values. Snap to 4 or 8.
- Radius is consistent across the component.
- Contrast holds for body text (captured pair: ${
    capture.contrast[0]
      ? `${capture.contrast[0].fg} on ${capture.contrast[0].bg} ${capture.contrast[0].ratio}:1 ${capture.contrast[0].aa ? "AA" : "below AA — fix"}`
      : "not measured — check"
  }).
- States exist: rest + at least focus. Hover only if measured or native-appropriate.
- No Inter-on-white, no purple gradient buttons, no colored dots as identity, no fake glass on every card.

## Refuse
- Cloning logos, mascots, product names, or illustrations from the source.
- Building the whole website. This is one pattern.
- Inventing tokens that fight the project's existing design system.
- Decorative animation that was not in the capture (unless direction is motion and intent asks).`;
}

export function toPrompt(capture: CaptureResult): string {
  const direction = capture.direction ?? "rebuild";
  const hover = stylesBlock(`${capture.node.tag}:hover`, capture.node.hover);
  const focus = stylesBlock(`${capture.node.tag}:focus`, capture.node.focus);
  const active = stylesBlock(`${capture.node.tag}:active`, capture.node.active);
  const rest = stylesBlock(capture.node.tag, capture.node.styles);
  const motion = [
    ...capture.motion.transitions.map((t) => `transition: ${t}`),
    ...capture.motion.animations.map((a) => `animation: ${a}`),
    ...capture.motion.keyframes.map((k) => k.css),
  ].join("\n");

  const colors = capture.tokens.colors
    .slice(0, 10)
    .map((c) => `- ${c.value} · ${c.roles.join(", ")} · seen ${c.count}×`)
    .join("\n");
  const fonts = capture.tokens.fonts
    .map(
      (f) =>
        `- ${f.family} · weights ${f.weights.join("/")} · ${f.sizes.join(", ")}`,
    )
    .join("\n");

  return [
    `# Job
${DIRECTION_JOB[direction]}
${targetHint(capture)}`,
    capture.intent
      ? `\n# Intent (overrides everything below if they conflict)\n${capture.intent}`
      : `\n# Intent\nNone given. Infer the product from the repo you are in. If you cannot, ask — do not guess a brand.`,
    `\n# Decision order\n${DIRECTION_ORDER[direction]}`,
    `\n# Translate, don't photocopy
The capture is a measured reference, not source code to paste.
Keep: hierarchy, rhythm, contrast, type scale, radius, motion character.
Replace: brand, copy, imagery, and any token that already exists in this repo.`,
    `\n# Source
${capture.title}
${capture.url}
Viewport ${capture.viewport.width}×${capture.viewport.height} · selector \`${capture.selector}\` · ${capture.node.box.width}×${capture.node.box.height}`,
    `\n# Structure (measured)\n${nodeTree(capture.node)}`,
    rest ? `\n# Resting styles (measured)\n\`\`\`css\n${rest}\n\`\`\`` : "",
    hover ? `\n# Hover (measured)\n\`\`\`css\n${hover}\n\`\`\`` : "",
    focus ? `\n# Focus (measured)\n\`\`\`css\n${focus}\n\`\`\`` : "",
    active ? `\n# Active (measured)\n\`\`\`css\n${active}\n\`\`\`` : "",
    motion ? `\n# Motion (measured)\n\`\`\`css\n${motion}\n\`\`\`` : "",
    `\n# Tokens from the page
Colors:
${colors || "- none"}

Type:
${fonts || "- none"}

Spacing: ${capture.tokens.spacing.slice(0, 8).join(" | ") || "none"}
Radii: ${capture.tokens.radii.slice(0, 6).join(" | ") || "none"}
Shadows: ${capture.tokens.shadows.slice(0, 4).join(" | ") || "none"}`,
    `\n# Gaps in the capture\n${measuredNotes(capture)}`,
    `\n${qualityBar(capture)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function toDesignMd(capture: CaptureResult): string {
  const colors = capture.tokens.colors
    .map((c) => `| ${c.value} | ${c.roles.join(", ")} | ${c.count} |`)
    .join("\n");
  const fonts = capture.tokens.fonts
    .map((f) => `- **${f.family}**: ${f.weights.join(", ")} · ${f.sizes.join(", ")}`)
    .join("\n");
  const vars = capture.tokens.cssVariables
    .map((v) => `- \`${v.name}\`: ${v.value}`)
    .join("\n");

  return `# DESIGN.md

Visual language measured from [${capture.title}](${capture.url}).
This file is the source of truth for look. Product copy and brand live elsewhere.

## How to use
1. Map these values onto the project's tokens if they already exist.
2. Name colors by role, not by hex in components.
3. Snap spacing to a 4/8 ladder when implementing.

## Color
| Value | Roles | Frequency |
| --- | --- | --- |
${colors || "| — | — | — |"}

## Typography
${fonts || "- (none detected)"}

## Spacing
${capture.tokens.spacing.map((s) => `- ${s}`).join("\n") || "- 0"}

## Radius
${capture.tokens.radii.map((s) => `- ${s}`).join("\n") || "- 0"}

## Shadow
${capture.tokens.shadows.map((s) => `- ${s}`).join("\n") || "- none"}

## CSS variables
${vars || "- none"}

## Example pattern
\`${capture.selector}\` · ${capture.node.box.width}×${capture.node.box.height}

### Do
- One accent. Put identity on content, not on every chrome surface.
- Keep type hierarchy and density from the capture.
- Preserve measured motion; do not add extra.

### Don't
- Inter / system-ui as a stand-in if a display face was measured.
- Purple SaaS gradients, colored identity dots, glass on every card.
- Clone the source logo, name, or illustration.
`;
}

export function toSkillMd(capture: CaptureResult): string {
  const direction = capture.direction ?? "rebuild";
  return `---
name: captured-design
description: Apply the measured design language from ${capture.title}. Direction: ${direction}.
---

# Captured design skill

${DIRECTION_JOB[direction]}

Decision order:
${DIRECTION_ORDER[direction]}

${toDesignMd(capture)}

## Agent rules
1. Intent wins if it conflicts with the capture.
2. Measured styles beat guesses. If a state is missing, follow Gaps in the capture.
3. Translate into this repo's components. Do not paste the source DOM.
4. Stop after one pattern unless asked for a system.
`;
}

export function toCss(capture: CaptureResult): string {
  const root = capture.tokens.cssVariables
    .map((v) => `  ${v.name}: ${v.value};`)
    .join("\n");
  const rest = Object.entries(capture.node.styles)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  const hover = Object.entries(capture.node.hover)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  const keyframes = capture.motion.keyframes.map((k) => k.css).join("\n\n");
  return [
    root ? `:root {\n${root}\n}` : "",
    `${capture.node.tag.replace(/[^a-z0-9-]/gi, "") || "component"} {\n${rest}\n}`,
    hover ? `${capture.node.tag}:hover {\n${hover}\n}` : "",
    keyframes,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function approxTailwind(prop: string, value: string): string | null {
  const px = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  const n = px ? Math.round(Number(px[1])) : null;
  const space = n !== null ? Math.round(n / 4) : null;

  if (prop === "display") {
    if (value === "flex") return "flex";
    if (value === "grid") return "grid";
    if (value === "none") return "hidden";
    if (value === "block") return "block";
  }
  if (prop === "flex-direction" && value === "column") return "flex-col";
  if (prop === "align-items") {
    if (value === "center") return "items-center";
    if (value === "flex-start") return "items-start";
    if (value === "flex-end") return "items-end";
  }
  if (prop === "justify-content") {
    if (value === "center") return "justify-center";
    if (value === "space-between") return "justify-between";
    if (value === "flex-start") return "justify-start";
  }
  if (prop === "font-weight") {
    const w = Number(value);
    if (w >= 700) return "font-bold";
    if (w >= 600) return "font-semibold";
    if (w >= 500) return "font-medium";
    return "font-normal";
  }
  if (prop === "text-align" && value === "center") return "text-center";
  if (prop === "border-radius" && n !== null) {
    if (n >= 999) return "rounded-full";
    if (n >= 16) return "rounded-2xl";
    if (n >= 12) return "rounded-xl";
    if (n >= 8) return "rounded-lg";
    if (n >= 4) return "rounded-md";
    return "rounded";
  }
  if ((prop === "padding" || prop === "margin" || prop === "gap") && space !== null) {
    const prefix = prop === "padding" ? "p" : prop === "margin" ? "m" : "gap";
    return `${prefix}-${Math.min(space, 24)}`;
  }
  if (prop === "font-size" && n !== null) {
    if (n >= 36) return "text-4xl";
    if (n >= 30) return "text-3xl";
    if (n >= 24) return "text-2xl";
    if (n >= 20) return "text-xl";
    if (n >= 18) return "text-lg";
    if (n >= 16) return "text-base";
    if (n >= 14) return "text-sm";
    return "text-xs";
  }
  return null;
}

export function toTailwind(capture: CaptureResult): string {
  const classes = Object.entries(capture.node.styles)
    .map(([k, v]) => approxTailwind(k, v))
    .filter(Boolean);
  const unique = [...new Set(classes)];
  return [
    `<!-- approx Tailwind from computed styles. Prefer tokens over these utilities. -->`,
    `<${capture.node.tag} class="${unique.join(" ")}">`,
    `  ${capture.node.text || ""}`,
    `</${capture.node.tag}>`,
    "",
    "Exact CSS (use when utilities cannot represent a value):",
    toCss(capture),
  ].join("\n");
}

export function renderOutput(kind: OutputKind, capture: CaptureResult): string {
  switch (kind) {
    case "design-md":
      return toDesignMd(capture);
    case "skill-md":
      return toSkillMd(capture);
    case "css":
      return toCss(capture);
    case "tailwind":
      return toTailwind(capture);
    default:
      return toPrompt(capture);
  }
}
