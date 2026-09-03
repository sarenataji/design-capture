import { JOBS } from "../../lib/jobs";
import { OUTPUTS } from "../../lib/outputs";
import { renderOutput } from "../../lib/prompt";
import { TARGETS } from "../../lib/targets";
import { WALK_LIMIT } from "../../lib/scan";
import { stackByKind, toScanMd } from "../../lib/scan-report";
import { STORAGE_KEYS } from "../../lib/storage";
import type {
  CaptureResult,
  Job,
  OutputKind,
  PageScan,
  Target,
} from "../../lib/types";

const out = document.querySelector<HTMLPreElement>("#out")!;
const intent = document.querySelector<HTMLTextAreaElement>("#intent")!;
const target = document.querySelector<HTMLSelectElement>("#target")!;
const jobs = document.querySelector<HTMLSelectElement>("#jobs")!;
const jobGuideList = document.querySelector<HTMLElement>("#job-guide-list")!;
const targetGuideList =
  document.querySelector<HTMLElement>("#target-guide-list")!;
const outputGuideList =
  document.querySelector<HTMLElement>("#output-guide-list")!;
const scrim = document.querySelector<HTMLElement>("#scrim")!;
const pick = document.querySelector<HTMLButtonElement>("#pick")!;
const scanBtn = document.querySelector<HTMLButtonElement>("#scan")!;
const copy = document.querySelector<HTMLButtonElement>("#copy")!;
const copyScan = document.querySelector<HTMLButtonElement>("#copy-scan")!;
const tabs = document.querySelector<HTMLSelectElement>("#tabs")!;
const status = document.querySelector<HTMLElement>("#status")!;
const summary = document.querySelector<HTMLElement>("#summary")!;
const sumTitle = document.querySelector<HTMLElement>("#sum-title")!;
const sumMeta = document.querySelector<HTMLElement>("#sum-meta-text")!;
const sumColors = document.querySelector<HTMLButtonElement>("#sum-colors")!;
const colorsGuideList =
  document.querySelector<HTMLElement>("#colors-guide-list")!;
const swatches = document.querySelector<HTMLElement>("#swatches")!;
const scanReport = document.querySelector<HTMLElement>("#scan-report")!;
const scanSource = document.querySelector<HTMLElement>("#scan-source")!;
const scanRows = document.querySelector<HTMLElement>("#scan-rows")!;
const captureSetup = document.querySelector<HTMLDetailsElement>("#capture-setup")!;
const setupSummary = document.querySelector<HTMLElement>("#setup-summary")!;

let kind: OutputKind = "photocopy";
let job: Job = "rebuild";
let capture: CaptureResult | null = null;
let scan: PageScan | null = null;
let picking = false;
let scanning = false;
let currentTabId: number | null = null;
let currentPageUrl = "";

target.innerHTML = TARGETS.map(
  (item) => `<option value="${item.id}">${item.label}</option>`,
).join("");
jobs.innerHTML = JOBS.map(
  (item) => `<option value="${item.id}">${item.label}</option>`,
).join("");
tabs.innerHTML = OUTPUTS.map(
  (item) => `<option value="${item.id}">${item.label}</option>`,
).join("");

function guideRows(
  items: { id: string; label: string; plain: string }[],
  key: string,
) {
  return items
    .map(
      (item) =>
        `<button type="button" class="guide-row" data-${key}="${item.id}">
          <strong>${item.label}</strong>
          <small>${item.plain}</small>
        </button>`,
    )
    .join("");
}

jobGuideList.innerHTML = guideRows(JOBS, "job");
targetGuideList.innerHTML = guideRows(TARGETS, "target");
outputGuideList.innerHTML = guideRows(OUTPUTS, "kind");

function pageKey(url: string | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function belongsToCurrentPage(value: CaptureResult | PageScan | undefined): boolean {
  return Boolean(value && currentPageUrl && pageKey(value.url) === pageKey(currentPageUrl));
}

async function readCurrentTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;
  currentPageUrl = tab?.url ?? "";
}

