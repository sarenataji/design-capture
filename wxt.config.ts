import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "Design Capture",
    description:
      "Inspect on hover. Photocopy a component. Prompt with a job so the model does not clone the site.",
    version: "0.3.0",
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
