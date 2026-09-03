declare namespace chrome {
  const sidePanel: {
    setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
    open(options: { tabId: number }): Promise<void>;
  };
}
