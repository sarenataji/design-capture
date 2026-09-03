import { probePageGlobals } from "../lib/probe-globals";
import { STORAGE_KEYS } from "../lib/storage";

export default defineBackground(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

  async function openAndToggle(tabId: number) {
    await chrome.sidePanel.open({ tabId }).catch(() => {});
    await browser.tabs.sendMessage(tabId, { type: "toggle-picker" }).catch(() => {});
  }

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) await openAndToggle(tab.id);
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-picker") return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await openAndToggle(tab.id);
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "save-capture") {
      void browser.storage.local.set({
        [STORAGE_KEYS.lastCapture]: message.payload,
        [STORAGE_KEYS.lastCaptureAt]: Date.now(),
        [STORAGE_KEYS.pickerActive]: false,
      });
      sendResponse({ ok: true });
    }
    if (message?.type === "preview-capture") {
      void browser.storage.local.set({
        [STORAGE_KEYS.lastCapture]: message.payload,
        [STORAGE_KEYS.lastCaptureAt]: Date.now(),
      });
      sendResponse({ ok: true });
    }
    if (message?.type === "save-scan") {
      void browser.storage.local.set({
        [STORAGE_KEYS.lastScan]: message.payload,
        [STORAGE_KEYS.lastScanAt]: Date.now(),
      });
      sendResponse({ ok: true });
    }
    if (message?.type === "probe-globals") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse([]);
        return false;
      }
      void chrome.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: probePageGlobals,
        })
        .then((results) => {
          sendResponse(results[0]?.result ?? []);
        })
        .catch(() => sendResponse([]));
      return true;
    }
    if (message?.type === "capture-visible-tab") {
      const windowId = sender.tab?.windowId;
      const screenshot = windowId === undefined
        ? browser.tabs.captureVisibleTab({ format: "png" })
        : browser.tabs.captureVisibleTab(windowId, { format: "png" });
      void screenshot
        .then((dataUrl) => sendResponse({ dataUrl }))
        .catch(() => sendResponse({}));
      return true;
    }
    return false;
  });
});
