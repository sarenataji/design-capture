import { STYLE_PROPS } from "./css";

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
    if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
      walkRules(rule.cssRules, visit);
    } else if (rule instanceof CSSStyleRule) {
      visit(rule);
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
  const merged: Record<string, string> = {};
  for (const sheet of safeSheets()) {
    walkRules(sheet.cssRules, (rule) => {
      if (!rule.selectorText?.includes(pseudo)) return;
      const clean = selectorWithoutPseudo(rule.selectorText, pseudo);
      if (matchesClean(el, clean)) {
        Object.assign(merged, stylesFromRule(rule));
      }
    });
  }
  return merged;
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
  for (const sheet of safeSheets()) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (rule instanceof CSSKeyframesRule) {
        found.set(rule.name, rule.cssText);
      }
    }
  }
  return [...found.entries()].map(([name, css]) => ({ name, css }));
}

export function captureMotion(el: Element) {
  const computed = getComputedStyle(el);
  const transitions = computed.transition && computed.transition !== "all 0s ease 0s"
    ? [computed.transition]
    : [];
  const animations =
    computed.animation && computed.animation !== "none"
      ? [computed.animation]
      : [];

  const names = animations
    .join(" ")
    .split(",")
    .map((part) => part.trim().split(" ")[0])
    .filter(Boolean) as string[];

  const keyframes = names.length
    ? captureKeyframes().filter((frame) => names.includes(frame.name))
    : [];

  return {
    transitions,
    animations,
    keyframes,
  };
}
