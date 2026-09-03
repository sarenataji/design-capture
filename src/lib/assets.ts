import type { AssetCapture } from "./types";

export function captureAssets(root: Element, limit = 16): AssetCapture[] {
  const out: AssetCapture[] = [];

  if (root instanceof HTMLImageElement && root.currentSrc) {
    out.push({
      kind: "img",
      src: root.currentSrc,
      alt: root.alt,
      width: root.naturalWidth,
      height: root.naturalHeight,
    });
  }

  root.querySelectorAll("img").forEach((img) => {
    if (out.length >= limit) return;
    if (!img.currentSrc) return;
    out.push({
      kind: "img",
      src: img.currentSrc,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  });

  const svgs = [root, ...Array.from(root.querySelectorAll("svg"))].filter(
    (node): node is SVGElement => node instanceof SVGElement,
  );
  for (const svg of svgs) {
    if (out.length >= limit) break;
    const markup = svg.outerHTML;
    if (markup.length > 8000) continue;
    out.push({
      kind: "svg",
      markup,
      width: Math.round(svg.getBoundingClientRect().width),
      height: Math.round(svg.getBoundingClientRect().height),
    });
  }

  root.querySelectorAll("video").forEach((video) => {
    if (out.length >= limit) return;
    out.push({
      kind: "video",
      src: video.currentSrc || video.poster,
      width: video.videoWidth,
      height: video.videoHeight,
    });
  });

  return out;
}

export function sanitizeHtml(el: Element, max = 4000): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("script,style,iframe,noscript").forEach((n) => n.remove());
  const html = clone.outerHTML
    .replace(/\s+/g, " ")
    .replace(/<!--.*?-->/g, "")
    .trim();
  return html.length > max ? `${html.slice(0, max)}\n<!-- truncated -->` : html;
}
