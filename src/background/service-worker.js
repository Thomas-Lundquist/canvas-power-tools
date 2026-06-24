chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding/index.html') })
  }
})

// Open extension pages from content script messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL(message.path) })
    sendResponse({ ok: true })
  }
})
