import type { Box, ScanColor } from "./types";

type ScreenshotReply = { dataUrl?: string } | null;

function byteHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

function distance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Samples the pixels actually visible in the tab, including canvas/WebGL/video. */
export async function captureVisibleColors(box?: Box, limit = 8, onPreview?: (dataUrl: string) => void): Promise<ScanColor[]> {
  const reply = (await browser.runtime
    .sendMessage({ type: "capture-visible-tab" })
    .catch(() => null)) as ScreenshotReply;
  if (!reply?.dataUrl) return [];

  const image = new Image();
  image.src = reply.dataUrl;
  await image.decode().catch(() => {});
  if (!image.naturalWidth || !image.naturalHeight) return [];

  const scaleX = image.naturalWidth / Math.max(1, window.innerWidth);
  const scaleY = image.naturalHeight / Math.max(1, window.innerHeight);
  const source = box ?? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  const left = Math.max(0, Math.min(window.innerWidth, source.x));
  const top = Math.max(0, Math.min(window.innerHeight, source.y));
  const right = Math.max(left, Math.min(window.innerWidth, source.x + source.width));
  const bottom = Math.max(top, Math.min(window.innerHeight, source.y + source.height));
  const sx = Math.floor(left * scaleX);
  const sy = Math.floor(top * scaleY);
  const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.ceil((right - left) * scaleX)));
  const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.ceil((bottom - top) * scaleY)));
  if (onPreview && right > left && bottom > top) {
    const preview = document.createElement("canvas");
    const previewRatio = Math.min(1, 480 / Math.max(sw, sh));
    preview.width = Math.max(1, Math.round(sw * previewRatio));
    preview.height = Math.max(1, Math.round(sh * previewRatio));
    const previewContext = preview.getContext("2d");
    if (previewContext) {
      previewContext.drawImage(image, sx, sy, sw, sh, 0, 0, preview.width, preview.height);
      onPreview(preview.toDataURL("image/webp", 0.8));
    }
  }
  const ratio = Math.min(1, 128 / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * ratio));
  const height = Math.max(1, Math.round(sh * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 200) continue;
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const key = `${r >> 4}:${g >> 4}:${b >> 4}`;
    const entry = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    entry.r += r;
    entry.g += g;
    entry.b += b;
    entry.count += 1;
    buckets.set(key, entry);
  }

  const candidates = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      r: entry.r / entry.count,
      g: entry.g / entry.count,
      b: entry.b / entry.count,
      count: entry.count,
    }));
  const picked: typeof candidates = [];
  const addDistinct = (candidate: (typeof candidates)[number]) => {
    if (picked.some((color) => distance(color, candidate) < 34)) return;
    picked.push(candidate);
  };
  for (const candidate of candidates) {
    addDistinct(candidate);
    if (picked.length >= Math.max(4, limit - 3)) break;
  }
  const accents = candidates.slice(0, 160).sort((a, b) => {
    const chromaA = Math.max(a.r, a.g, a.b) - Math.min(a.r, a.g, a.b);
    const chromaB = Math.max(b.r, b.g, b.b) - Math.min(b.r, b.g, b.b);
    return chromaB * Math.sqrt(b.count) - chromaA * Math.sqrt(a.count);
  });
  for (const candidate of accents) {
    addDistinct(candidate);
    if (picked.length >= limit) break;
  }
  return picked.map((color) => ({
    value: `#${byteHex(color.r)}${byteHex(color.g)}${byteHex(color.b)}`,
    role: "visual",
    count: color.count,
  }));
}
