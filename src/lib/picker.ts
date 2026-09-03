import { captureElement, hoverPreview } from "./capture";
import { readStyles } from "./css";
import { outputLabel, renderOutput } from "./prompt";
import { STORAGE_KEYS } from "./storage";
import type {
  CaptureResult,
  Job,
  OutputKind,
  PageScan,
  StyleMap,
  Target,
} from "./types";

const HOST_ID = "design-capture-root";

type PickerOptions = {
  onCapture: (result: CaptureResult) => void;
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
  let current: Element | null = null;
  let host: HTMLElement | null = null;
  let shadow: ShadowRoot | null = null;
  let box: HTMLDivElement | null = null;
  let tip: HTMLDivElement | null = null;
  let overlay: HTMLDivElement | null = null;
  let toastEl: HTMLDivElement | null = null;
  let toastTimer = 0;
  let liveStyles: StyleMap = {};

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
          border: 1.5px solid #d6ff3f;
          background: rgba(214, 255, 63, 0.08);
          box-shadow: 0 0 0 1px rgba(10,11,9,0.55);
        }
        .tip {
          position: absolute;
          max-width: 360px;
          padding: 8px 10px;
          background: #0f110c;
          color: #f4f6ef;
          font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
          box-shadow: 0 12px 32px rgba(0,0,0,0.45);
        }
        .tip b { color: #d6ff3f; font-weight: 650; }
        .tip .sel { color: #9aa392; word-break: break-all; margin-top: 4px; }
        .swatches { display: flex; gap: 4px; margin-top: 6px; }
        .swatch {
          width: 12px; height: 12px;
          border: 1px solid rgba(255,255,255,0.2);
        }
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
        .brand span { font-size: 9px; color: #d6ff3f; letter-spacing: 0.14em; }
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
          background: #d6ff3f;
          color: #11140c;
          border-color: #d6ff3f;
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
          background: #d6ff3f;
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
    Object.assign(box.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    liveStyles = readStyles(current);
    const preview = hoverPreview(current);
    tip.hidden = false;
    const tipWidth = 340;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - tipWidth - 8,
    );
    const preferAbove = rect.top > 120;
    const top = preferAbove ? rect.top - 8 : rect.bottom + 8;
    tip.style.left = `${left}px`;
    tip.style.top = preferAbove ? `${Math.max(8, top - 108)}px` : `${top}px`;
    tip.innerHTML = `
      <b>${escapeHtml(preview.tag)}</b> ${preview.width}×${preview.height}
      <br>${escapeHtml(preview.fontFamily)} · ${escapeHtml(preview.fontWeight)} · ${escapeHtml(preview.fontSize)} / ${escapeHtml(preview.lineHeight)} · ls ${escapeHtml(preview.letterSpacing)}
      <br>${escapeHtml(preview.color)} · bg ${escapeHtml(preview.background)}
      <br>r ${escapeHtml(preview.radius)} · p ${escapeHtml(preview.padding)} · gap ${escapeHtml(preview.gap)}
      <div class="sel">${escapeHtml(preview.selector)}</div>
      <div class="swatches">
        <span class="swatch" style="background:${preview.color}"></span>
        <span class="swatch" style="background:${preview.background}"></span>
      </div>
    `;
  }

  function setCurrent(el: Element | null) {
    if (!el || el === document.documentElement || el === document.body) return;
    if (isOurNode(el)) return;
    current = el;
    paint();
  }

  function walk(which: "parent" | "child") {
    if (!current) return;
    const next =
      which === "parent" ? current.parentElement : current.firstElementChild;
    if (next) setCurrent(next);
  }

  function onMove(event: MouseEvent) {
    if (!active) return;
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
    const el = current || deepFromPoint(event.clientX, event.clientY);
    if (el) void commit(el);
  }

  function onKey(event: KeyboardEvent) {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      stop();
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

  async function commit(el: Element) {
    const hovered = liveStyles;
    overlay?.classList.add("shield");
    await frames(2);
    const kind = options.getOutputKind();
    const result = captureElement(el, {
      target: options.getTarget(),
      intent: options.getIntent(),
      job: options.getJob(),
      liveStyles: hovered,
    });
    overlay?.classList.remove("shield");
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
    toast("Hover — inspect. Click — capture.");
  }

  function stop() {
    if (!active && !host) return;
    setActive(false);
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
    liveStyles = {};
  }

  function toggle() {
    if (active) stop();
    else start();
    return active;
  }

  return { start, stop, toggle, isActive: () => active, toast };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
