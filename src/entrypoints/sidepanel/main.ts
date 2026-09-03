import { JOBS } from "../../lib/jobs";
import { OUTPUTS } from "../../lib/outputs";
import { renderOutput } from "../../lib/prompt";
import { TARGETS } from "../../lib/targets";
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
const jobs = document.querySelector<HTMLElement>("#jobs")!;
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
const tabs = document.querySelector<HTMLElement>("#tabs")!;
const status = document.querySelector<HTMLElement>("#status")!;
const summary = document.querySelector<HTMLElement>("#summary")!;
const sumTitle = document.querySelector<HTMLElement>("#sum-title")!;
const sumMeta = document.querySelector<HTMLElement>("#sum-meta")!;
const swatches = document.querySelector<HTMLElement>("#swatches")!;
const scanReport = document.querySelector<HTMLElement>("#scan-report")!;
const scanColors = document.querySelector<HTMLElement>("#scan-colors")!;
const scanType = document.querySelector<HTMLElement>("#scan-type")!;
const scanSpace = document.querySelector<HTMLElement>("#scan-space")!;
const scanStack = document.querySelector<HTMLElement>("#scan-stack")!;
const scanVars = document.querySelector<HTMLElement>("#scan-vars")!;

let kind: OutputKind = "photocopy";
let job: Job = "rebuild";
let capture: CaptureResult | null = null;
let scan: PageScan | null = null;
let picking = false;

