import { createPicker } from "../lib/picker";
import { scanPage } from "../lib/scan";
import { STORAGE_KEYS } from "../lib/storage";
import type { Job, OutputKind, PageScan, Target } from "../lib/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    let target: Target = "auto";
    let intent = "";
    let job: Job = "rebuild";
    let outputKind: OutputKind = "photocopy";
    let scan: PageScan | null = null;

    void browser.storage.local
      .get([
        STORAGE_KEYS.target,
        STORAGE_KEYS.intent,
        STORAGE_KEYS.job,
        STORAGE_KEYS.direction,
        STORAGE_KEYS.outputKind,
        STORAGE_KEYS.lastScan,
      ])
      .then((stored) => {
        if (stored.target) target = stored.target as Target;
        if (typeof stored.intent === "string") intent = stored.intent;
        if (stored.job) job = stored.job as Job;
        else if (stored.direction) job = stored.direction as Job;
        if (stored.outputKind) outputKind = stored.outputKind as OutputKind;
        if (stored.lastScan) scan = stored.lastScan as PageScan;
      });

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.target?.newValue) target = changes.target.newValue as Target;
      if (typeof changes.intent?.newValue === "string") {
        intent = changes.intent.newValue;
      }
      if (changes.job?.newValue) job = changes.job.newValue as Job;
      else if (changes.direction?.newValue) {
        job = changes.direction.newValue as Job;
      }
      if (changes.outputKind?.newValue) {
        outputKind = changes.outputKind.newValue as OutputKind;
      }
      if (changes.lastScan) {
        scan = (changes.lastScan.newValue as PageScan) ?? null;
      }
    });

    const picker = createPicker({
      getTarget: () => target,
      getIntent: () => intent,
      getJob: () => job,
      getOutputKind: () => outputKind,
      getScan: () => scan,
      onCapture: (result) => {
        void browser.runtime.sendMessage({ type: "save-capture", payload: result });
      },
    });

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === "toggle-picker") picker.toggle();
      if (message?.type === "start-picker") picker.start();
      if (message?.type === "stop-picker") picker.stop();
      if (message?.type === "scan-page") {
        const scan = scanPage();
        void browser.runtime.sendMessage({ type: "save-scan", payload: scan });
      }
    });
  },
});