async function restorePageData() {
  const stored = await browser.storage.local.get([
    STORAGE_KEYS.lastCapture,
    STORAGE_KEYS.lastScan,
  ]);
  const storedCapture = stored.lastCapture as CaptureResult | undefined;
  const storedScan = stored.lastScan as PageScan | undefined;
  capture = storedCapture && belongsToCurrentPage(storedCapture) ? storedCapture : null;
  scan = storedScan && belongsToCurrentPage(storedScan) ? storedScan : null;
}

async function restore() {
  const [stored] = await Promise.all([
    browser.storage.local.get([
    STORAGE_KEYS.intent,
    STORAGE_KEYS.target,
    STORAGE_KEYS.job,
    STORAGE_KEYS.direction,
    STORAGE_KEYS.pickerActive,
    STORAGE_KEYS.outputKind,
    ]),
    readCurrentTab(),
  ]);
  if (typeof stored.intent === "string") intent.value = stored.intent;
  if (stored.target) target.value = stored.target as string;
  if (stored.job) job = stored.job as Job;
  else if (stored.direction) job = stored.direction as Job;
  if (stored.outputKind) kind = stored.outputKind as OutputKind;
  picking = Boolean(stored.pickerActive);
  await restorePageData();
  syncTabs();
  syncJobs();
  syncTarget();
  render();
}

async function switchPage(tabId?: number, url?: string) {
  const previousTab = currentTabId;
  const previousUrl = currentPageUrl;
  if (tabId !== undefined) currentTabId = tabId;
  if (url !== undefined) currentPageUrl = url;
  if (url === undefined) await readCurrentTab();
  if (previousTab === currentTabId && pageKey(previousUrl) === pageKey(currentPageUrl)) return;
  capture = null;
  scan = null;
  picking = false;
  scanning = false;
  setGuide(null);
  await restorePageData();
  render();
}

function syncTabs() {
  tabs.value = kind;
  const buttons = [...outputGuideList.querySelectorAll("button")];
  for (const child of buttons) {
    child.classList.toggle("on", child.dataset.kind === kind);
  }
}

function syncSetupSummary() {
  const jobLabel = jobs.selectedOptions[0]?.textContent ?? job;
  const targetLabel = target.selectedOptions[0]?.textContent ?? target.value;
  setupSummary.textContent = `${jobLabel} · ${targetLabel}`;
}

function syncJobs() {
  jobs.value = job;
  const buttons = [...jobGuideList.querySelectorAll("button")];
  for (const child of buttons) {
    child.classList.toggle("on", child.dataset.job === job);
  }
  syncSetupSummary();
}

function syncTarget() {
  for (const child of targetGuideList.querySelectorAll("button")) {
    child.classList.toggle("on", child.dataset.target === target.value);
  }
  syncSetupSummary();
}

function setJob(next: Job) {
  job = next;
  void browser.storage.local.set({
    [STORAGE_KEYS.job]: job,
    [STORAGE_KEYS.direction]: job,
  });
  syncJobs();
  render();
}

function setTarget(next: Target) {
  target.value = next;
  void browser.storage.local.set({ [STORAGE_KEYS.target]: next });
  syncTarget();
  render();
}

function setKind(next: OutputKind) {
  kind = next;
  void browser.storage.local.set({ [STORAGE_KEYS.outputKind]: kind });
  syncTabs();
  render();
}

let openHelp: HTMLButtonElement | null = null;

function guideFor(help: HTMLButtonElement) {
  return document.querySelector<HTMLElement>(`#${help.dataset.guide}`)!;
}

