chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("app.html");

  // Check if an app.html tab is already open
  const tabs = await chrome.tabs.query({ url: url });

  if (tabs.length > 0) {
    // Focus the existing tab and bring its window to the foreground
    const existingTab = tabs[0];
    await chrome.tabs.update(existingTab.id, { active: true });
    await chrome.windows.update(existingTab.windowId, { focused: true });
  } else {
    // Open a new tab
    await chrome.tabs.create({ url: "app.html" });
  }
});