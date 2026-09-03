# Design Capture

A Chrome / Brave extension. Hover any element, capture computed design, and copy an AI-ready prompt, `DESIGN.md`, `SKILL.md`, CSS, or Tailwind.

Local-first. No account. Capture runs in the page; nothing is uploaded.

## Stack

- **WXT** — Manifest V3, Vite, typed extension APIs
- **TypeScript** — capture engine in `src/lib`
- **Shadow DOM overlay** — picker does not inherit host CSS
- **chrome.storage.local** — last capture, intent, and output prefs

## Develop

```bash
cd design-capture
pnpm install
pnpm dev
```

Load unpacked from `.output/chrome-mv3` if the browser is not opened for you.

Production:

```bash
pnpm build
```

Then Chrome or Brave → `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.

## Use

1. Click the toolbar icon or press **Alt+Shift+D**.
2. Write **Intent** first so the prompt is shaped for your product, not a clone of the source site.
3. Hover. Tooltip shows tag, size, font, color, radius.
4. **↑** parent, **↓** child, **click** or **Enter** to capture. **Esc** stops.
5. The prompt is copied. The side panel also has DESIGN.md, SKILL.md, CSS, and Tailwind.

## Outputs

- **Prompt** — structure, rest/hover/focus, motion, tokens, constraints
- **DESIGN.md** — palette, type, spacing, radius, shadow, CSS variables
- **SKILL.md** — drop into an agent skills folder
- **CSS** — `:root` + component + hover
- **Tailwind** — utilities plus exact CSS fallback