target.innerHTML = TARGETS.map(
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

async function restore() {
  const stored = await browser.storage.local.get([
    STORAGE_KEYS.lastCapture,
    STORAGE_KEYS.lastScan,
    STORAGE_KEYS.intent,
    STORAGE_KEYS.target,
    STORAGE_KEYS.job,
    STORAGE_KEYS.direction,
    STORAGE_KEYS.pickerActive,
    STORAGE_KEYS.outputKind,
  ]);
  if (typeof stored.intent === "string") intent.value = stored.intent;
  if (stored.target) target.value = stored.target as string;
  if (stored.job) job = stored.job as Job;
  else if (stored.direction) job = stored.direction as Job;
  if (stored.outputKind) kind = stored.outputKind as OutputKind;
  picking = Boolean(stored.pickerActive);
  if (stored.lastCapture) capture = stored.lastCapture as CaptureResult;
  if (stored.lastScan) scan = stored.lastScan as PageScan;
  syncTabs();
  syncJobs();
  syncTarget();
  render();
}

function syncTabs() {
  const buttons = [
    ...tabs.querySelectorAll("button"),
    ...outputGuideList.querySelectorAll("button"),
  ];
  for (const child of buttons) {
    child.classList.toggle("on", child.dataset.kind === kind);
  }
}

function syncJobs() {
  const buttons = [
    ...jobs.querySelectorAll("button"),
    ...jobGuideList.querySelectorAll("button"),
  ];
  for (const child of buttons) {
    child.classList.toggle("on", child.dataset.job === job);
  }
}

function syncTarget() {
  for (const child of targetGuideList.querySelectorAll("button")) {
    child.classList.toggle("on", child.dataset.target === target.value);
  }
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
  pick.textContent = on ? "Listening" : "Pick";
  status.textContent = on
    ? "Inspecting"
    : capture
      ? "Captured"
      : scan
        ? "Scanned"
        : "Idle";
  status.className = `kicker ${on ? "live" : "idle"}`;
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
  scanColors.innerHTML = scan.colors
    .map(
      (c) =>
        `<button type="button" class="chip" data-hex="${c.value}" title="${c.role} ${c.value}">
          <i style="background:${c.value}"></i>
          <span>${c.role}</span>
          <code>${c.value}</code>
        </button>`,
    )
    .join("");
  scanType.textContent = scan.fonts.length
    ? scan.fonts
        .map((f) => {
          const ramp = [f.family, f.weights.join("/"), f.sizes.join(" / ")]
            .filter(Boolean)
            .join(" · ");
          return ramp;
        })
        .join("  ·  ")
    : "";
  const tokens = [
    scan.spacing.length ? `Space ${scan.spacing.join(" ")}` : "",
    scan.radii.length ? `Radius ${scan.radii.join(" ")}` : "",
  ].filter(Boolean);
  scanSpace.textContent = tokens.join("  ·  ");
  const groups = stackByKind(scan);
  scanStack.innerHTML = groups.length
    ? groups
        .map(
          (group) =>
            `<div class="stack-row"><span>${group.label}</span><p>${group.names.join(", ")}</p></div>`,
        )
        .join("")
    : `<div class="stack-row"><span>Stack</span><p>None detected from scripts, DOM, CSS, or globals</p></div>`;
  if (scan.cssVariables.length) {
    scanVars.hidden = false;
    scanVars.textContent = scan.cssVariables
      .slice(0, 6)
      .map((v) => `${v.name}: ${v.value}`)
      .join("  ·  ");
  } else {
    scanVars.hidden = true;
  }
}

function render() {
  setPicking(picking);
  renderScan();
  if (!capture) {
    summary.hidden = true;
    out.textContent = scan
      ? "Scan is the wide shot. Pick a component when you want a photocopy."
      : "Hover is one node. Scan page is the site. Click copies the selected output.";
    return;
  }

  summary.hidden = false;
  const tokens = capture.tokens;
  sumTitle.textContent = `${capture.node.tag} · ${capture.node.box.width}×${capture.node.box.height}`;
  sumMeta.textContent = `${capture.title} · ${tokens.fonts[0]?.family ?? "type"} · ${tokens.colors.length} colors`;
  swatches.innerHTML = tokens.colors
    .slice(0, 8)
    .map(
      (c) =>
        `<i title="${c.value} · ${c.roles.join(", ")}" style="background:${c.value}"></i>`,
    )
    .join("");

  out.textContent = renderOutput(kind, withPrefs(capture), scan);
}

async function sendToTab(type: string) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return false;
  try {
    await browser.tabs.sendMessage(tab.id, { type });
    return true;
  } catch {
    return false;
  }
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
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning";
  const ok = await sendToTab("scan-page");
  if (!ok) {
    status.textContent = "Can't scan this page";
    scanBtn.textContent = "Scan page";
    scanBtn.disabled = false;
    return;
  }
  setTimeout(() => {
    scanBtn.textContent = "Scan page";
    scanBtn.disabled = false;
  }, 600);
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

scanColors.addEventListener("click", async (event) => {
  const chip = (event.target as HTMLElement).closest("button");
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

jobs.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.job) return;
  setJob(button.dataset.job as Job);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openHelp) setGuide(null);
});

document.addEventListener("click", (event) => {
  const el = event.target as HTMLElement;
  const help = el.closest<HTMLButtonElement>(".help");
  if (help) {
    setGuide(openHelp === help ? null : help);
    return;
  }
  if (el.closest(".guide-x")) {
    setGuide(null);
    return;
  }
  const row = el.closest<HTMLButtonElement>("button.guide-row");
  if (row?.dataset.job) setJob(row.dataset.job as Job);
  if (row?.dataset.target) setTarget(row.dataset.target as Target);
  if (row?.dataset.kind) setKind(row.dataset.kind as OutputKind);
  if (row || (openHelp && !el.closest(".guide"))) setGuide(null);
});

tabs.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.kind) return;
  setKind(button.dataset.kind as OutputKind);
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.lastCapture) {
    capture = (changes.lastCapture.newValue as CaptureResult) ?? null;
  }
  if (changes.lastScan) {
    scan = (changes.lastScan.newValue as PageScan) ?? null;
  }
  if (changes.pickerActive) picking = Boolean(changes.pickerActive.newValue);
  render();
});

void restore();
