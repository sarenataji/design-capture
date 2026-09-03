import { cssColorToHex, contrastRatio } from "./color";
import { isEmptyValue } from "./css";
import type { ContrastPair, TokenCapture } from "./types";

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK", "HEAD"]);

function walkVisible(limit = 500): Element[] {
  const out: Element[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node && out.length < limit) {
    const el = node as Element;
    if (!SKIP.has(el.tagName)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 2 && rect.height > 2) out.push(el);
    }
    node = walker.nextNode();
  }
  return out;
}

function roleForColor(prop: string): string {
  if (prop.includes("background")) return "bg";
  if (prop === "color") return "text";
  if (prop.includes("border")) return "border";
  if (prop.includes("shadow")) return "shadow";
  return "other";
}

export function captureTokens(scope?: Element): TokenCapture {
  const colors = new Map<
    string,
    { value: string; count: number; roles: string[] }
  >();
  const fonts = new Map<
    string,
    { family: string; weights: Set<string>; sizes: Set<string> }
  >();
  const spacing = new Set<string>();
  const radii = new Set<string>();
  const shadows = new Set<string>();

  const elements = scope
    ? [scope, ...Array.from(scope.querySelectorAll("*"))].filter(
        (el) => el instanceof Element,
      )
    : walkVisible();

  for (const el of elements) {
    const style = getComputedStyle(el);
    for (const prop of ["color", "background-color", "border-color"] as const) {
      const hex = cssColorToHex(style.getPropertyValue(prop));
      if (!hex) continue;
      const current = colors.get(hex);
      const role = roleForColor(prop);
      if (current) {
        current.count += 1;
        if (!current.roles.includes(role)) current.roles.push(role);
      } else {
        colors.set(hex, { value: hex, count: 1, roles: [role] });
      }
    }

    const family = style.fontFamily.split(",")[0]?.replace(/['"]/g, "").trim();
    if (family) {
      const entry = fonts.get(family) ?? {
        family,
        weights: new Set<string>(),
        sizes: new Set<string>(),
      };
      entry.weights.add(style.fontWeight);
      entry.sizes.add(style.fontSize);
      fonts.set(family, entry);
    }

    for (const prop of ["margin", "padding", "gap"] as const) {
      const value = style.getPropertyValue(prop).trim();
      if (value && !isEmptyValue(value) && value !== "0px") spacing.add(value);
    }
    const radius = style.borderRadius.trim();
    if (radius && radius !== "0px") radii.add(radius);
    const shadow = style.boxShadow.trim();
    if (shadow && shadow !== "none") shadows.add(shadow);
  }

  const cssVariables: { name: string; value: string }[] = [];
  if (!scope) {
    const root = getComputedStyle(document.documentElement);
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (!(rule instanceof CSSStyleRule)) continue;
          if (!rule.selectorText.includes(":root") && rule.selectorText !== "html") {
            continue;
          }
          for (const name of Array.from(rule.style)) {
            if (!name.startsWith("--")) continue;
            cssVariables.push({
              name,
              value:
                root.getPropertyValue(name).trim() ||
                rule.style.getPropertyValue(name),
            });
          }
        }
      } catch {
        /* cross-origin sheet */
      }
    }
  }

  return {
    colors: [...colors.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 24),
    fonts: [...fonts.values()].map((font) => ({
      family: font.family,
      weights: [...font.weights],
      sizes: [...font.sizes].slice(0, 8),
    })),
    spacing: [...spacing].slice(0, 20),
    radii: [...radii].slice(0, 12),
    shadows: [...shadows].slice(0, 8),
    cssVariables: uniqueVars(cssVariables).slice(0, 40),
  };
}

function uniqueVars(
  vars: { name: string; value: string }[],
): { name: string; value: string }[] {
  const seen = new Set<string>();
  return vars.filter((item) => {
    if (seen.has(item.name) || !item.value) return false;
    seen.add(item.name);
    return true;
  });
}

export function captureContrast(el: Element): ContrastPair[] {
  const style = getComputedStyle(el);
  const fg = cssColorToHex(style.color);
  const bg = nearestBackground(el);
  if (!fg || !bg) return [];
  const ratio = contrastRatio(fg, bg);
  return [
    {
      fg,
      bg,
      ratio: Number(ratio.toFixed(2)),
      aa: ratio >= 4.5,
      aaa: ratio >= 7,
    },
  ];
}

function nearestBackground(el: Element): string | null {
  let node: Element | null = el;
  while (node) {
    const hex = cssColorToHex(getComputedStyle(node).backgroundColor);
    if (hex) return hex;
    node = node.parentElement;
  }
  return cssColorToHex(getComputedStyle(document.body).backgroundColor);
}
