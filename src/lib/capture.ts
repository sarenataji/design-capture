import { captureAssets, sanitizeHtml } from "./assets";
import { baselineForTag, diffStyles, readStyles } from "./css";
import { cssSelector, visibleText } from "./selector";
import { captureMotion, captureStates } from "./states";
import { captureContrast, captureTokens } from "./tokens";
import type { CaptureResult, Direction, NodeCapture, Target } from "./types";

const CHILD_LIMIT = 8;
const DEPTH_LIMIT = 3;

function captureNode(el: Element, depth: number): NodeCapture {
  const rect = el.getBoundingClientRect();
  const states = captureStates(el);
  const styles = diffStyles(readStyles(el), baselineForTag(el.tagName.toLowerCase()));
  const children: NodeCapture[] = [];
  if (depth < DEPTH_LIMIT) {
    const kids = Array.from(el.children).slice(0, CHILD_LIMIT);
    for (const child of kids) {
      const box = child.getBoundingClientRect();
      if (box.width < 2 && box.height < 2) continue;
      children.push(captureNode(child, depth + 1));
    }
  }

  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    className: typeof el.className === "string" ? el.className : "",
    role: el.getAttribute("role"),
    text: visibleText(el, depth === 0 ? 220 : 80),
    selector: cssSelector(el),
    box: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    styles,
    hover: states.hover,
    focus: states.focus,
    active: states.active,
    children,
  };
}

export function captureElement(
  el: Element,
  options: { intent?: string; target?: Target; direction?: Direction } = {},
): CaptureResult {
  const node = captureNode(el, 0);
  return {
    url: location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    selector: node.selector,
    node,
    html: sanitizeHtml(el),
    motion: captureMotion(el),
    tokens: captureTokens(),
    assets: captureAssets(el),
    contrast: captureContrast(el),
    intent: options.intent ?? "",
    target: options.target ?? "auto",
    direction: options.direction ?? "rebuild",
  };
}

export function hoverPreview(el: Element) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    selector: cssSelector(el),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    font: `${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily.split(",")[0]?.replace(/['"]/g, "")}`,
    color: style.color,
    background: style.backgroundColor,
    radius: style.borderRadius,
  };
}
