# Design Capture

A Chrome / Brave extension. Hover any element for **measured** facts. Click to capture **that component only**. Scan the page when you want the system.

Local. No account. Nothing uploaded.

## Two scales

- **Hover** — one thing under the cursor. Instant. No AI.
- **Site scan** — once per page, when you ask. Walks the live document. No crawling, no AI.

Scan is a separate action. Turn the picker on for components; hit **Scan page** for the system.

## Beats

1. **Inspect** — hover. Tooltip with tag, size, type, color, radius, padding/gap, selector.
2. **Photocopy** — click. Exact spec for that component, including descendant CSS/WAAPI motion, triggers, timing, easing, properties, keyframes, and detected motion libraries.
3. **Prompt** — photocopy + Job / Intent. Includes the scan if you ran one.
4. **Scan page** — palette, type, spacing/radius ladder, detected stack.

## Use

1. `pnpm dev`, load unpacked from `.output/chrome-mv3`, or **Alt+Shift+D**.
2. Hover — read the font and facts.
3. **↑** parent, **↓** child. Not `<body>`, not a single letter unless that’s the point.
4. Optionally leave the pointer on a real `:hover`, then click.
5. **Scan page** when you want palette / type / tokens / stack for the site.
6. Pick **Photocopy** if you want that piece exact.
7. Pick **Prompt** if it’s going into a project: set Job + Intent first.
8. Paste. One pattern, not the whole website. Scan feeds Prompt/System without replacing the component.

Job is five buttons (default **Rebuild**). Keep / replace / done-when are canned. Only Job, Intent, and Target change.

## Stack (researched 2026)

| Layer | Choice | Why |
| --- | --- | --- |
| Extension framework | **WXT** (Vite, MV3) | Default for new extensions in 2026. Faster than Plasmo, more than CRXJS, file-based entrypoints. Plasmo is in maintenance mode. |
| UI | **Vanilla TypeScript** | Side panel is a form. React/Vue would ship a runtime into every content script for no gain. |
| Picker overlay | **Shadow DOM** | Host CSS cannot restyle the tooltip. Overlay is `pointer-events: none` so native `:hover` still applies. |
| Measurement | **`getComputedStyle` + CSSOM** | Rest styles after a 2-frame pointer shield (so click-hover doesn’t contaminate rest). `:hover`/`:focus`/`:active` also read from stylesheets. No `chrome.debugger` (that banner is not “local inspect”). |
| Color | **Local parser** (`src/lib/color.ts`) | Tailwind v4 and modern CSS return `oklch()` / space-separated `rgb()`. A hex-only regex drops most palettes. No culori/colorjs.io in the bundle. |
| Tokens | **Walk computed styles** | Component on hover-capture; page ladder on Scan. |
| Stack | **Scripts, DOM, CSS, class names** | Detected only. No Figma/Photoshop. Isolated world — no page-JS heap. |
| Persistence | **`chrome.storage.local`** | Last capture, Job, Intent, target, output tab. |
| Panel | **`chrome.sidePanel`** | Job + Intent stay visible while you pick. Popups close on click. |

Not used, on purpose: Plasmo, React, html2canvas, `chrome.debugger`, accounts, uploads.

## Outputs

| Action | You get |
| --- | --- |
| Hover | This node’s facts |
| Photocopy | This component’s spec, screenshot-sampled visible palette, CSS colors, motion effects, keyframes, and library evidence |
| Prompt | That spec + job/intent (+ scan if present) |
| Scan page | Palette, type, tokens, detected stack |
| DESIGN.md / SKILL.md | System file; prefers scan when you ran one |

## Develop

```bash
pnpm install
pnpm dev
```

Load unpacked from `.output/chrome-mv3` if the browser is not opened for you.

```bash
pnpm build
```

Chrome or Brave → `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.
