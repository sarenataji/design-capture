import { createPicker } from "../lib/picker";
import { renderOutput } from "../lib/prompt";
import { STORAGE_KEYS } from "../lib/storage";
import type { Direction, Target } from "../lib/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    let target: Target = "auto";
    let intent = "";
    let direction: Direction = "rebuild";

    void browser.storage.local.get([
      STORAGE_KEYS.target,
      STORAGE_KEYS.intent,
      STORAGE_KEYS.direction,
    ]).then((stored) => {
      if (stored.target) target = stored.target as Target;
      if (typeof stored.intent === "string") intent = stored.intent;
      if (stored.direction) direction = stored.direction as Direction;
    });

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.target?.newValue) target = changes.target.newValue as Target;
      if (typeof changes.intent?.newValue === "string") {
        intent = changes.intent.newValue;
      }
      if (changes.direction?.newValue) {
        direction = changes.direction.newValue as Direction;
      }
    });

    const picker = createPicker({
      getTarget: () => target,
      getIntent: () => intent,
      getDirection: () => direction,
      onCapture: (result) => {
        const prompt = renderOutput("prompt", result);
        void navigator.clipboard.writeText(prompt).catch(() => {});
        void browser.runtime.sendMessage({ type: "save-capture", payload: result });
      },
    });

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === "toggle-picker") picker.toggle();
      if (message?.type === "start-picker") picker.start();
      if (message?.type === "stop-picker") picker.stop();
    });
  },
});