function setGuide(next: HTMLButtonElement | null) {
  const prev = openHelp;
  if (prev) {
    guideFor(prev).hidden = true;
    prev.classList.remove("on");
    prev.setAttribute("aria-expanded", "false");
  }
  openHelp = next;
  scrim.hidden = !next;
  if (!next) {
    prev?.focus();
    return;
  }
  const guide = guideFor(next);
  const list = guide.querySelector<HTMLElement>(".guide-list")!;
  guide.hidden = false;
  guide.classList.remove("up");
  list.style.maxHeight = "";
  next.classList.add("on");
  next.setAttribute("aria-expanded", "true");

  const anchor = (guide.offsetParent as HTMLElement).getBoundingClientRect();
  const below = window.innerHeight - anchor.bottom - 20;
  const above = anchor.top - 20;
  const up = guide.offsetHeight > below && above > below;
  guide.classList.toggle("up", up);
  list.style.maxHeight = `${
    (up ? above : below) - (guide.offsetHeight - list.offsetHeight)
  }px`;

  const trigger = next.getBoundingClientRect();
  guide.style.setProperty(
    "--caret",
    `${trigger.left + trigger.width / 2 - guide.getBoundingClientRect().left - 4}px`,
  );

  (list.querySelector<HTMLButtonElement>("button") ?? guide).focus();
}

function setPicking(on: boolean) {
  picking = on;
  pick.classList.toggle("on", on);
  pick.textContent = on ? "Listening…" : "Pick element";
  scanBtn.disabled = scanning;
  scanBtn.textContent = scanning ? "Scanning" : "Scan page";
  status.textContent = scanning
    ? "Scanning page"
    : on
      ? "Inspecting"
      : capture
        ? "Captured"
        : scan
          ? "Scanned"
          : "Idle";
  status.className = `kicker ${on || scanning ? "live" : "idle"}`;
}

function withPrefs(result: CaptureResult): CaptureResult {
  return {
    ...result,
    intent: intent.value,
    target: target.value as Target,
    job,
    direction: job,
  };
}

