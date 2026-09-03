import type { PageScan } from "./types";

function detectedLine(scan: PageScan): string {
  if (!scan.detected.length) return "Detected: (none from scripts, DOM, or CSS)";
  return `Detected: ${scan.detected.map((item) => item.name).join(", ")}`;
}

function motionLine(scan: PageScan): string {
  const motion = scan.detected.filter(
    (item) => item.kind === "motion" || item.kind === "3d",
  );
  if (!motion.length) return "";
  return `Motion / 3D: ${motion.map((item) => item.name).join(", ")}`;
}

export function toScanMd(scan: PageScan): string {
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
Measured from the live page. Detected — not inferred from Figma or marketing.`,
    `## Source
${scan.title}
${scan.url}
Viewport ${scan.viewport.width}×${scan.viewport.height}`,
    `## Palette
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
${detectedLine(scan)}
${motionLine(scan)}`.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function scanToTokenBlock(scan: PageScan): string {
  const colors = scan.colors
    .map((c) => `- ${c.value} · ${c.role}`)
    .join("\n");
  const fonts = scan.fonts
    .map(
      (f) =>
        `- ${f.family} · weights ${f.weights.join("/") || "—"} · ${f.sizes.join(", ") || "—"}`,
    )
    .join("\n");
  return `Palette:
${colors || "- none"}

Type:
${fonts || "- none"}

Spacing: ${scan.spacing.join(" | ") || "none"}
Radii: ${scan.radii.join(" | ") || "none"}
Shadows: ${scan.shadows.slice(0, 3).join(" | ") || "none"}

${detectedLine(scan)}`;
}
