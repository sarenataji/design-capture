import { colorDistance, cssColorToHex, hexChroma } from "./color";
import { isEmptyValue } from "./css";
import { detectStack } from "./detect";
import type { ColorRole, PageScan, ScanColor, ScanTypeface } from "./types";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "META",
  "LINK",
  "HEAD",
  "BR",
  "HR",
]);

const GENERIC_FONTS = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "-apple-system",
  "blinkmacsystemfont",
  "inherit",
  "initial",
  "unset",
]);


type ColorHit = {
  value: string;
  count: number;
  area: number;
  roles: Set<ColorRole>;
};

function mergeColors(hits: ColorHit[]): ColorHit[] {
  const sorted = [...hits].sort((a, b) => b.count - a.count);
  const out: ColorHit[] = [];
  for (const hit of sorted) {
    const near = out.find((item) => colorDistance(item.value, hit.value) < 0.08);
    if (near) {
      near.count += hit.count;
      near.area += hit.area;
      for (const role of hit.roles) near.roles.add(role);
    } else {
      out.push({
        value: hit.value,
        count: hit.count,
        area: hit.area,
        roles: new Set(hit.roles),
      });
    }
  }
  return out;
}

function pickPalette(hits: ColorHit[]): ScanColor[] {
  const merged = mergeColors(hits);
  const byArea = [...merged].sort((a, b) => b.area - a.area);
  const byCount = [...merged].sort((a, b) => b.count - a.count);
  const used = new Set<string>();
  const out: ScanColor[] = [];

  const take = (hit: ColorHit | undefined, role: ColorRole) => {
    if (!hit || used.has(hit.value) || out.length >= 8) return;
    used.add(hit.value);
    out.push({ value: hit.value, role, count: hit.count });
  };

  for (const hit of byArea.filter((h) => h.roles.has("bg")).slice(0, 3)) {
    take(hit, "bg");
  }
  for (const hit of byCount.filter((h) => h.roles.has("text")).slice(0, 2)) {
    take(hit, "text");
  }
  const accents = byCount
    .filter((h) => hexChroma(h.value) > 0.18 && !used.has(h.value))
    .slice(0, 2);
  for (const hit of accents) take(hit, "accent");
  for (const hit of byCount.filter((h) => h.roles.has("border")).slice(0, 2)) {
    take(hit, "border");
  }
  return out;
}

function parsePxTokens(value: string): string[] {
  const tokens: string[] = [];
  const re = /(-?\d+(?:\.\d+)?)px/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    const n = Number(match[1]);
    if (!Number.isFinite(n) || n === 0) continue;
    tokens.push(`${Math.round(n * 2) / 2}px`);
  }
  return tokens;
}

function ladder(counts: Map<string, number>, min = 3, max = 10): string[] {
  let items = [...counts.entries()].filter(([, n]) => n >= min);
  if (items.length < 4) {
    items = [...counts.entries()].filter(([, n]) => n >= 2);
  }
  items.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
  return items.slice(0, max).map(([v]) => v);
}

function collectCssVariables(): { name: string; value: string }[] {
  const root = getComputedStyle(document.documentElement);
  const found: { name: string; value: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        if (!rule.selectorText.includes(":root") && rule.selectorText !== "html") {
          continue;
        }
        for (const name of Array.from(rule.style)) {
          if (!name.startsWith("--")) continue;
          const value =
            root.getPropertyValue(name).trim() ||
            rule.style.getPropertyValue(name).trim();
          if (value) found.push({ name, value: value.slice(0, 80) });
        }
      }
    } catch {
      /* cross-origin */
    }
  }
  const seen = new Set<string>();
  return found
    .filter((item) => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    })
    .slice(0, 8);
}

function isOurRoot(el: Element): boolean {
  return (
    el.id === "design-capture-root" ||
    el.closest?.("[data-design-capture]") !== null
  );
}

