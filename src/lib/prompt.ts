import { cssColorToHex } from "./color";
import { jobSentence } from "./jobs";
import { scanToTokenBlock, toScanMd } from "./scan-report";
import type {
  CaptureResult,
  Job,
  NodeCapture,
  OutputKind,
  PageScan,
  StyleMap,
  TokenCapture,
} from "./types";

function sourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

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

function stateLine(label: string, measured: boolean): string {
  return measured
    ? `- **${label}:** measured`
    : `- **${label}:** not measured — don't invent`;
}

const EMPTY_TOKENS: TokenCapture = {
  colors: [],
  fonts: [],
  spacing: [],
  radii: [],
  shadows: [],
  cssVariables: [],
};

function tokensFor(capture: CaptureResult): TokenCapture {
  if (resolveJob(capture) === "system") {
    return capture.pageTokens ?? capture.tokens ?? EMPTY_TOKENS;
  }
  return capture.tokens ?? EMPTY_TOKENS;
}

function formatTokens(tokens: TokenCapture): string {
  const visual = (tokens.visualColors ?? [])
    .map((c) => `- ${c.value} · sampled from visible pixels`)
    .join("\n");
  const colors = tokens.colors
    .slice(0, 12)
    .map((c) => `- ${c.value} · ${c.roles.join(", ") || "other"} · seen ${c.count}×`)
    .join("\n");
  const fonts = tokens.fonts
    .map(
      (f) =>
        `- ${f.family} · weights ${f.weights.join("/")} · ${f.sizes.join(", ")}`,
    )
    .join("\n");
  const vars = tokens.cssVariables
    .slice(0, 24)
    .map((v) => `- \`${v.name}\`: ${v.value}`)
    .join("\n");
  return `Visible palette (includes canvas/WebGL/images/video):
${visual || "- not sampled"}

CSS colors (implementation values):
${colors || "- none"}

Type:
${fonts || "- none"}

Spacing: ${tokens.spacing.slice(0, 8).join(" | ") || "none"}
Radii: ${tokens.radii.slice(0, 6).join(" | ") || "none"}
Shadows: ${tokens.shadows.slice(0, 4).join(" | ") || "none"}

CSS variables:
${vars || "- none"}`;
}

function contrastLine(capture: CaptureResult): string {
  const pair = capture.contrast[0];
  if (!pair) return "not measured — check";
  return `${pair.fg} on ${pair.bg} ${pair.ratio}:1 ${
    pair.aa ? "AA" : "below AA — fix"
  }`;
}

function resolveJob(capture: CaptureResult): Job {
  return capture.job ?? capture.direction ?? "rebuild";
}

function measured(capture: CaptureResult) {
  return {
    hover: capture.measured?.hover ?? hasMap(capture.node.hover),
    focus: capture.measured?.focus ?? hasMap(capture.node.focus),
    active: capture.measured?.active ?? hasMap(capture.node.active),
    motion:
      capture.measured?.motion ??
      capture.motion.transitions.length +
        capture.motion.animations.length +
        capture.motion.keyframes.length +
        (capture.motion.effects?.length ?? 0) >
        0,
  };
}

function formatMotion(capture: CaptureResult): string {
  const effects = capture.motion.effects ?? [];
  const specs = effects.map((effect, index) => {
    const opacity = effect.values?.opacity;
    const fromOpacity = Number.parseFloat(opacity?.from ?? "");
    const toOpacity = Number.parseFloat(opacity?.to ?? "");
    const meaning = Number.isFinite(fromOpacity) && Number.isFinite(toOpacity)
      ? fromOpacity <= 0.1 && toOpacity >= 0.5
        ? "Reveals the target."
        : fromOpacity >= 0.5 && toOpacity <= 0.1
          ? "Hides the target."
          : "Changes the target's visibility."
      : effect.values?.transform
        ? "Moves, scales, or rotates the target."
        : "";
    const details = [
      `- **${index + 1}. ${effect.type}** on \`${effect.target}\``,
      `  - Trigger: ${effect.trigger}`,
      effect.triggerSource ? `  - Evidence${effect.triggerConfidence ? ` (${effect.triggerConfidence} confidence)` : ""}: ${effect.triggerSource}` : "",
      meaning ? `  - Behavior: ${meaning}` : "",
      effect.library
        ? `  - Library / engine (${effect.library.confidence} confidence): ${effect.library.name} — ${effect.library.evidence}`
        : "",
      `  - Properties: ${effect.properties.join(", ") || "resolved by keyframes"}`,
      effect.values && Object.keys(effect.values).length
        ? `  - Values: ${Object.entries(effect.values).map(([property, values]) => `${property} ${values.from} → ${values.to}`).join(" · ")}`
        : "",
      `  - Timing: ${effect.duration} duration · ${effect.delay} delay · ${effect.easing}`,
      `  - Playback: ${effect.iterations} iteration(s) · ${effect.direction} · fill ${effect.fill}${effect.playState ? ` · ${effect.playState}` : ""}`,
      effect.timeline ? `  - Timeline: ${effect.timeline}` : "",
      effect.type === "web-animation" && effect.keyframes?.length
        ? `  - Runtime keyframes:\n\n\`\`\`json\n${JSON.stringify(effect.keyframes, null, 2)}\n\`\`\``
        : "",
    ].filter(Boolean);
    return details.join("\n");
  }).join("\n\n");
  const libraries = (capture.motion.libraries ?? [])
    .map((lib) => `- ${lib.name} · ${lib.kind} · detected via ${lib.via}`)
    .join("\n");
  const raw = [
    ...capture.motion.transitions.map((item) => `transition: ${item}`),
    ...capture.motion.animations.map((item) => `animation: ${item}`),
    ...capture.motion.keyframes.map((item) => item.css),
  ].join("\n");
  if (!effects.length && !libraries && !raw) return "";

  return [
    `Captured at selection time. CSS declarations and currently existing Web Animations API effects are measurable; a JS animation created only after an untested click, scroll position, or route change is not observable yet.`,
    specs ? `### Effects\n${specs}` : "",
    libraries
      ? `### Libraries detected on this page\n${libraries}\n\nLibrary presence does not prove this exact element uses it; reproduce the measured effects above.`
      : `### Libraries\nNo motion library detected. This may be CSS, Web Animations API, or bundled code whose name is not exposed.`,
    raw ? `### Reusable CSS\n\`\`\`css\n${raw}\n\`\`\`` : "",
  ].filter(Boolean).join("\n\n");
}

