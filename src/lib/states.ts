import { STYLE_PROPS } from "./css";
import { cssSelector } from "./selector";
import type { DetectedLib, MotionEffectCapture, StyleMap } from "./types";

function safeSheets(): CSSStyleSheet[] {
  return Array.from(document.styleSheets).filter((sheet) => {
    try {
      void sheet.cssRules;
      return true;
    } catch {
      return false;
    }
  });
}

function walkRules(rules: CSSRuleList, visit: (rule: CSSStyleRule) => void) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      visit(rule);
    } else if ("cssRules" in rule) {
      walkRules((rule as CSSGroupingRule).cssRules, visit);
    }
  }
}

function stylesFromRule(rule: CSSStyleRule): Record<string, string> {
  const out: Record<string, string> = {};
  for (const prop of STYLE_PROPS) {
    const value = rule.style.getPropertyValue(prop).trim();
    if (value) out[prop] = value;
  }
  return out;
}

function selectorWithoutPseudo(selector: string, pseudo: string): string {
  return selector
    .split(",")
    .map((part) => part.replace(new RegExp(`${pseudo}(?![\\w-])`, "gi"), ""))
    .join(",")
    .trim();
}

function matchesClean(el: Element, selector: string): boolean {
  if (!selector) return false;
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function collectPseudo(
  el: Element,
  pseudo: ":hover" | ":focus" | ":active" | ":focus-visible",
): Record<string, string> {
  return collectPseudoData(el, pseudo).styles;
}

function collectPseudoData(
  el: Element,
  pseudo: ":hover" | ":focus" | ":active" | ":focus-visible",
): { styles: Record<string, string>; selectors: string[] } {
  const merged: Record<string, string> = {};
  const selectors = new Set<string>();
  for (const sheet of safeSheets()) {
    walkRules(sheet.cssRules, (rule) => {
      if (!rule.selectorText?.includes(pseudo)) return;
      const clean = selectorWithoutPseudo(rule.selectorText, pseudo);
      if (matchesClean(el, clean)) {
        Object.assign(merged, stylesFromRule(rule));
        selectors.add(rule.selectorText);
      }
    });
  }
  return { styles: merged, selectors: [...selectors] };
}

export function captureStates(el: Element) {
  return {
    hover: collectPseudo(el, ":hover"),
    focus: {
      ...collectPseudo(el, ":focus"),
      ...collectPseudo(el, ":focus-visible"),
    },
    active: collectPseudo(el, ":active"),
  };
}

export function captureKeyframes(): { name: string; css: string }[] {
  const found = new Map<string, string>();
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSKeyframesRule) {
        found.set(rule.name, rule.cssText);
      } else if ("cssRules" in rule) {
        walk((rule as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of safeSheets()) {
    walk(sheet.cssRules);
  }
  return [...found.entries()].map(([name, css]) => ({ name, css }));
}

function list(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function at<T>(items: T[], index: number, fallback: T): T {
  return items[index % Math.max(items.length, 1)] ?? fallback;
}

function changedProperties(states: StyleMap, rest: CSSStyleDeclaration): string[] {
  return Object.entries(states)
    .filter(([property, value]) => value !== rest.getPropertyValue(property).trim())
    .map(([property]) => property);
}

function transitionState(el: Element, liveStyles?: StyleMap): {
  trigger: MotionEffectCapture["trigger"];
  properties: string[];
  triggerSource?: string;
  triggerConfidence?: MotionEffectCapture["triggerConfidence"];
  stateStyles?: StyleMap;
} {
  const rest = getComputedStyle(el);
  const hoverState = collectPseudoData(el, ":hover");
  const hover = changedProperties(hoverState.styles, rest);
  if (hover.length) return {
    trigger: "hover",
    properties: hover,
    triggerSource: `matched CSS selector: ${hoverState.selectors.join(", ")}`,
    triggerConfidence: "high",
    stateStyles: hoverState.styles,
  };

  if (liveStyles) {
    const observed = Object.entries(liveStyles)
      .filter(([property, value]) =>
        !["transition", "animation"].includes(property) &&
        value !== rest.getPropertyValue(property).trim()
      )
      .map(([property]) => property);
    if (observed.length) return {
      trigger: "hover",
      properties: observed,
      triggerSource: "observed while pointer was over the selected component (may be controlled by a parent selector or JavaScript)",
      triggerConfidence: "medium",
      stateStyles: liveStyles,
    };
  }

  const states = captureStates(el);
  const focus = changedProperties(states.focus, rest);
  if (focus.length) return { trigger: "focus", properties: focus, triggerSource: "matched a :focus or :focus-visible CSS selector", triggerConfidence: "high", stateStyles: states.focus };
  const active = changedProperties(states.active, rest);
  if (active.length) return { trigger: "active", properties: active, triggerSource: "matched an :active CSS selector", triggerConfidence: "high", stateStyles: states.active };
  return { trigger: "runtime/unknown", properties: [] };
}

/** A transition started when the pointer shield removed hover. Its keyframes expose both endpoints. */
function activeTransitionValues(
  el: Element,
  property: string,
): { from: string; to: string } | undefined {
  const animation = el.getAnimations().find((item) => {
    const transition = item as Animation & { transitionProperty?: string };
    return item.constructor?.name === "CSSTransition" &&
      transition.transitionProperty === property;
  });
  const effect = animation?.effect;
  if (!(effect instanceof KeyframeEffect)) return undefined;
  const frames = effect.getKeyframes();
  const first = frames[0]?.[property];
  const last = frames.at(-1)?.[property];
  if (first === undefined || last === undefined || first === last) return undefined;
  // Measurement removes hover, so the active transition runs triggered → resting.
  return { from: String(last), to: String(first) };
}

function hasDetected(detected: DetectedLib[], name: string): boolean {
  return detected.some((item) => item.name.toLowerCase().includes(name.toLowerCase()));
}

function hasClassMatch(el: Element, pattern: RegExp): boolean {
  return Array.from(el.classList).some((name) => pattern.test(name));
}

function reactMotionProps(el: Element): boolean {
  let current: Element | null = el;
  for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
    for (const key of Object.keys(current)) {
      if (!key.startsWith("__reactProps$") && !key.startsWith("__reactFiber$")) continue;
      const record = current as unknown as Record<string, unknown>;
      const value = record[key] as { memoizedProps?: Record<string, unknown> } | Record<string, unknown> | undefined;
      const props = key.startsWith("__reactFiber$")
        ? (value as { memoizedProps?: Record<string, unknown> } | undefined)?.memoizedProps
        : value as Record<string, unknown> | undefined;
      if (props && ["animate", "whileHover", "whileTap", "variants", "layout", "layoutId", "exit"].some((prop) => prop in props)) {
        return true;
      }
    }
  }
  return false;
}

function motionLibrary(
  el: Element,
  type: MotionEffectCapture["type"],
  detected: DetectedLib[],
): NonNullable<MotionEffectCapture["library"]> {
  const tailwindMotion = /(?:^|:)(?:transition(?:-[\w[\]./-]+)?|duration-\S+|delay-\S+|ease-\S+|animate-\S+)$/;
  if (hasDetected(detected, "Tailwind") && hasClassMatch(el, tailwindMotion)) {
    return {
      name: "Tailwind CSS",
      confidence: "high",
      evidence: "motion utility class found on the effect target; rendered by native CSS",
    };
  }
  if (hasDetected(detected, "Webflow IX2") && el.closest("[data-w-id]")) {
    return {
      name: "Webflow IX2",
      confidence: "high",
      evidence: "effect target is inside a Webflow interaction node",
    };
  }
  if (hasDetected(detected, "Lottie") && el.closest("lottie-player, dotlottie-player, [data-lottie]")) {
    return { name: "Lottie", confidence: "high", evidence: "effect target is inside a Lottie player" };
  }
  if (hasDetected(detected, "Rive") && el.closest("rive-canvas, canvas[data-rive], [data-rive]")) {
    return { name: "Rive", confidence: "high", evidence: "effect target is inside a Rive canvas" };
  }
  if (hasDetected(detected, "Motion") && reactMotionProps(el)) {
    return {
      name: "Motion / Framer Motion",
      confidence: "high",
      evidence: "Motion-specific React props found on the target or its interaction parent",
    };
  }
  if (type === "transition") {
    return { name: "Native CSS", confidence: "high", evidence: "CSS transition declaration measured on this target" };
  }
  if (type === "css-animation") {
    return { name: "Native CSS", confidence: "high", evidence: "CSS animation declaration measured on this target" };
  }
  return {
    name: "Web Animations API",
    confidence: "high",
    evidence: "browser exposed a KeyframeEffect on this target; no element-level library signature was found",
  };
}

function cssEffects(
  el: Element,
  detected: DetectedLib[],
  liveStyles?: StyleMap,
): MotionEffectCapture[] {
  const style = getComputedStyle(el);
  const target = cssSelector(el);
  const effects: MotionEffectCapture[] = [];
  const transitionProperties = list(style.transitionProperty);
  const transitionDurations = list(style.transitionDuration);
  const transitionDelays = list(style.transitionDelay);
  const transitionEasings = list(style.transitionTimingFunction);
  let state: ReturnType<typeof transitionState> | null = null;

  transitionProperties.forEach((property, index) => {
    const duration = at(transitionDurations, index, "0s");
    if (property === "none" || (duration === "0s" && at(transitionDelays, index, "0s") === "0s")) return;
    state ??= transitionState(el, liveStyles);
    const properties = property === "all" && state.properties.length
      ? state.properties
      : [property];
    const values = Object.fromEntries(properties.flatMap((name) => {
      const endpoints = activeTransitionValues(el, name);
      if (endpoints) return [[name, endpoints]];
      const from = style.getPropertyValue(name).trim();
      const to = state?.stateStyles?.[name]?.trim();
      return to !== undefined && from !== to ? [[name, { from, to }]] : [];
    }));
    effects.push({
      type: "transition",
      target,
      trigger: state.trigger,
      properties,
      duration,
      delay: at(transitionDelays, index, "0s"),
      easing: at(transitionEasings, index, "ease"),
      iterations: "1",
      direction: "normal",
      fill: "none",
      triggerSource: state.triggerSource,
      triggerConfidence: state.triggerConfidence,
      values: Object.keys(values).length ? values : undefined,
      library: motionLibrary(el, "transition", detected),
    });
  });

  const names = list(style.animationName);
  const durations = list(style.animationDuration);
  const delays = list(style.animationDelay);
  const easings = list(style.animationTimingFunction);
  const iterations = list(style.animationIterationCount);
  const directions = list(style.animationDirection);
  const fills = list(style.animationFillMode);
  const playStates = list(style.animationPlayState);
  const timelines = list(style.getPropertyValue("animation-timeline"));
  names.forEach((name, index) => {
    if (name === "none") return;
    const timeline = at(timelines, index, "auto");
    effects.push({
      type: "css-animation",
      target,
      trigger: timeline !== "auto" ? "scroll" : "load/auto",
      properties: [],
      duration: at(durations, index, "0s"),
      delay: at(delays, index, "0s"),
      easing: at(easings, index, "ease"),
      iterations: at(iterations, index, "1"),
      direction: at(directions, index, "normal"),
      fill: at(fills, index, "none"),
      playState: at(playStates, index, "running"),
      timeline,
      keyframes: [{ name }],
      library: motionLibrary(el, "css-animation", detected),
    });
  });
  return effects;
}

function runtimeEffects(root: Element, detected: DetectedLib[]): MotionEffectCapture[] {
  if (!(root as HTMLElement).getAnimations) return [];
  const animations = root.getAnimations({ subtree: true });
  return animations.flatMap((animation) => {
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof Element)) return [];
    const ctor = animation.constructor?.name;
    // CSS animations/transitions are already represented from computed styles.
    if (ctor === "CSSAnimation" || ctor === "CSSTransition") return [];
    const timing = effect.getComputedTiming();
    const frames = effect.getKeyframes().slice(0, 40).map((frame) => {
      const clean: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(frame)) {
        if (key === "computedOffset") continue;
        if (["offset", "easing", "composite"].includes(key) || typeof value === "string" || typeof value === "number" || value === null) {
          clean[key] = value as string | number | null;
        }
      }
      return clean;
    });
    const properties = [...new Set(frames.flatMap((frame) => Object.keys(frame)).filter((key) => !["offset", "easing", "composite"].includes(key)))];
    const timelineName = animation.timeline?.constructor?.name ?? "DocumentTimeline";
    return [{
      type: "web-animation" as const,
      target: cssSelector(effect.target),
      trigger: /scroll|view/i.test(timelineName) ? "scroll" as const : "runtime/unknown" as const,
      properties,
      duration: typeof timing.duration === "number" ? `${timing.duration}ms` : String(timing.duration),
      delay: `${timing.delay}ms`,
      easing: timing.easing ?? "linear",
      iterations: String(timing.iterations),
      direction: timing.direction ?? "normal",
      fill: timing.fill ?? "none",
      playState: animation.playState,
      timeline: timelineName,
      keyframes: frames,
      library: motionLibrary(effect.target, "web-animation", detected),
    }];
  });
}

