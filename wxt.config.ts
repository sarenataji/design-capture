import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "Design Capture",
    description:
      "Hover any element, capture computed design, states, motion, and tokens, then copy an AI prompt, DESIGN.md, or Tailwind.",
    version: "0.2.0",
    permissions: ["storage", "sidePanel", "activeTab", "scripting"],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "Design Capture",
    },
    commands: {
      "toggle-picker": {
        suggested_key: {
          default: "Alt+Shift+D",
          mac: "Alt+Shift+D",
        },
        description: "Toggle the element picker",
      },
    },
  },
});
