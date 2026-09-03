import { colorDistance, cssColorToHex, hexChroma } from "./color";
import { isEmptyValue } from "./css";
import type {
  ColorRole,
  DetectedKind,
  DetectedLib,
  PageScan,
  ScanColor,
  ScanTypeface,
} from "./types";

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

type Fingerprint = {
  name: string;
  kind: DetectedKind;
  scripts?: RegExp;
  html?: (ctx: ScanCtx) => boolean;
};

type ScanCtx = {
  srcs: string;
  html: string;
  classes: string;
};

const FINGERPRINTS: Fingerprint[] = [
  {
    name: "Next.js",
    kind: "framework",
    scripts: /\/_next\//,
    html: () =>
      Boolean(
        document.getElementById("__NEXT_DATA__") ||
          document.getElementById("__next"),
      ),
  },
  {
    name: "Nuxt",
    kind: "framework",
    scripts: /\/_nuxt\//,
    html: () =>
      Boolean(
        document.getElementById("__NUXT_DATA__") ||
          document.getElementById("__nuxt"),
      ),
  },
  {
    name: "Gatsby",
    kind: "framework",
    scripts: /gatsby/i,
    html: () => Boolean(document.getElementById("___gatsby")),
  },
  {
    name: "Remix",
    kind: "framework",
    scripts: /remix/i,
    html: () => Boolean(document.querySelector("[data-remix-run]")),
  },
  {
    name: "Astro",
    kind: "framework",
    scripts: /astro/i,
    html: () => Boolean(document.querySelector("astro-island, [data-astro-cid]")),
  },
  {
    name: "SvelteKit",
    kind: "framework",
    scripts: /sveltekit|_app\/immutable/i,
  },
  {
    name: "React",
    kind: "framework",
    scripts: /react(-dom)?[./-]/i,
    html: () =>
      Boolean(
        document.querySelector("[data-reactroot], [data-reactid]") ||
          hasReactFiber(),
      ),
  },
  {
    name: "Vue",
    kind: "framework",
    scripts: /vue([.@/]|runtime)/i,
    html: () => hasPrefixedAttr("data-v-"),
  },
  {
    name: "Angular",
    kind: "framework",
    scripts: /angular/i,
    html: () => Boolean(document.querySelector("[ng-version]")),
  },
  {
    name: "Svelte",
    kind: "framework",
    scripts: /svelte/i,
    html: (ctx) => /\bsvelte-/.test(ctx.classes),
  },
  {
    name: "Solid",
    kind: "framework",
    scripts: /solid-js|solidjs/i,
  },
  {
    name: "Qwik",
    kind: "framework",
    scripts: /qwik/i,
    html: () =>
      Boolean(document.querySelector("script[type='qwik/json']")) ||
      hasPrefixedAttr("q:"),
  },
  {
    name: "HTMX",
    kind: "framework",
    scripts: /htmx/i,
    html: () => Boolean(document.querySelector("[hx-get], [hx-post], [hx-boost]")),
  },
  {
    name: "Alpine.js",
    kind: "framework",
    scripts: /alpine/i,
    html: () => Boolean(document.querySelector("[x-data]")),
  },
  {
    name: "Tailwind",
    kind: "styling",
    scripts: /tailwindcss|cdn\.tailwindcss/i,
    html: () => hasTailwind(),
  },
  {
    name: "Bootstrap",
    kind: "styling",
    scripts: /bootstrap/i,
    html: (ctx) => /\b(container-fluid|col-md-|navbar-)/.test(ctx.classes),
  },
  {
    name: "GSAP",
    kind: "motion",
    scripts: /gsap|ScrollTrigger|SplitText/i,
  },
  {
    name: "Lenis",
    kind: "motion",
    scripts: /lenis/i,
    html: (ctx) => /\blenis\b/.test(ctx.classes),
  },
  {
    name: "Locomotive",
    kind: "motion",
    scripts: /locomotive/i,
    html: (ctx) => /locomotive|c-scrollbar/.test(ctx.classes),
  },
  {
    name: "Barba",
    kind: "motion",
    scripts: /barba/i,
    html: () => Boolean(document.querySelector("[data-barba]")),
  },
  {
    name: "Anime.js",
    kind: "motion",
    scripts: /anime(\.min)?\.js|animejs/i,
  },
  {
    name: "Motion",
    kind: "motion",
    scripts: /framer-motion|motion-dom|motion\.js/i,
  },
  {
    name: "Lottie",
    kind: "motion",
    scripts: /lottie|dotlottie/i,
    html: () =>
      Boolean(document.querySelector("lottie-player, dotlottie-player")),
  },
  {
    name: "Three.js",
    kind: "3d",
    scripts: /three(\.module|\.min)?\.js|unpkg\.com\/three|cdn.*\/three/i,
  },
  {
    name: "Spline",
    kind: "3d",
    scripts: /splinetool|spline-viewer/i,
    html: () => Boolean(document.querySelector("spline-viewer")),
  },
  {
    name: "Rive",
    kind: "3d",
    scripts: /rive/i,
    html: () => Boolean(document.querySelector("canvas[data-rive], rive-canvas")),
  },
  {
    name: "PixiJS",
    kind: "3d",
    scripts: /pixi(\.min)?\.js|pixi\.js/i,
  },
  {
    name: "Webflow",
    kind: "cms",
    scripts: /webflow/i,
    html: (ctx) => /\bw-nav\b|\bw-button\b|\bwebflow\b/.test(ctx.classes),
  },
  {
    name: "Framer",
    kind: "cms",
    scripts: /framerusercontent|framer\.com\/m/i,
    html: () =>
      Boolean(document.querySelector("[data-framer-name], #__framer")),
  },
  {
    name: "Shopify",
    kind: "cms",
    scripts: /cdn\.shopify|shopify/i,
    html: () => Boolean(document.querySelector("[data-shopify], script#__st")),
  },
  {
    name: "WordPress",
    kind: "cms",
    scripts: /wp-content|wp-includes/i,
  },
  {
    name: "Squarespace",
    kind: "cms",
    scripts: /squarespace/i,
  },
  {
    name: "Wix",
    kind: "cms",
    scripts: /static\.wixstatic|wix\.com/i,
  },
  {
    name: "jQuery",
    kind: "framework",
    scripts: /jquery[.-]/i,
  },
  {
    name: "Emotion",
    kind: "styling",
    html: () => Boolean(document.querySelector("[data-emotion]")),
  },
  {
    name: "styled-components",
    kind: "styling",
    html: () => Boolean(document.querySelector("style[data-styled]")),
  },
];

