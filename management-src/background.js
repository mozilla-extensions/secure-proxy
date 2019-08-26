const EXTENSION_ID = "secure-proxy@mozilla.com";

function sendMessage(type, value = null) {
  return browser.runtime.sendMessage(EXTENSION_ID, { type, value }).catch(_ => null);
}

browser.browserAction.onClicked.addListener(_ => {
  browser.tabs.create({
    url: "page.html",
  });
});

browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case "reload":
      return sendMessage("reload");

    case "getCurrentConfig":
      return sendMessage("getCurrentConfig");

    case "setDebuggingEnabled":
      return sendMessage("setDebuggingEnabled", message.value);

    case "setProxyURL":
      return sendMessage("setProxyURL", message.value);

    default:
      console.error(`Invalid message type: ${message.type}`);
      return;
  }
});
