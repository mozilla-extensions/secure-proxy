const EXTENSION_ID = "secure-proxy@mozilla.com";

browser.browserAction.onClicked.addListener(async _ => {
  await browser.tabs.create({
    url: "page.html",
  });
});

browser.runtime.onMessage.addListener((message, sender) => {
  // eslint-disable-next-line verify-await/check
  return browser.runtime.sendMessage(EXTENSION_ID, message).catch(_ => null);
});
