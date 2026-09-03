declare namespace chrome {
  const sidePanel: {
    setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
    open(options: { tabId: number }): Promise<void>;
  };
  namespace scripting {
    function executeScript(injection: {
      target: { tabId: number };
      world?: "ISOLATED" | "MAIN";
      func: () => unknown;
    }): Promise<{ result?: unknown }[]>;
  }
}
