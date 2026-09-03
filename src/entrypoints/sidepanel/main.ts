import { renderOutput } from "../../lib/prompt";
import { STORAGE_KEYS } from "../../lib/storage";
import type { CaptureResult, Direction, OutputKind, Target } from "../../lib/types";

const out = document.querySelector<HTMLPreElement>("#out")!;
const intent = document.querySelector<HTMLTextAreaElement>("#intent")!;
const target = document.querySelector<HTMLSelectElement>("#target")!;
const direction = document.querySelector<HTMLSelectElement>("#direction")!;
const pick = document.querySelector<HTMLButtonElement>("#pick")!;
const copy = document.querySelector<HTMLButtonElement>("#copy")!;
const tabs = document.querySelector<HTMLElement>("#tabs")!;
const status = document.querySelector<HTMLElement>("#status")!;
const summary = document.querySelector<HTMLElement>("#summary")!;
const sumTitle = document.querySelector<HTMLElement>("#sum-title")!;
const sumMeta = document.querySelector<HTMLElement>("#sum-meta")!;
const swatches = document.querySelector<HTMLElement>("#swatches")!;

let kind: OutputKind = "prompt";
let capture: CaptureResult | null = null;
let picking = false;

async function restore() {
  const stored = await browser.storage.local.get([
    STORAGE_KEYS.lastCapture,
    STORAGE_KEYS.intent,
    STORAGE_KEYS.target,
    STORAGE_KEYS.direction,
    STORAGE_KEYS.pickerActive,
    STORAGE_KEYS.outputKind,
  ]);
  if (typeof stored.intent === "string") intent.value = stored.intent;
  if (stored.target) target.value = stored.target as string;
  if (stored.direction) direction.value = stored.direction as string;
  if (stored.outputKind) {
    kind = stored.outputKind as OutputKind;
    syncTabs();
  }
  picking = Boolean(stored.pickerActive);
  if (stored.lastCapture) capture = stored.lastCapture as CaptureResult;
  render();
}

function syncTabs() {
  for (const child of tabs.querySelectorAll("button")) {
    child.classList.toggle("on", child.dataset.kind === kind);
  }
}

function setPicking(on: boolean) {
  picking = on;
  pick.classList.toggle("on", on);
  pick.textContent = on ? "Listening" : "Pick";
  status.textContent = on ? "Picking" : capture ? "Captured" : "Idle";
  status.className = `kicker ${on ? "live" : "idle"}`;
}

function render() {
  setPicking(picking);
  if (!capture) {
    summary.hidden = true;
    out.textContent =
      "Write intent first. Then Pick (or Alt+Shift+D), hover a component, click. The prompt copies itself.";
    return;
  }

  summary.hidden = false;
  sumTitle.textContent = `${capture.node.tag} · ${capture.node.box.width}×${capture.node.box.height}`;
  sumMeta.textContent = `${capture.title} · ${capture.tokens.fonts[0]?.family ?? "type"} · ${capture.tokens.colors.length} colors`;
  swatches.innerHTML = capture.tokens.colors
    .slice(0, 8)
    .map((c) => `<i title="${c.value} · ${c.roles.join(", ")}" style="background:${c.value}"></i>`)
    .join("");

  out.textContent = renderOutput(kind, {
    ...capture,
    intent: intent.value,
    target: target.value as Target,
    direction: direction.value as Direction,
  });
}

async function togglePicker() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await browser.tabs.sendMessage(tab.id, { type: "toggle-picker" }).catch(() => {});
}

pick.addEventListener("click", () => {
  void togglePicker();
});

copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(out.textContent ?? "");
  copy.textContent = "Copied";
  setTimeout(() => {
    copy.textContent = "Copy";
  }, 900);
});

intent.addEventListener("input", () => {
  void browser.storage.local.set({ [STORAGE_KEYS.intent]: intent.value });
  render();
});

target.addEventListener("change", () => {
  void browser.storage.local.set({ [STORAGE_KEYS.target]: target.value });
  render();
});

direction.addEventListener("change", () => {
  void browser.storage.local.set({ [STORAGE_KEYS.direction]: direction.value });
  render();
});

tabs.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.kind) return;
  kind = button.dataset.kind as OutputKind;
  void browser.storage.local.set({ [STORAGE_KEYS.outputKind]: kind });
  syncTabs();
  render();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.lastCapture) {
    capture = (changes.lastCapture.newValue as CaptureResult) ?? null;
    kind = "prompt";
    syncTabs();
  }
  if (changes.pickerActive) picking = Boolean(changes.pickerActive.newValue);
  render();
});

void restore();
