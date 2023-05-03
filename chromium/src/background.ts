chrome.runtime.onMessage.addListener((_msg, _, _sendResponse) => {
  // this return true allows for async sendResponse.
  return true;
});
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({
      url: chrome.runtime.getURL("index.html"),
    });
  }
});
export {};
