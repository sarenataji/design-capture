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
  SavedScan,
  ScanFolder,
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
const sumMeta = document.querySelector<HTMLElement>("#sum-meta")!;
const sumSize = document.querySelector<HTMLElement>("#sum-size")!;
const sumPosition = document.querySelector<HTMLElement>("#sum-position")!;
const sumLayout = document.querySelector<HTMLElement>("#sum-layout")!;
const sumFontCount = document.querySelector<HTMLElement>("#sum-font-count")!;
const sumTypography = document.querySelector<HTMLElement>("#sum-typography")!;
const sumDeclaredFonts = document.querySelector<HTMLElement>("#sum-declared-fonts")!;
const sumFontList = document.querySelector<HTMLElement>("#sum-font-list")!;
const sumColorCount = document.querySelector<HTMLElement>("#sum-color-count")!;
const sumVisibleColors = document.querySelector<HTMLElement>("#sum-visible-colors")!;
const sumCssColors = document.querySelector<HTMLElement>("#sum-css-colors")!;
const sumMotionBadge = document.querySelector<HTMLElement>("#sum-motion-badge")!;
const sumMotionTitle = document.querySelector<HTMLElement>("#sum-motion-title")!;
const sumMotionDetail = document.querySelector<HTMLElement>("#sum-motion-detail")!;
const sumMotionEffects = document.querySelector<HTMLElement>("#sum-motion-effects")!;
const sumLibrariesSection = document.querySelector<HTMLElement>("#sum-libraries-section")!;
const sumLibraries = document.querySelector<HTMLElement>("#sum-libraries")!;
const sumStates = document.querySelector<HTMLElement>("#sum-states")!;
const scanReport = document.querySelector<HTMLDetailsElement>("#scan-report")!;
const scanSource = document.querySelector<HTMLElement>("#scan-source")!;
const scanRows = document.querySelector<HTMLElement>("#scan-rows")!;
const captureSetup = document.querySelector<HTMLDetailsElement>("#capture-setup")!;
const setupSummary = document.querySelector<HTMLElement>("#setup-summary")!;
const libraryToggle = document.querySelector<HTMLButtonElement>("#library-toggle")!;
const viewTitle = document.querySelector<HTMLElement>("#view-title")!;
const newFolder = document.querySelector<HTMLButtonElement>("#new-folder")!;
const folderCreate = document.querySelector<HTMLElement>("#folder-create")!;
const folderName = document.querySelector<HTMLInputElement>("#folder-name")!;
const addFolder = document.querySelector<HTMLButtonElement>("#add-folder")!;
const cancelFolder = document.querySelector<HTMLButtonElement>("#cancel-folder")!;
const scanFolder = document.querySelector<HTMLSelectElement>("#scan-folder")!;
const saveScan = document.querySelector<HTMLButtonElement>("#save-scan")!;
const savedScans = document.querySelector<HTMLElement>("#saved-scans")!;

const FAVORITES_FOLDER: ScanFolder = {
  id: "favorites",
  name: "Favorites",
  createdAt: "",
};

let kind: OutputKind = "photocopy";
let job: Job = "rebuild";
let capture: CaptureResult | null = null;
let scan: PageScan | null = null;
let picking = false;
let scanning = false;
let currentTabId: number | null = null;
let currentPageUrl = "";
let scanFolders: ScanFolder[] = [FAVORITES_FOLDER];
let savedScanItems: SavedScan[] = [];
let selectedFolderId = FAVORITES_FOLDER.id;
let showingLibrary = false;

const folderIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3.5 6.5h6l2 2h9v10h-17z"></path>
  </svg>`;
const backIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 5l-7 7 7 7"></path>
  </svg>`;

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
    STORAGE_KEYS.scanFolders,
    STORAGE_KEYS.savedScans,
    ]),
    readCurrentTab(),
  ]);
  if (typeof stored.intent === "string") intent.value = stored.intent;
  if (stored.target) target.value = stored.target as string;
  if (stored.job) job = stored.job as Job;
  else if (stored.direction) job = stored.direction as Job;
  if (stored.outputKind) kind = stored.outputKind as OutputKind;
  const storedFolders = Array.isArray(stored.scanFolders)
    ? stored.scanFolders as ScanFolder[]
    : [];
  scanFolders = [FAVORITES_FOLDER, ...storedFolders.filter((folder) => folder.id !== FAVORITES_FOLDER.id)];
  savedScanItems = Array.isArray(stored.savedScans)
    ? stored.savedScans as SavedScan[]
    : [];
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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function capturedAttributes(html: string) {
  const element = new DOMParser()
    .parseFromString(html, "text/html")
    .body.firstElementChild;
  const values = new Map<string, string>();
  for (const attribute of Array.from(element?.attributes ?? [])) {
    values.set(attribute.name.toLowerCase(), attribute.value.trim());
  }
  const first = (...names: string[]) => {
    for (const name of names) {
      const value = values.get(name);
      if (value) return value;
    }
    return "";
  };
  const fontList = first("fonts", "data-fonts", "font-list", "data-font-list")
    .split(/[,|]/)
    .map((font) => font.trim())
    .filter(Boolean);
  return {
    fontList: [...new Set(fontList)],
    currentFont: first("font", "data-font", "current-font", "data-current-font"),
    autoplay: ["autoplay", "data-autoplay"].some((name) => values.has(name)),
    interval: first("autoplay-interval", "data-autoplay-interval", "interval", "data-interval"),
  };
}

function fact(label: string, value: string, detail = "") {
  return `<div class="fact-row">
    <span>${esc(label)}</span>
    <div><strong>${esc(value)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</div>
  </div>`;
}

function isUsefulLayoutValue(value: string | undefined) {
  return Boolean(value && !["none", "normal", "static", "0px", "0px 0px", "auto"].includes(value));
}

function colorGroup(
  label: string,
  colors: { value: string; role?: string; roles?: string[] }[],
) {
  if (!colors.length) return "";
  return `<p class="color-label">${esc(label)}</p>
    <div class="inspector-colors">
      ${colors.slice(0, 12).map((color) => {
        const roles = color.roles?.join(", ") || color.role || "color";
        return `<button type="button" class="inspector-color" data-hex="${esc(color.value)}" title="Copy ${esc(color.value)} · ${esc(roles)}">
          <i style="background:${esc(color.value)}"></i>
          <code>${esc(color.value)}</code>
          <small>${esc(roles)}</small>
        </button>`;
      }).join("")}
    </div>`;
}

