export function cssSelector(el: Element): string {
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 5) {
    let part = node.tagName.toLowerCase();
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
      parts.unshift(`#${node.id}`);
      break;
    }
    const className = Array.from(node.classList)
      .filter((c) => /^[A-Za-z][\w-]*$/.test(c) && c.length < 40)
      .slice(0, 2)
      .join(".");
    if (className) part += `.${className}`;
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter(
        (child) => child instanceof Element && child.tagName === node!.tagName,
      );
      if (same.length > 1) {
        part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = parent;
    if (node?.tagName === "BODY" || node?.tagName === "HTML") break;
  }
  return parts.join(" > ");
}

export function visibleText(el: Element, max = 140): string {
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
