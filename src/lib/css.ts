export const STYLE_PROPS = [
  "display",
  "position",
  "inset",
  "top",
  "right",
  "bottom",
  "left",
  "box-sizing",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "margin",
  "padding",
  "gap",
  "row-gap",
  "column-gap",
  "flex",
  "flex-direction",
  "flex-wrap",
  "align-items",
  "justify-content",
  "align-self",
  "grid-template-columns",
  "grid-template-rows",
  "grid-auto-flow",
  "place-items",
  "overflow",
  "overflow-x",
  "overflow-y",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-align",
  "text-decoration",
  "white-space",
  "color",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "outline",
  "box-shadow",
  "text-shadow",
  "opacity",
  "filter",
  "backdrop-filter",
  "transform",
  "transform-origin",
  "transition",
  "animation",
  "z-index",
  "cursor",
  "object-fit",
  "aspect-ratio",
] as const;

const TRANSPARENT = new Set([
  "rgba(0, 0, 0, 0)",
  "rgba(0,0,0,0)",
  "transparent",
  "none",
]);

export function isEmptyValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || TRANSPARENT.has(v) || v === "normal" || v === "auto";
}

export function readStyles(el: Element): Record<string, string> {
  const computed = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const prop of STYLE_PROPS) {
    const value = computed.getPropertyValue(prop).trim();
    if (!value || isEmptyValue(value)) continue;
    out[prop] = value;
  }
  return out;
}

export function diffStyles(
  current: Record<string, string>,
  baseline: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (baseline[key] !== value) out[key] = value;
  }
  return Object.keys(out).length ? out : current;
}

export function baselineForTag(tag: string): Record<string, string> {
  const probe = document.createElement(tag);
  probe.style.all = "revert";
  probe.setAttribute("aria-hidden", "true");
  document.documentElement.appendChild(probe);
  const styles = readStyles(probe);
  probe.remove();
  return styles;
}

export function cssColorToHex(value: string): string | null {
  const rgb = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
  );
  if (!rgb) {
    if (value.startsWith("#")) return value.toLowerCase();
    return null;
  }
  const r = Math.round(Number(rgb[1]));
  const g = Math.round(Number(rgb[2]));
  const b = Math.round(Number(rgb[3]));
  const a = rgb[4] === undefined ? 1 : Number(rgb[4]);
  if (a === 0) return null;
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  if (a < 1) return `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
  return hex;
}

export function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "").slice(0, 6);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = toLin(parseInt(raw.slice(0, 2), 16));
  const g = toLin(parseInt(raw.slice(2, 4), 16));
  const b = toLin(parseInt(raw.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}