function renderScan() {
  if (!scan) {
    scanReport.hidden = true;
    return;
  }
  scanReport.hidden = false;

  const host = sourceHost(scan.url);
  const counted = typeof scan.elements === "number"
    ? scan.elements >= WALK_LIMIT ? `${WALK_LIMIT}+` : `${scan.elements}`
    : "unknown";
  scanSource.textContent = [
    host,
    `${counted} visible elements`,
    `${scan.viewport.width}×${scan.viewport.height} viewport`,
    new Date(scan.scannedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  ].join(" · ");

  const visualChips = (scan.visualColors ?? [])
    .map(
      (c) =>
        `<button type="button" class="chip" data-hex="${c.value}" title="Copy ${c.value}">
          <i style="background:${c.value}"></i>
          <span>visual</span>
          <code>${c.value}</code>
        </button>`,
    )
    .join("");
  const chips = scan.colors
    .map(
      (c) =>
        `<button type="button" class="chip" data-hex="${c.value}" title="Copy ${c.value}">
          <i style="background:${c.value}"></i>
          <span>${c.role}</span>
          <code>${c.value}</code>
        </button>`,
    )
    .join("");
  const fonts = scan.fonts
    .map((f) =>
      esc(
        [f.family, f.weights.join("/"), f.sizes.join(" / ")]
          .filter(Boolean)
          .join(" · "),
      ),
    )
    .join("<br>");
  const vars = scan.cssVariables
    .slice(0, 6)
    .map((v) => esc(`${v.name}: ${v.value}`))
    .join("<br>");

  const stackGroups = stackByKind(scan);
  const hasMotionLibrary = stackGroups.some((group) => group.kind === "motion");
  const measuredMotion = capture?.motion.effects ?? [];
  const nativeMotion = [
    measuredMotion.some((effect) => effect.type === "css-animation")
      ? "CSS animation"
      : "",
    measuredMotion.some((effect) => effect.type === "transition")
      ? "CSS transition"
      : "",
    measuredMotion.some((effect) => effect.type === "web-animation")
      ? "Web Animations API"
      : "",
  ].filter(Boolean);

  scanRows.innerHTML = [
    row(
      `Visible palette · ${scan.visualColors?.length ?? 0}`,
      visualChips ? `<div class="scan-colors">${visualChips}</div>` : "",
      "screenshot sampling unavailable",
    ),
    row(
      `CSS palette · ${scan.colors.length}`,
      chips ? `<div class="scan-colors">${chips}</div>` : "",
      "no colors read",
    ),
    row(`Type · ${scan.fonts.length}`, fonts, "no web fonts, system stack only"),
    row("Space", esc(scan.spacing.join(" · ")), "no repeating spacing"),
    row("Radius", esc(scan.radii.join(" · ")), "square corners"),
    row("Shadow", scan.shadows.map(esc).join("<br>"), "no repeating shadows"),
    row(":root vars", vars, "none exposed"),
    ...stackGroups.map((group) =>
      row(group.label, esc(group.names.join(", ")), ""),
    ),
    !hasMotionLibrary && nativeMotion.length
      ? row("Motion", esc(`${nativeMotion.join(", ")} · selected element`), "")
      : "",
    scan.detected.length
      ? ""
      : row("Stack", "", "nothing matched in scripts, DOM, CSS, or globals"),
  ]
    .filter(Boolean)
    .join("");
}

function row(label: string, value: string, empty: string) {
  const body = value || `<em>${empty}</em>`;
  return `<div class="stack-row"><span>${label}</span><p>${body}</p></div>`;
}

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function render() {
  setPicking(picking);
  renderScan();
  if (!capture) {
    summary.hidden = true;
    if (openHelp?.closest("#summary")) setGuide(null);
    out.textContent = scan
      ? "Scan is the wide shot. Pick a component, click to lock it, and its spec lands here."
      : "Pick reads one element. Scan page reads the whole site. Click locks what you hover.";
    return;
  }

  summary.hidden = false;
  const tokens = capture.tokens;
  const shownColors = tokens.visualColors?.length
    ? tokens.visualColors.map((color) => ({
        value: color.value,
        roles: ["visible pixel"],
      }))
    : tokens.colors;
  const motionCount = capture.motion.effects?.length ??
    capture.motion.transitions.length + capture.motion.animations.length;
  const motionLibraries = (capture.motion.libraries ?? []).map((lib) => lib.name);
  sumTitle.textContent = `${capture.node.tag} · ${capture.node.box.width}×${capture.node.box.height}`;
  sumMeta.textContent = [
    sourceHost(capture.url),
    tokens.fonts[0]?.family ?? "type",
    motionCount ? `${motionCount} motion effect${motionCount === 1 ? "" : "s"}` : "no motion measured",
    motionLibraries.length ? motionLibraries.join(", ") : "",
  ].filter(Boolean).join(" · ") + " · ";
  sumColors.hidden = shownColors.length === 0;
  sumColors.textContent = `${shownColors.length} ${tokens.visualColors?.length ? "visible" : "CSS"} colors`;
  swatches.innerHTML = shownColors
    .slice(0, 8)
    .map(
      (c) =>
        `<i title="${c.value} · ${c.roles.join(", ")}" style="background:${c.value}"></i>`,
    )
    .join("");
  colorsGuideList.innerHTML = shownColors
    .map(
      (c) =>
        `<button type="button" class="guide-row color-row" data-hex="${c.value}">
          <i style="background:${c.value}"></i>
          <code>${c.value}</code>
          <small>${c.roles.join(", ")}</small>
        </button>`,
    )
    .join("");

  out.textContent = renderOutput(kind, withPrefs(capture), scan);
}

async function sendToTab(type: string) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    return (await browser.tabs.sendMessage(tab.id, { type })) ?? true;
  } catch {
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["/content-scripts/content.js"],
      });
      return (await browser.tabs.sendMessage(tab.id, { type })) ?? true;
    } catch {
      return null;
    }
  }
}