function hasPrefixedAttr(prefix: string): boolean {
  const sample = Array.from(document.body?.querySelectorAll("*") ?? []).slice(
    0,
    80,
  );
  return sample.some((el) =>
    Array.from(el.attributes).some((attr) => attr.name.startsWith(prefix)),
  );
}

function hasReactFiber(): boolean {
  const el =
    document.querySelector("#__next, #root, #app, [data-reactroot]") ??
    document.body?.firstElementChild;
  if (!el) return false;
  return Object.keys(el).some(
    (key) =>
      key.startsWith("__reactFiber") ||
      key.startsWith("__reactInternalInstance") ||
      key.startsWith("_reactRootContainer"),
  );
}

function hasTailwind(): boolean {
  const root = getComputedStyle(document.documentElement);
  if (
    root.getPropertyValue("--tw-ring-offset-shadow") ||
    root.getPropertyValue("--tw-translate-x") ||
    root.getPropertyValue("--tw-bg-opacity")
  ) {
    return true;
  }
  const sample = Array.from(document.querySelectorAll("[class]")).slice(0, 80);
  let hits = 0;
  const util =
    /\b(flex|grid|hidden|items-center|justify-between|text-(xs|sm|base|lg|xl)|p-\d|px-\d|gap-\d|rounded(-[a-z0-9]+)?)\b/;
  const variant = /^(sm|md|lg|xl|2xl|hover|focus|dark):/;
  for (const el of sample) {
    for (const cls of el.classList) {
      if (variant.test(cls) || util.test(cls)) hits += 1;
    }
  }
  return hits >= 8;
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

function collectSources(): ScanCtx {
  const urls: string[] = [];
  for (const el of Array.from(document.querySelectorAll("script[src], link[href]"))) {
    const url =
      (el instanceof HTMLScriptElement && el.src) ||
      (el instanceof HTMLLinkElement && el.href) ||
      "";
    if (url) urls.push(url);
  }
  const classes: string[] = [];
  for (const el of Array.from(document.querySelectorAll("[class]")).slice(0, 120)) {
    if (typeof el.className === "string") classes.push(el.className);
  }
  return {
    srcs: urls.join(" "),
    html: `${document.documentElement.outerHTML.slice(0, 12000)}`,
    classes: classes.join(" "),
  };
}

function detectStack(): DetectedLib[] {
  const ctx = collectSources();
  const found: DetectedLib[] = [];
  for (const fp of FINGERPRINTS) {
    let via: DetectedLib["via"] | null = null;
    if (fp.scripts && fp.scripts.test(ctx.srcs)) via = "script";
    if (!via && fp.html?.(ctx)) {
      via = fp.scripts && fp.scripts.test(ctx.html) ? "script" : "dom";
    }
    if (!via) continue;
    found.push({ name: fp.name, kind: fp.kind, via });
  }

  const has3dLib = found.some((item) => item.kind === "3d");
  const hasGlHint = /webgl|three|spline|rive|pixi/i.test(
    `${ctx.srcs} ${ctx.classes}`,
  );
  if (
    !has3dLib &&
    hasGlHint &&
    document.querySelector("canvas")
  ) {
    found.push({ name: "WebGL", kind: "3d", via: "dom" });
  }

  return found;
}

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

export function scanPage(): PageScan {
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
    detected: detectStack(),
  };
}
