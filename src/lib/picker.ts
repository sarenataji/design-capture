import { captureElement, hoverPreview } from "./capture";
import { cssColorToHex } from "./color";
import { readStyles } from "./css";
import { outputLabel, renderOutput } from "./prompt";
import { STORAGE_KEYS } from "./storage";
import { captureVisibleColors } from "./visual";
import { snapshotMotionStyles } from "./states";
import type {
  CaptureResult,
  Job,
  OutputKind,
  PageScan,
  Target,
} from "./types";

const HOST_ID = "design-capture-root";

type PickerOptions = {
  onCapture: (result: CaptureResult) => void;
  onPreview: (result: CaptureResult) => void;
  getTarget: () => Target;
  getIntent: () => string;
  getJob: () => Job;
  getOutputKind: () => OutputKind;
  getScan: () => PageScan | null;
};

function frames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

export function createPicker(options: PickerOptions) {
  let active = false;
  let locked = false;
  let expanded = false;
  let current: Element | null = null;
  let host: HTMLElement | null = null;
  let shadow: ShadowRoot | null = null;
  let box: HTMLDivElement | null = null;
  let tip: HTMLDivElement | null = null;
  let overlay: HTMLDivElement | null = null;
  let toastEl: HTMLDivElement | null = null;
  let toastTimer = 0;
  let previewSeq = 0;

  function ensureUi() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-design-capture", "root");
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
        .overlay.shield { pointer-events: auto; }
        .box {
          position: absolute;
          border: 1.5px solid #ffb8d4;
          background: rgba(255, 184, 212, 0.08);
          box-shadow: 0 0 0 1px rgba(10,11,9,0.55);
        }
        .box.locked {
          border-style: dashed;
          background: rgba(255, 184, 212, 0.16);
        }
        .tip {
          position: absolute;
          width: 288px;
          background: #0f110c;
          color: #f4f6ef;
          font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
          box-shadow: 0 12px 32px rgba(0,0,0,0.45);
        }
        .tip.locked { box-shadow: 0 0 0 1.5px #ffb8d4, 0 12px 32px rgba(0,0,0,0.45); }
        .head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
        }
        .tag {
          color: #ffb8d4;
          font-weight: 650;
        }
        .dim { color: #f4f6ef; }
        .head .swatches { margin-left: auto; }
        .swatches { display: flex; gap: 3px; }
        .swatch {
          width: 11px; height: 11px;
          border: 1px solid rgba(255,255,255,0.22);
        }
        .rows { border-top: 1px solid #232a1f; padding: 6px 10px 7px; }
        .row {
          display: grid;
          grid-template-columns: 46px 1fr;
          gap: 8px;
          padding: 1px 0;
        }
        .row dt {
          color: #6f7a66;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          line-height: 1.7;
        }
        .row dd { margin: 0; }
        .row dd span { color: #6f7a66; }
        .path {
          border-top: 1px solid #232a1f;
          padding: 6px 10px 7px;
          color: #9aa392;
          word-break: break-all;
        }
        .path em { color: #f4f6ef; font-style: normal; }
        .path.one {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }
        .hint {
          border-top: 1px solid #232a1f;
          padding: 6px 10px;
          color: #6f7a66;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .hint.on { color: #ffb8d4; }
        .dock {
          pointer-events: auto;
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 8px 7px 12px;
          background: #0f110c;
          color: #f4f6ef;
          border: 1px solid #2a2e24;
          box-shadow: 0 16px 40px rgba(0,0,0,0.4);
          font: 11px/1 ui-sans-serif, system-ui, sans-serif;
        }
        .brand {
          display: grid;
          padding-right: 10px;
          margin-right: 2px;
          border-right: 1px solid #2a2e24;
        }
        .brand b { font-size: 10px; letter-spacing: 0.16em; }
        .brand span { font-size: 9px; color: #ffb8d4; letter-spacing: 0.14em; }
        .dock button {
          height: 28px;
          padding: 0 9px;
          border: 1px solid #2a2e24;
          background: #171a13;
          color: #f4f6ef;
          cursor: pointer;
          font: inherit;
        }
        .dock button.primary {
          background: #ffb8d4;
          color: #11140c;
          border-color: #ffb8d4;
          font-weight: 650;
        }
        .dock kbd {
          font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
          opacity: 0.55;
          margin-left: 4px;
        }
        .toast {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          background: #ffb8d4;
          color: #11140c;
          padding: 8px 12px;
          font: 650 11px/1 ui-sans-serif, system-ui, sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0;
          transition: opacity 160ms ease;
        }
        .toast.show { opacity: 1; }
      </style>
      <div class="overlay">
        <div class="box" hidden></div>
        <div class="tip" hidden></div>
        <div class="dock">
          <div class="brand"><b>CAPTURE</b><span>INSPECT</span></div>
          <button type="button" data-act="parent">Parent <kbd>↑</kbd></button>
          <button type="button" data-act="child">Child <kbd>↓</kbd></button>
          <button type="button" data-act="specs">Specs <kbd>⇥</kbd></button>
          <button type="button" class="primary" data-act="capture">Capture <kbd>↵</kbd></button>
          <button type="button" data-act="stop">Esc</button>
        </div>
        <div class="toast"></div>
      </div>
    `;
    overlay = shadow.querySelector(".overlay");
    box = shadow.querySelector(".box");
    tip = shadow.querySelector(".tip");
    toastEl = shadow.querySelector(".toast");
    shadow.addEventListener("click", (event) => {
      const act = (event.target as HTMLElement).closest("button")?.dataset.act;
      if (act === "parent") walk("parent");
      if (act === "child") walk("child");
      if (act === "specs") {
        expanded = !expanded;
        paint();
      }
      if (act === "capture" && current) void commit(current);
      if (act === "stop") stop();
    });
    document.documentElement.appendChild(host);
  }

  function isOurNode(node: EventTarget | null) {
    if (!host || !node || !(node instanceof Node)) return false;
    return node === host || host.contains(node);
  }

  function deepFromPoint(x: number, y: number): Element | null {
    const stack = document.elementsFromPoint(x, y);
    return stack.find((el) => !isOurNode(el)) ?? null;
  }

  function paint() {
    if (!current || !box || !tip) return;
    const rect = current.getBoundingClientRect();
    box.hidden = false;
    box.classList.toggle("locked", locked);
    tip.classList.toggle("locked", locked);
    Object.assign(box.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    const preview = hoverPreview(current);
    tip.hidden = false;
    tip.innerHTML = tipHtml(preview, { locked, expanded });

    const tipWidth = 288;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - tipWidth - 8,
    );
    const preferAbove = rect.top > tip.offsetHeight + 16;
    tip.style.left = `${left}px`;
    tip.style.top = preferAbove
      ? `${rect.top - tip.offsetHeight - 8}px`
      : `${Math.min(rect.bottom + 8, window.innerHeight - tip.offsetHeight - 8)}px`;
  }

  function setCurrent(el: Element | null) {
    if (!el || el === document.documentElement || el === document.body) return;
    if (isOurNode(el)) return;
    current = el;
    paint();
    if (locked) void preview(el);
  }

  function walk(which: "parent" | "child") {
    if (!current) return;
    const next =
      which === "parent" ? current.parentElement : current.firstElementChild;
    if (next) setCurrent(next);
  }

  function onMove(event: MouseEvent) {
    if (!active || locked) return;
    if (event.composedPath().some((n) => isOurNode(n))) return;
    const el = deepFromPoint(event.clientX, event.clientY);
    if (el) setCurrent(el);
  }

  function onPointer(event: PointerEvent) {
    if (!active) return;
    if (event.composedPath().some((n) => isOurNode(n))) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.type !== "pointerdown") return;
    if (locked) {
      setLocked(false);
      const el = deepFromPoint(event.clientX, event.clientY);
      if (el) setCurrent(el);
      return;
    }
    const el = current || deepFromPoint(event.clientX, event.clientY);
    if (!el) return;
    current = el;
    setLocked(true);
  }

  function setLocked(next: boolean) {
    locked = next;
    if (next) expanded = true;
    paint();
    if (!next || !current) return;
    void preview(current);
    toast("Locked — sent to panel · ↵ copies");
  }

  function onKey(event: KeyboardEvent) {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (locked) setLocked(false);
      else stop();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      expanded = !expanded;
      paint();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      walk("parent");
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      walk("child");
    }
    if (event.key === "Enter" && current) {
      event.preventDefault();
      void commit(current);
    }
  }

  /** Shields the pointer so hover styles drop out of the resting measurement. */
  async function measure(el: Element) {
    const hovered = readStyles(el);
    const hoveredMotion = snapshotMotionStyles(el);
    const scan = options.getScan();
    overlay?.classList.add("shield");
    await frames(2);
    const result = captureElement(el, {
      target: options.getTarget(),
      intent: options.getIntent(),
      job: options.getJob(),
      liveStyles: hovered,
      liveMotionStyles: hoveredMotion,
      detected: scan?.url === location.href ? scan.detected : undefined,
    });
    if (host) host.style.display = "none";
    await frames(2);
    result.tokens.visualColors = await captureVisibleColors(result.node.box);
    if (host) host.style.display = "";
    overlay?.classList.remove("shield");
    return result;
  }

  async function preview(el: Element) {
    const seq = (previewSeq += 1);
    const result = await measure(el);
    if (seq === previewSeq) options.onPreview(result);
  }

  async function commit(el: Element) {
    const kind = options.getOutputKind();
    const result = await measure(el);
    const text = renderOutput(kind, result, options.getScan());
    void navigator.clipboard.writeText(text).catch(() => {});
    options.onCapture(result);
    toast(`${outputLabel(kind)} copied`);
    stop();
  }

  function toast(message: string) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl?.classList.remove("show"), 1400);
  }

  function setActive(next: boolean) {
    active = next;
    void browser.storage.local.set({ [STORAGE_KEYS.pickerActive]: next });
  }

  function start() {
    if (active) return;
    setActive(true);
    ensureUi();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("click", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    toast("Hover — inspect. Click — lock and send to panel.");
  }

  function stop() {
    if (!active && !host) return;
    setActive(false);
    locked = false;
    expanded = false;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("click", onPointer, true);
    document.removeEventListener("keydown", onKey, true);
    host?.remove();
    host = null;
    shadow = null;
    box = null;
    tip = null;
    overlay = null;
    toastEl = null;
    current = null;
  }

  function toggle() {
    if (active) stop();
    else start();
    return active;
  }

  return { start, stop, toggle, isActive: () => active, toast };
}

type Preview = ReturnType<typeof hoverPreview>;

function tipHtml(
  preview: Preview,
  state: { locked: boolean; expanded: boolean },
) {
  const head = `
    <div class="head">
      <span class="tag">${escapeHtml(preview.tag)}</span>
      <span class="dim">${preview.width} × ${preview.height}</span>
      <span class="swatches">
        <span class="swatch" style="background:${preview.color}"></span>
        <span class="swatch" style="background:${preview.background}"></span>
      </span>
    </div>`;

  const hint = state.locked
    ? `<div class="hint on">Locked · in panel · ↵ copy · click release</div>`
    : `<div class="hint">${state.expanded ? "Tab hide specs" : "Tab specs"} · click lock</div>`;

  if (!state.expanded) return `${head}${selectorHtml(preview.selector, true)}${hint}`;

  const rows = [
    ["type", `${preview.fontFamily} <span>·</span> ${preview.fontWeight}`],
    [
      "text",
      `${trim(preview.fontSize)}<span>/</span>${trim(preview.lineHeight)} <span>·</span> ls ${trim(preview.letterSpacing)}`,
    ],
    ["fill", `${swatchValue(preview.color)} <span>on</span> ${swatchValue(preview.background)}`],
    [
      "box",
      `r ${trim(preview.radius)} <span>·</span> p ${trim(preview.padding)}${preview.gap && preview.gap !== "normal" ? ` <span>·</span> gap ${trim(preview.gap)}` : ""}`,
    ],
  ];

  const body = rows
    .map(([label, value]) => `<dl class="row"><dt>${label}</dt><dd>${value}</dd></dl>`)
    .join("");

  return `${head}<div class="rows">${body}</div>${selectorHtml(preview.selector, false)}${hint}`;
}

function selectorHtml(selector: string, compact: boolean) {
  const parts = selector.split(" > ");
  const last = escapeHtml(parts.at(-1) ?? selector);
  if (compact)
    return `<div class="path one">${parts.length > 1 ? "… › " : ""}<em>${last}</em></div>`;
  const head = parts.slice(0, -1).map(escapeHtml).join(" ›&#8203; ");
  return `<div class="path">${head ? `${head} ›&#8203; ` : ""}<em>${last}</em></div>`;
}

function swatchValue(color: string) {
  return `${escapeHtml(cssColorToHex(color) ?? color)}`;
}

function trim(value: string) {
  return value.replaceAll("px", "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
