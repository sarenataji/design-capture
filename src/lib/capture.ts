import { captureAssets, sanitizeHtml } from "./assets";
import { baselineForTag, changedStyles, diffStyles, readStyles } from "./css";
import { cssSelector, visibleText } from "./selector";
import { captureMotion, captureStates } from "./states";
import { detectStack } from "./detect";
import { captureContrast, captureTokens } from "./tokens";
import type {
  CaptureOptions,
  CaptureResult,
  Job,
  NodeCapture,
  StyleMap,
} from "./types";

const CHILD_LIMIT = 8;
const DEPTH_LIMIT = 3;

function hasMap(styles: StyleMap): boolean {
  return Object.keys(styles).length > 0;
}

function mergeStates(cssom: StyleMap, liveDiff: StyleMap): StyleMap {
  return { ...cssom, ...liveDiff };
}

function captureNode(
  el: Element,
  depth: number,
  liveRaw: StyleMap,
): NodeCapture {
  const rect = el.getBoundingClientRect();
  const states = captureStates(el);
  const restRaw = readStyles(el);
  const rest = diffStyles(restRaw, baselineForTag(el.tagName.toLowerCase()));
  const hover = mergeStates(
    states.hover,
    depth === 0 && hasMap(liveRaw) ? changedStyles(liveRaw, restRaw) : {},
  );
  const children: NodeCapture[] = [];
  if (depth < DEPTH_LIMIT) {
    const kids = Array.from(el.children).slice(0, CHILD_LIMIT);
    for (const child of kids) {
      const box = child.getBoundingClientRect();
      if (box.width < 2 && box.height < 2) continue;
      children.push(captureNode(child, depth + 1, {}));
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
    styles: rest,
    hover: hasMap(hover) ? hover : {},
    focus: states.focus,
    active: states.active,
    children,
  };
}

export function captureElement(
  el: Element,
  options: CaptureOptions = {},
): CaptureResult {
  const job: Job = options.job ?? "rebuild";
  const live = options.liveStyles ?? {};
  const node = captureNode(el, 0, live);
  const motion = captureMotion(
    el,
    options.detected ?? detectStack(),
    options.liveMotionStyles,
  );
  return {
    url: location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    selector: node.selector,
    node,
    html: sanitizeHtml(el),
    motion,
    measured: {
      hover: hasMap(node.hover),
      focus: hasMap(node.focus),
      active: hasMap(node.active),
      motion:
        motion.transitions.length > 0 ||
        motion.animations.length > 0 ||
        motion.keyframes.length > 0 ||
        motion.effects.length > 0,
    },
    tokens: captureTokens(el),
    pageTokens: captureTokens(),
    assets: captureAssets(el),
    contrast: captureContrast(el),
    intent: options.intent ?? "",
    target: options.target ?? "auto",
    job,
    direction: job,
  };
}

export function hoverPreview(el: Element) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const family = style.fontFamily
    .split(",")[0]
    ?.replace(/['"]/g, "")
    .trim();
  return {
    tag: el.tagName.toLowerCase(),
    selector: cssSelector(el),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    fontFamily: family || "unknown",
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    color: style.color,
    background: style.backgroundColor,
    radius: style.borderRadius,
    padding: style.padding,
    gap: style.gap,
  };
}