function effectName(type: string) {
  if (type === "css-animation") return "CSS animation";
  if (type === "web-animation") return "Web Animations API";
  return "CSS transition";
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function formatSavedDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function setLibraryView(show: boolean) {
  showingLibrary = show;
  document.body.classList.toggle("library-mode", show);
  libraryToggle.setAttribute("aria-pressed", String(show));
  libraryToggle.setAttribute("aria-label", show ? "Back to capture" : "Open saved scans");
  libraryToggle.title = show ? "Back to capture" : "Saved scans";
  libraryToggle.innerHTML = show ? backIcon : folderIcon;
  viewTitle.textContent = show ? "Saved scans" : "Design Capture";
  if (show) {
    status.textContent = "Library";
    status.className = "kicker idle";
    renderLibrary();
  } else {
    render();
  }
}

function renderLibrary() {
  scanFolder.innerHTML = scanFolders
    .map((folder) => `<option value="${esc(folder.id)}">${esc(folder.name)}</option>`)
    .join("");
  if (!scanFolders.some((folder) => folder.id === selectedFolderId)) {
    selectedFolderId = FAVORITES_FOLDER.id;
  }
  scanFolder.value = selectedFolderId;
  saveScan.disabled = !scan;

  const items = savedScanItems
    .filter((item) => item.folderId === selectedFolderId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  savedScans.innerHTML = items.length
    ? items.map((item) => `
      <div class="saved-row">
        <button type="button" class="saved-open" data-saved-id="${esc(item.id)}">
          <strong>${esc(item.scan.title || sourceHost(item.scan.url))}</strong>
          <small>${esc(sourceHost(item.scan.url))} · ${formatSavedDate(item.savedAt)}</small>
        </button>
        <button type="button" class="saved-remove" data-remove-id="${esc(item.id)}" aria-label="Remove saved scan">×</button>
      </div>`).join("")
    : `<p class="saved-empty">No scans in this folder yet.</p>`;
}

function render() {
  if (showingLibrary) {
    renderLibrary();
    return;
  }
  setPicking(picking);
  renderScan();
  renderLibrary();
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
  const attributes = capturedAttributes(capture.html);
  const effects = capture.motion.effects ?? [];
  const motionLibraries = capture.motion.libraries ?? [];
  const hasDeclaredRotation = attributes.fontList.length > 1 && attributes.autoplay;

  sumTitle.textContent = capture.node.tag;
  sumMeta.innerHTML = `<span>${esc(sourceHost(capture.url))}</span><code title="${esc(capture.selector)}">${esc(capture.selector)}</code>`;
  sumSize.textContent = `${capture.node.box.width} × ${capture.node.box.height} px`;
  sumPosition.textContent = `x ${capture.node.box.x} · y ${capture.node.box.y}`;

  const layoutFacts: [string, string | undefined][] = [
    ["Display", capture.node.styles.display],
    ["Positioning", capture.node.styles.position],
    ["Padding", capture.node.styles.padding],
    ["Gap", capture.node.styles.gap],
    ["Radius", tokens.radii[0] ?? capture.node.styles["border-radius"]],
    ["Shadow", tokens.shadows[0]],
  ];
  sumLayout.innerHTML = layoutFacts
    .filter(([, value]) => isUsefulLayoutValue(value))
    .map(([label, value]) => fact(label, value!))
    .join("");
  sumLayout.hidden = !sumLayout.innerHTML;

  const typography = tokens.fonts.length
    ? tokens.fonts.map((font, index) => fact(
        index === 0 ? "Rendered family" : "Additional family",
        font.family,
        [
          font.weights.length ? `weight ${font.weights.join(" / ")}` : "",
          font.sizes.length ? font.sizes.join(" / ") : "",
        ].filter(Boolean).join(" · "),
      )).join("")
    : fact(
        "Rendered family",
        capture.node.styles["font-family"] ?? "Not exposed",
        [capture.node.styles["font-weight"], capture.node.styles["font-size"]]
          .filter(Boolean)
          .join(" · "),
      );
  sumTypography.innerHTML = typography + (attributes.currentFont
    ? fact("Current rotation value", attributes.currentFont)
    : "");
  sumFontCount.textContent = attributes.fontList.length
    ? `${attributes.fontList.length} declared · ${tokens.fonts.length || 1} rendered`
    : `${tokens.fonts.length || 1} rendered`;
  sumDeclaredFonts.hidden = attributes.fontList.length === 0;
  sumFontList.innerHTML = attributes.fontList
    .map((font) => `<span>${esc(font)}</span>`)
    .join("");

  const visibleColors = (tokens.visualColors ?? []).map((color) => ({
    value: color.value,
    role: "visible pixel",
  }));
  sumVisibleColors.innerHTML = colorGroup("Visible in the selection", visibleColors);
  sumVisibleColors.hidden = visibleColors.length === 0;
  sumCssColors.innerHTML = colorGroup("CSS values", tokens.colors);
  sumCssColors.hidden = tokens.colors.length === 0;
  sumColorCount.textContent = [
    visibleColors.length ? `${visibleColors.length} visible` : "",
    tokens.colors.length ? `${tokens.colors.length} CSS` : "",
  ].filter(Boolean).join(" · ") || "None found";

  const interval = attributes.interval
    ? `${attributes.interval}${/^\d+(?:\.\d+)?$/.test(attributes.interval) ? " seconds" : ""}`
    : "an unspecified interval";
  const hasElementMotion = effects.length > 0;
  sumMotionBadge.classList.toggle("found", hasElementMotion || hasDeclaredRotation);
  sumMotionBadge.textContent = hasElementMotion || hasDeclaredRotation ? "Found" : "Not measured";
  if (hasDeclaredRotation && hasElementMotion) {
    sumMotionTitle.textContent = "Font rotation and measurable motion found";
    sumMotionDetail.textContent = `This element declares autoplay across ${attributes.fontList.length} fonts every ${interval}. ${effects.length} active effect${effects.length === 1 ? " was" : "s were"} also measurable at selection time.`;
  } else if (hasDeclaredRotation) {
    sumMotionTitle.textContent = "Font rotation declared by this element";
    sumMotionDetail.textContent = `Autoplay cycles through ${attributes.fontList.length} declared fonts every ${interval}. The custom element exposed this behavior in its attributes, although no CSS or Web Animations API effect was measurable at selection time.`;
  } else if (hasElementMotion) {
    sumMotionTitle.textContent = `${effects.length} motion effect${effects.length === 1 ? "" : "s"} measured on this element`;
    sumMotionDetail.textContent = "These effects were active or declared on the selection when it was captured.";
  } else {
    sumMotionTitle.textContent = "No motion effect exposed on this element";
    sumMotionDetail.textContent = "No CSS transition, CSS animation, or active Web Animations API effect was measurable at selection time.";
  }
  sumMotionEffects.innerHTML = effects.slice(0, 8).map((effect) => [
    fact(
      effectName(effect.type),
      effect.properties.join(", ") || "Keyframed properties",
      `${effect.trigger} · ${effect.duration} · ${effect.easing}`,
    ),
    effect.library
      ? fact(
          "Library / engine",
          effect.library.name,
          `${effect.library.confidence} confidence · ${effect.library.evidence}`,
        )
      : "",
  ].join("")).join("");
  sumMotionEffects.hidden = effects.length === 0;

  sumLibrariesSection.hidden = motionLibraries.length === 0;
  sumLibraries.innerHTML = motionLibraries.map((library) =>
    `<span><strong>${esc(library.name)}</strong><small>via ${esc(library.via)}</small></span>`,
  ).join("");

  const stateFlags = [
    ["Hover", capture.measured?.hover ?? Object.keys(capture.node.hover).length > 0],
    ["Focus", capture.measured?.focus ?? Object.keys(capture.node.focus).length > 0],
    ["Active", capture.measured?.active ?? Object.keys(capture.node.active).length > 0],
  ] as const;
  sumStates.innerHTML = stateFlags.map(([label, measured]) =>
    `<span class="state-chip ${measured ? "found" : ""}">${esc(label)}<small>${measured ? "captured" : "not measured"}</small></span>`,
  ).join("");

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

newFolder.addEventListener("click", () => {
  folderCreate.hidden = false;
  folderName.focus();
});

libraryToggle.addEventListener("click", () => {
  setLibraryView(!showingLibrary);
});

cancelFolder.addEventListener("click", () => {
  folderCreate.hidden = true;
  folderName.value = "";
});

async function createFolder() {
  const name = folderName.value.trim();
  if (!name) return;
  const folder: ScanFolder = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  };
  scanFolders.push(folder);
  selectedFolderId = folder.id;
  await browser.storage.local.set({ [STORAGE_KEYS.scanFolders]: scanFolders });
  folderName.value = "";
  folderCreate.hidden = true;
  renderLibrary();
}

addFolder.addEventListener("click", () => void createFolder());
folderName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") void createFolder();
  if (event.key === "Escape") cancelFolder.click();
});