function motionNodes(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll("*"))].slice(0, 80);
}

export function snapshotMotionStyles(root: Element): Map<Element, StyleMap> {
  const snapshot = new Map<Element, StyleMap>();
  for (const node of motionNodes(root)) {
    const computed = getComputedStyle(node);
    const styles: StyleMap = {};
    for (const property of STYLE_PROPS) {
      styles[property] = computed.getPropertyValue(property).trim();
    }
    snapshot.set(node, styles);
  }
  return snapshot;
}

export function captureMotion(
  el: Element,
  detected: DetectedLib[] = [],
  liveMotionStyles?: Map<Element, StyleMap>,
) {
  const effects = motionNodes(el)
    .flatMap((node) => cssEffects(node, detected, liveMotionStyles?.get(node)))
    .slice(0, 120);
  effects.push(...runtimeEffects(el, detected).slice(0, Math.max(0, 120 - effects.length)));
  const transitions = [...new Set(effects.filter((item) => item.type === "transition").map((item) => `${item.properties.join(", ")} ${item.duration} ${item.easing} ${item.delay}`))];
  const animations = [...new Set(motionNodes(el).map((node) => getComputedStyle(node).animation).filter((value) => value && value !== "none"))];
  const names = new Set(effects.filter((item) => item.type === "css-animation").map((item) => String(item.keyframes?.[0]?.name ?? "")).filter(Boolean));
  const keyframes = captureKeyframes().filter((frame) => names.has(frame.name));

  for (const effect of effects) {
    if (effect.type !== "css-animation") continue;
    const name = String(effect.keyframes?.[0]?.name ?? "");
    const frame = keyframes.find((item) => item.name === name);
    if (frame) {
      effect.properties = [...new Set(
        Array.from(frame.css.matchAll(/([\w-]+)\s*:/g))
          .flatMap((match) => match[1] ? [match[1]] : [])
          .filter((property) => !/^(from|to|\d+)$/.test(property)),
      )];
    }
  }

  return {
    transitions,
    animations,
    keyframes,
    effects,
    libraries: detected.filter((item) => item.kind === "motion" || item.kind === "3d"),
  };
}