/** Content scripts never load on browser-owned pages, and never in tabs opened before install. */
async function scanFailure() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const blocked = /^(chrome|brave|edge|about|devtools|view-source|chrome-extension|moz-extension):/.test(url);
  if (!url || blocked) return "Browser page — open a website first";
  if (/^file:/.test(url)) return "Local file — allow file access in extension settings";
  if (/\.pdf($|\?)/i.test(url)) return "PDF viewer — extensions can't read it";
  return "Refresh the page, then scan";
}

async function flash(button: HTMLButtonElement, label = "Copied") {
  const prev = button.textContent;
  button.textContent = label;
  setTimeout(() => {
    button.textContent = prev;
  }, 900);
}

pick.addEventListener("click", () => {
  void sendToTab("toggle-picker");
});

scanBtn.addEventListener("click", async () => {
  if (scanning) return;
  scanning = true;
  render();
  const result = await sendToTab("scan-page");
  scanning = false;
  if (!result) {
    render();
    status.textContent = await scanFailure();
    return;
  }
  if (typeof result === "object" && "error" in result) {
    render();
    status.textContent = "Scan crashed — check the page console";
    console.error("[design-capture] scan failed:", (result as { error: string }).error);
    return;
  }
  if (typeof result === "object") scan = result as PageScan;
  render();
});

copy.addEventListener("click", async () => {
  const text =
    capture
      ? (out.textContent ?? "")
      : scan
        ? toScanMd(scan)
        : (out.textContent ?? "");
  await navigator.clipboard.writeText(text);
  void flash(copy);
});

copyScan.addEventListener("click", async () => {
  if (!scan) return;
  await navigator.clipboard.writeText(toScanMd(scan));
  void flash(copyScan);
});

scanRows.addEventListener("click", async (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLElement>(".chip");
  const hex = chip?.dataset.hex;
  if (!hex) return;
  await navigator.clipboard.writeText(hex);
  chip.classList.add("copied");
  setTimeout(() => chip.classList.remove("copied"), 700);
});

intent.addEventListener("input", () => {
  void browser.storage.local.set({ [STORAGE_KEYS.intent]: intent.value });
  render();
});

target.addEventListener("change", () => {
  setTarget(target.value as Target);
});

jobs.addEventListener("change", () => {
  setJob(jobs.value as Job);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openHelp) setGuide(null);
});

document.addEventListener("click", (event) => {
  const el = event.target as HTMLElement;
  const help = el.closest<HTMLButtonElement>("[data-guide]");
  if (help) {
    setGuide(openHelp === help ? null : help);
    return;
  }
  if (el.closest(".guide-x")) {
    setGuide(null);
    return;
  }
  const color = el.closest<HTMLButtonElement>(".color-row");
  if (color?.dataset.hex) {
    void navigator.clipboard.writeText(color.dataset.hex);
    color.classList.add("copied");
    setTimeout(() => color.classList.remove("copied"), 700);
    return;
  }
  const row = el.closest<HTMLButtonElement>("button.guide-row");
  if (row?.dataset.job) setJob(row.dataset.job as Job);
  if (row?.dataset.target) setTarget(row.dataset.target as Target);
  if (row?.dataset.kind) setKind(row.dataset.kind as OutputKind);
  if (row || (openHelp && !el.closest(".guide"))) setGuide(null);
});

tabs.addEventListener("change", () => {
  setKind(tabs.value as OutputKind);
});

captureSetup.addEventListener("toggle", () => {
  if (!captureSetup.open && openHelp?.closest("#capture-setup")) setGuide(null);
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.lastCapture) {
    const next = changes.lastCapture.newValue as CaptureResult | undefined;
    if (next && belongsToCurrentPage(next)) capture = next;
  }
  if (changes.lastScan) {
    const next = changes.lastScan.newValue as PageScan | undefined;
    if (next && belongsToCurrentPage(next)) scan = next;
  }
  if (changes.pickerActive) picking = Boolean(changes.pickerActive.newValue);
  render();
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  void switchPage(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== currentTabId || !tab.active) return;
  if (changeInfo.url) void switchPage(tabId, changeInfo.url);
});

void restore();
