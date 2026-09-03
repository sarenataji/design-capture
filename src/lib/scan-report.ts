import { KIND_LABEL, KIND_ORDER } from "./detect";
import type { DetectedKind, PageScan } from "./types";

function sourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

export function stackByKind(scan: PageScan): { kind: DetectedKind; label: string; names: string[] }[] {
  const groups = new Map<DetectedKind, string[]>();
  for (const item of scan.detected) {
    const list = groups.get(item.kind) ?? [];
    if (!list.includes(item.name)) list.push(item.name);
    groups.set(item.kind, list);
  }
  return KIND_ORDER.filter((kind) => groups.has(kind)).map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    names: groups.get(kind) ?? [],
  }));
}

function stackMarkdown(scan: PageScan): string {
  const groups = stackByKind(scan);
  if (!groups.length) {
    return "Detected: (none from scripts, DOM, CSS, or page globals)";
  }
  return groups
    .map((group) => `- **${group.label}:** ${group.names.join(", ")}`)
    .join("\n");
}

export function toScanMd(scan: PageScan): string {
  const visualColors = (scan.visualColors ?? [])
    .map((c) => `- visual ${c.value}`)
    .join("\n");
  const colors = scan.colors
    .map((c) => `- ${c.role} ${c.value}`)
    .join("\n");
  const type = scan.fonts
    .map((f) => {
      const sizes = f.sizes.length ? f.sizes.join(" / ") : "sizes mixed";
      const weights = f.weights.length ? f.weights.join("/") : "";
      return `- ${f.family}${weights ? ` ${weights}` : ""} · ${sizes}`;
    })
    .join("\n");
  const vars = scan.cssVariables
    .map((v) => `- \`${v.name}\`: ${v.value}`)
    .join("\n");

  return [
    `# Site scan
Measured from the live page. Stack is **detected** (scripts, DOM, CSS, loaded URLs, page globals) — not inferred from Figma.`,
    `## Source
${sourceName(scan.url)}
${scan.url}
Viewport ${scan.viewport.width}×${scan.viewport.height}`,
    `## Visible palette (sampled pixels)
${visualColors || "- unavailable"}`,
    `## CSS palette
${colors || "- none"}`,
    `## Type
${type || "- none"}`,
    `## Space
${scan.spacing.map((s) => `- ${s}`).join("\n") || "- none"}`,
    `## Radius
${scan.radii.map((s) => `- ${s}`).join("\n") || "- none"}`,
    scan.shadows.length
      ? `## Shadow\n${scan.shadows.map((s) => `- ${s}`).join("\n")}`
      : "",
    vars ? `## :root\n${vars}` : "",
    `## Stack
${stackMarkdown(scan)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function scanToTokenBlock(scan: PageScan): string {
  const visualColors = (scan.visualColors ?? [])
    .map((c) => `- ${c.value} · visible pixel`)
    .join("\n");
  const colors = scan.colors
    .map((c) => `- ${c.value} · ${c.role}`)
    .join("\n");
  const fonts = scan.fonts
    .map(
      (f) =>
        `- ${f.family} · weights ${f.weights.join("/") || "—"} · ${f.sizes.join(", ") || "—"}`,
    )
    .join("\n");
  return `Visible palette:
${visualColors || "- unavailable"}

CSS palette:
${colors || "- none"}

Type:
${fonts || "- none"}

Spacing: ${scan.spacing.join(" | ") || "none"}
Radii: ${scan.radii.join(" | ") || "none"}
Shadows: ${scan.shadows.slice(0, 3).join(" | ") || "none"}

Stack:
${stackMarkdown(scan)}`;
}
