import { parseCssColor } from "./color";

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

export function isEmptyValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v === "none" || v === "normal" || v === "auto" || v === "transparent") {
    return true;
  }
  const color = parseCssColor(v);
  return Boolean(color && color.a === 0);
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

/** Properties in `current` that differ from `baseline`. Empty is a valid result. */
export function changedStyles(
  current: Record<string, string>,
  baseline: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (baseline[key] !== value) out[key] = value;
  }
  return out;
}

/** Like changedStyles, but if nothing differs keep `current` (used vs UA defaults). */
export function diffStyles(
  current: Record<string, string>,
  baseline: Record<string, string>,
): Record<string, string> {
  const out = changedStyles(current, baseline);
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

export { contrastRatio, cssColorToHex, relativeLuminance } from "./color";