function walkVisible(limit = 800): Element[] {
  const out: Element[] = [];
  if (!document.body) return out;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node && out.length < limit) {
    const el = node as Element;
    if (!SKIP_TAGS.has(el.tagName) && !isOurRoot(el)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 2 && rect.height > 2) out.push(el);
    }
    node = walker.nextNode();
  }
  return out;
}

export function scanPage(
  globals: { name: string; kind: string }[] = [],
): PageScan {
  const elements = walkVisible();
  const colors = new Map<string, ColorHit>();
  const fonts = new Map<
    string,
    { family: string; weights: Set<string>; sizes: Map<string, number> }
  >();
  const spacing = new Map<string, number>();
  const radii = new Map<string, number>();
  const shadows = new Map<string, number>();

  for (const el of elements) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const area = Math.max(1, rect.width * rect.height);
    const hasText = (el.textContent ?? "").trim().length > 0;

    const bg = cssColorToHex(style.backgroundColor);
    if (bg) {
      const hit = colors.get(bg) ?? {
        value: bg,
        count: 0,
        area: 0,
        roles: new Set<ColorRole>(),
      };
      hit.count += 1;
      hit.area += area;
      hit.roles.add("bg");
      colors.set(bg, hit);
    }

    if (hasText) {
      const fg = cssColorToHex(style.color);
      if (fg) {
        const hit = colors.get(fg) ?? {
          value: fg,
          count: 0,
          area: 0,
          roles: new Set<ColorRole>(),
        };
        hit.count += 1;
        hit.roles.add("text");
        colors.set(fg, hit);
      }
    }

    const bw = style.borderWidth;
    if (bw && bw !== "0px" && !isEmptyValue(bw)) {
      const border = cssColorToHex(style.borderColor);
      if (border) {
        const hit = colors.get(border) ?? {
          value: border,
          count: 0,
          area: 0,
          roles: new Set<ColorRole>(),
        };
        hit.count += 1;
        hit.roles.add("border");
        colors.set(border, hit);
      }
    }

    const family = style.fontFamily
      .split(",")[0]
      ?.replace(/['"]/g, "")
      .trim();
    if (family && !GENERIC_FONTS.has(family.toLowerCase())) {
      const entry = fonts.get(family) ?? {
        family,
        weights: new Set<string>(),
        sizes: new Map<string, number>(),
      };
      entry.weights.add(style.fontWeight);
      const size = style.fontSize;
      entry.sizes.set(size, (entry.sizes.get(size) ?? 0) + 1);
      fonts.set(family, entry);
    }

    for (const prop of ["margin", "padding", "gap"] as const) {
      const value = style.getPropertyValue(prop).trim();
      if (!value || isEmptyValue(value)) continue;
      for (const token of parsePxTokens(value)) {
        spacing.set(token, (spacing.get(token) ?? 0) + 1);
      }
    }
    for (const token of parsePxTokens(style.borderRadius)) {
      radii.set(token, (radii.get(token) ?? 0) + 1);
    }
    const shadow = style.boxShadow.trim();
    if (shadow && shadow !== "none") {
      shadows.set(shadow, (shadows.get(shadow) ?? 0) + 1);
    }
  }

  const typefaces: ScanTypeface[] = [...fonts.values()]
    .sort((a, b) => b.sizes.size - a.sizes.size)
    .slice(0, 4)
    .map((font) => ({
      family: font.family,
      weights: [...font.weights].sort((a, b) => Number(a) - Number(b)),
      sizes: [...font.sizes.entries()]
        .filter(([, n]) => n >= 2)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .map(([size]) => size)
        .slice(0, 8),
    }));

  const shadowLadder = [...shadows.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([v]) => v);

  return {
    url: location.href,
    title: document.title,
    scannedAt: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    colors: pickPalette([...colors.values()]),
    fonts: typefaces,
    spacing: ladder(spacing),
    radii: ladder(radii, 2, 8),
    shadows: shadowLadder,
    cssVariables: collectCssVariables(),
    detected: detectStack(globals),
  };
}