export function toPhotocopy(capture: CaptureResult): string {
  const flags = measured(capture);
  const rest = stylesBlock(capture.node.tag, capture.node.styles);
  const hover = stylesBlock(`${capture.node.tag}:hover`, capture.node.hover);
  const focus = stylesBlock(`${capture.node.tag}:focus`, capture.node.focus);
  const active = stylesBlock(`${capture.node.tag}:active`, capture.node.active);
  const motion = formatMotion(capture);
  const assets = capture.assets
    .slice(0, 12)
    .map((asset) => {
      if (asset.kind === "svg" && asset.markup) {
        return `- svg ${asset.width}×${asset.height}\n\`\`\`svg\n${asset.markup.slice(0, 2000)}\n\`\`\``;
      }
      return `- ${asset.kind}${asset.width ? ` ${asset.width}×${asset.height}` : ""}${
        asset.alt ? ` alt="${asset.alt}"` : ""
      }${asset.src ? ` ${asset.src}` : ""}`;
    })
    .join("\n");

  return [
    `# Photocopy
Exact spec for the **selected** component. Rebuild this card/button 1:1.
Drop logos and legal copy unless you truly want a clone of the company.
This is not a prompt. Nothing here is a guess unless labeled.`,
`## Source
${sourceName(capture.url)}
${capture.url}
Viewport ${capture.viewport.width}×${capture.viewport.height}
\`${capture.selector}\` · ${capture.node.box.width}×${capture.node.box.height}`,
    `## Structure (measured)
${nodeTree(capture.node)}`,
    rest
      ? `## Computed CSS (diffed from browser defaults)
\`\`\`css
${rest}
\`\`\``
      : "",
    hover
      ? `## :hover (${flags.hover ? "measured" : "not measured"})
\`\`\`css
${hover}
\`\`\``
      : `## :hover
not measured — don't invent`,
    focus
      ? `## :focus (${flags.focus ? "measured" : "not measured"})
\`\`\`css
${focus}
\`\`\``
      : `## :focus
not measured — don't invent`,
    active
      ? `## :active (${flags.active ? "measured" : "not measured"})
\`\`\`css
${active}
\`\`\``
      : "",
    motion
      ? `## Motion (${flags.motion ? "measured" : "library evidence only"})\n${motion}`
      : `## Motion
not measured — don't invent`,
    `## Tokens (this component)
${formatTokens(capture.tokens ?? EMPTY_TOKENS)}`,
    `## Contrast
${contrastLine(capture)}`,
    assets ? `## Assets (this component)\n${assets}` : "",
    capture.html
      ? `## HTML (sanitized)
\`\`\`html
${capture.html}
\`\`\``
      : "",
    `## Gaps
${stateLine("hover", flags.hover)}
${stateLine("focus", flags.focus)}
${stateLine("active", flags.active)}
${stateLine("motion", flags.motion)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const KEEP_REPLACE = `## Keep / replace
- **Keep:** hierarchy, type scale, density, radius, contrast, motion character.
- **Replace:** brand, copy, logos, tokens you already own.`;

const DONE_WHEN = `## Done when
- One accent. Identity sits on the label/content, not the fill of every surface.
- Real type ladder (display / title / body / meta).
- Spacing on 4/8.
- Focus visible.
- No Inter-on-white. No purple gradients. No colored dots as identity.`;

const RULE = `## Rule
Translate the language, don't photocopy the **site**. You can still photocopy the **component**.`;

export function toPrompt(
  capture: CaptureResult,
  scan?: PageScan | null,
): string {
  const job = resolveJob(capture);
  const flags = measured(capture);
  const photocopy = toPhotocopy(capture);
  const site = scan
    ? `\n## Site scan (detected)
Use this palette and stack. It does not replace the component photocopy.

${scanToTokenBlock(scan)}`
    : capture.pageTokens && job !== "system"
      ? `\n## Page tokens (secondary)
Useful for Prompt/System. Do not dump these into a single-button rebuild.

${formatTokens(capture.pageTokens)}`
      : "";

  return [
    `# Job
${jobSentence(job)}
${targetHint(capture)}`,
    capture.intent
      ? `# Intent
Your product language. Overrides the capture on conflict.

${capture.intent}`
      : `# Intent
None given. Infer the product from the repo you are in. If you cannot, ask — do not guess a brand. Do not default to cloning the page.`,
    KEEP_REPLACE,
    DONE_WHEN,
    RULE,
    `# Gaps
${stateLine("hover", flags.hover)}
${stateLine("focus", flags.focus)}
${stateLine("active", flags.active)}
${stateLine("motion", flags.motion)}
If a state was **not** in the CSS, mark it **not measured — don't invent**.`,
    `# Capture body
${photocopy}${site}`,
  ].join("\n\n");
}

export function toDesignMd(
  capture: CaptureResult,
  scan?: PageScan | null,
): string {
  if (scan) {
    return `${toScanMd(scan)}

## Example pattern
\`${capture.selector}\` · ${capture.node.box.width}×${capture.node.box.height}

### Do
- One accent. Put identity on content, not on every chrome surface.
- Keep type hierarchy and density from the scan.
- Preserve measured motion; do not add extra.

### Don't
- Inter / system-ui as a stand-in if a display face was measured.
- Purple SaaS gradients, colored identity dots, glass on every card.
- Clone the source logo, name, or illustration.
`;
  }
  const tokens = tokensFor(capture);
  const colors = tokens.colors
    .map((c) => `| ${c.value} | ${c.roles.join(", ")} | ${c.count} |`)
    .join("\n");
  const fonts = tokens.fonts
    .map((f) => `- **${f.family}**: ${f.weights.join(", ")} · ${f.sizes.join(", ")}`)
    .join("\n");
  const vars = tokens.cssVariables
    .map((v) => `- \`${v.name}\`: ${v.value}`)
    .join("\n");

  return `# DESIGN.md

Visual language measured from [${sourceName(capture.url)}](${capture.url}).
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
${tokens.spacing.map((s) => `- ${s}`).join("\n") || "- 0"}

## Radius
${tokens.radii.map((s) => `- ${s}`).join("\n") || "- 0"}

## Shadow
${tokens.shadows.map((s) => `- ${s}`).join("\n") || "- none"}

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

export function toSkillMd(
  capture: CaptureResult,
  scan?: PageScan | null,
): string {
  const job = resolveJob(capture);
  return `---
name: captured-design
description: Apply the measured design language from ${sourceName(capture.url)}. Job: ${job}.
---

# Captured design skill

${jobSentence(job)}

${KEEP_REPLACE}

${DONE_WHEN}

${RULE}

${toDesignMd(capture, scan)}

## Agent rules
1. Intent wins if it conflicts with the capture.
2. Measured styles beat guesses. If a state is missing, do not invent it.
3. Translate into this repo's components. Do not paste the source DOM.
4. Stop after one pattern unless the job is System.
`;
}

export function toCss(capture: CaptureResult): string {
  const tokens = tokensFor(capture);
  const root = tokens.cssVariables
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
  if (prop === "color" || prop === "background-color") {
    const hex = cssColorToHex(value);
    if (!hex) return null;
    return prop === "color" ? `text-[${hex}]` : `bg-[${hex}]`;
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

export function renderOutput(
  kind: OutputKind,
  capture: CaptureResult,
  scan?: PageScan | null,
): string {
  switch (kind) {
    case "prompt":
      return toPrompt(capture, scan);
    case "design-md":
      return toDesignMd(capture, scan);
    case "skill-md":
      return toSkillMd(capture, scan);
    case "css":
      return toCss(capture);
    case "tailwind":
      return toTailwind(capture);
    case "photocopy":
    default:
      return toPhotocopy(capture);
  }
}

export function outputLabel(kind: OutputKind): string {
  switch (kind) {
    case "prompt":
      return "Prompt";
    case "design-md":
      return "DESIGN.md";
    case "skill-md":
      return "SKILL.md";
    case "css":
      return "CSS";
    case "tailwind":
      return "Tailwind";
    default:
      return "Component spec";
  }
}
