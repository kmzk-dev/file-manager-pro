chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("app.html");

  // 既に app.html を開いているタブがあるか検索
  const tabs = await chrome.tabs.query({ url: url });

  if (tabs.length > 0) {
    // 既存のタブをアクティブ化し、そのウィンドウを前面に表示
    const existingTab = tabs[0];
    await chrome.tabs.update(existingTab.id, { active: true });
    await chrome.windows.update(existingTab.windowId, { focused: true });
  } else {
    // 新規タブとして開く
    await chrome.tabs.create({ url: "app.html" });
  }
});