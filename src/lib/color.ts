/** Parse computed CSS colors (hex, rgb, hsl, oklch, oklab) into sRGB hex. */

type Rgba = { r: number; g: number; b: number; a: number };

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function toHexByte(n: number): string {
  return Math.round(clamp01(n) * 255)
    .toString(16)
    .padStart(2, "0");
}

function rgbaToHex({ r, g, b, a }: Rgba): string | null {
  if (a <= 0) return null;
  const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  if (a < 1) return `${hex}${toHexByte(a)}`;
  return hex;
}

function srgbFromLinear(c: number): number {
  const abs = Math.abs(c);
  return abs <= 0.0031308
    ? c * 12.92
    : (c < 0 ? -1 : 1) * (1.055 * abs ** (1 / 2.4) - 0.055);
}

function oklabToRgba(L: number, a: number, b: number, alpha: number): Rgba {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return {
    r: srgbFromLinear(rLin),
    g: srgbFromLinear(gLin),
    b: srgbFromLinear(bLin),
    a: alpha,
  };
}

function parseNumber(raw: string, percentOf = 1): number | null {
  const t = raw.trim();
  if (!t || t === "none") return null;
  if (t.endsWith("%")) {
    const n = Number(t.slice(0, -1));
    return Number.isFinite(n) ? (n / 100) * percentOf : null;
  }
  const n = Number(t.replace(/deg|rad|turn|grad$/i, ""));
  if (!Number.isFinite(n)) return null;
  if (/turn$/i.test(t)) return n * 360;
  if (/rad$/i.test(t)) return (n * 180) / Math.PI;
  if (/grad$/i.test(t)) return n * 0.9;
  return n;
}

function splitArgs(inner: string): { channels: string[]; alpha: number } {
  const slash = inner.split("/");
  const alphaRaw = slash[1]?.trim();
  const alpha = alphaRaw ? (parseNumber(alphaRaw) ?? 1) : 1;
  const head = slash[0]?.trim() ?? "";
  const channels = head.includes(",")
    ? head.split(",").map((p) => p.trim())
    : head.split(/\s+/).filter(Boolean);
  return { channels, alpha: Number.isFinite(alpha) ? alpha : 1 };
}

function parseRgb(inner: string): Rgba | null {
  const { channels, alpha } = splitArgs(inner);
  if (channels.length < 3) return null;
  const toByte = (raw: string) => {
    const t = raw.trim();
    if (t.endsWith("%")) {
      const n = parseNumber(t);
      return n === null ? null : n * 255;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const r = toByte(channels[0]!);
  const g = toByte(channels[1]!);
  const b = toByte(channels[2]!);
  if (r === null || g === null || b === null) return null;
  const a = channels[3] !== undefined ? (parseNumber(channels[3]!) ?? alpha) : alpha;
  return { r: r / 255, g: g / 255, b: b / 255, a };
}

function parseHsl(inner: string): Rgba | null {
  const { channels, alpha } = splitArgs(inner);
  if (channels.length < 3) return null;
  const h = parseNumber(channels[0]!);
  const s = parseNumber(channels[1]!, 1);
  const l = parseNumber(channels[2]!, 1);
  if (h === null || s === null || l === null) return null;
  const a = channels[3] !== undefined ? (parseNumber(channels[3]!) ?? alpha) : alpha;
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hue < 60) [rp, gp, bp] = [c, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, c, 0];
  else if (hue < 180) [rp, gp, bp] = [0, c, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, c];
  else if (hue < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return { r: rp + m, g: gp + m, b: bp + m, a };
}

function parseOklch(inner: string): Rgba | null {
  const { channels, alpha } = splitArgs(inner);
  if (channels.length < 3) return null;
  const L = parseNumber(channels[0]!, 1);
  const C = parseNumber(channels[1]!);
  const h = parseNumber(channels[2]!);
  if (L === null || C === null || h === null) return null;
  const hr = (h * Math.PI) / 180;
  return oklabToRgba(L, C * Math.cos(hr), C * Math.sin(hr), alpha);
}

function parseOklab(inner: string): Rgba | null {
  const { channels, alpha } = splitArgs(inner);
  if (channels.length < 3) return null;
  const L = parseNumber(channels[0]!, 1);
  const a = parseNumber(channels[1]!);
  const b = parseNumber(channels[2]!);
  if (L === null || a === null || b === null) return null;
  return oklabToRgba(L, a, b, alpha);
}

function parseHex(value: string): Rgba | null {
  const h = value.slice(1);
  if (h.length === 3 || h.length === 4) {
    const r = parseInt(h[0]! + h[0]!, 16);
    const g = parseInt(h[1]! + h[1]!, 16);
    const b = parseInt(h[2]! + h[2]!, 16);
    const a = h.length === 4 ? parseInt(h[3]! + h[3]!, 16) / 255 : 1;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r: r / 255, g: g / 255, b: b / 255, a };
  }
  if (h.length === 6 || h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r: r / 255, g: g / 255, b: b / 255, a };
  }
  return null;
}

export function parseCssColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "transparent" || v === "none") return null;
  if (v.startsWith("#")) return parseHex(v);

  const fn = v.match(/^([a-z0-9-]+)\((.+)\)$/s);
  if (!fn) return null;
  const name = fn[1]!;
  const inner = fn[2]!;
  if (name === "rgb" || name === "rgba") return parseRgb(inner);
  if (name === "hsl" || name === "hsla") return parseHsl(inner);
  if (name === "oklch") return parseOklch(inner);
  if (name === "oklab") return parseOklab(inner);
  if (name === "color") {
    const parts = inner.trim().split(/\s+/);
    const space = parts[0];
    if (space === "srgb" && parts.length >= 4) {
      const r = Number(parts[1]);
      const g = Number(parts[2]);
      const b = Number(parts[3]);
      const a = parts[5] !== undefined ? Number(parts[5]) : 1;
      if (![r, g, b].every(Number.isFinite)) return null;
      return { r, g, b, a: Number.isFinite(a) ? a : 1 };
    }
  }
  return null;
}

export function cssColorToHex(value: string): string | null {
  const parsed = parseCssColor(value);
  if (!parsed) {
    if (value.trim().startsWith("#")) return value.trim().toLowerCase();
    return null;
  }
  return rgbaToHex(parsed);
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

/** 0 = gray, 1 = fully saturated channel spread. Used to pick accents. */
export function hexChroma(hex: string): number {
  const p = parseCssColor(hex);
  if (!p) return 0;
  return Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
}

export function colorDistance(a: string, b: string): number {
  const pa = parseCssColor(a);
  const pb = parseCssColor(b);
  if (!pa || !pb) return 1;
  const dr = pa.r - pb.r;
  const dg = pa.g - pb.g;
  const db = pa.b - pb.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