scanFolder.addEventListener("change", () => {
  selectedFolderId = scanFolder.value;
  renderLibrary();
});

saveScan.addEventListener("click", async () => {
  if (!scan) return;
  const duplicate = savedScanItems.find(
    (item) => item.folderId === selectedFolderId && pageKey(item.scan.url) === pageKey(scan?.url),
  );
  if (duplicate) {
    duplicate.scan = scan;
    duplicate.savedAt = new Date().toISOString();
  } else {
    savedScanItems.push({
      id: crypto.randomUUID(),
      folderId: selectedFolderId,
      savedAt: new Date().toISOString(),
      scan,
    });
  }
  await browser.storage.local.set({ [STORAGE_KEYS.savedScans]: savedScanItems });
  renderLibrary();
  void flash(saveScan, duplicate ? "Updated" : "Saved");
});

savedScans.addEventListener("click", async (event) => {
  const element = event.target as HTMLElement;
  const remove = element.closest<HTMLButtonElement>("[data-remove-id]");
  if (remove?.dataset.removeId) {
    savedScanItems = savedScanItems.filter((item) => item.id !== remove.dataset.removeId);
    await browser.storage.local.set({ [STORAGE_KEYS.savedScans]: savedScanItems });
    renderLibrary();
    return;
  }
  const open = element.closest<HTMLButtonElement>("[data-saved-id]");
  const item = savedScanItems.find((candidate) => candidate.id === open?.dataset.savedId);
  if (!item) return;
  scan = item.scan;
  setLibraryView(false);
  scanReport.open = true;
  scanReport.scrollIntoView({ behavior: "smooth", block: "start" });
});

scanRows.addEventListener("click", async (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLElement>(".chip");
  const hex = chip?.dataset.hex;
  if (!hex) return;
  await navigator.clipboard.writeText(hex);
  chip.classList.add("copied");
  setTimeout(() => chip.classList.remove("copied"), 700);
});

summary.addEventListener("click", async (event) => {
  const color = (event.target as HTMLElement).closest<HTMLElement>(".inspector-color");
  const hex = color?.dataset.hex;
  if (!hex) return;
  await navigator.clipboard.writeText(hex);
  color.classList.add("copied");
  setTimeout(() => color.classList.remove("copied"), 700);
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
