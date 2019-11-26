const loadingTimeout = 5000;

async function init() {
  const {View} = await import("./view.js");
  // Let's start showing something...
  await View.setView("loading");

  // Disable context menu.
  window.addEventListener("contextmenu", e => e.preventDefault());

  // eslint-disable-next-line verify-await/check
  let port = browser.runtime.connect({name: "panel"});
  View.syncSetPort(port);

  // A new telemetry event for this panel.
  // eslint-disable-next-line verify-await/check
  View.sendMessage("telemetryEvent", { category: "general", event: "panelShown"});

  let timeoutId = setTimeout(async _ => {
    await View.setView("error", "loadingError");
    // eslint-disable-next-line verify-await/check
    View.sendMessage("telemetryEvent", { category: "general", event: "loadingError"});
  }, loadingTimeout);

  let lastMessage;

  let settingsButton = document.getElementById("settingsButton");
  settingsButton.addEventListener("click", async () => {
    if (lastMessage && lastMessage.userInfo) {
      await View.setView("settings", lastMessage);
      // eslint-disable-next-line verify-await/check
      View.sendMessage("telemetryEvent", { category: "general", event: "settingsShown"});
    }
  });

  let backElement = document.getElementById("backButton");
  backElement.addEventListener("click", _ => View.sendMessage("goBack"));

  let stateButton = document.getElementById("stateButton");
  stateButton.addEventListener("click", _ => View.onStateButton());

  let toggleButton = document.getElementById("toggleButton");
  toggleButton.addEventListener("click", e => View.onToggleButtonClicked(e));

  port.onMessage.addListener(async msg => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = 0;
    }

    lastMessage = msg;

    View.showSettings(!!msg.userInfo);
    View.showBack(false);

    switch (msg.proxyState) {
      case PROXY_STATE_LOADING:
        // We want to keep the 'loading' view.
        return;
      case PROXY_STATE_UNAUTHENTICATED:
        // fall through
      case PROXY_STATE_AUTHFAILURE:
        // fall through
      case PROXY_STATE_GEOFAILURE:
        await View.setView("login", msg);
        return;

      case PROXY_STATE_CAPTIVE:
        await View.setView("captive", msg);
        return;

      case PROXY_STATE_OTHERINUSE:
        await View.setView("otherInUse", msg);
        return;

      case PROXY_STATE_INACTIVE:
        // fall through
      case PROXY_STATE_ACTIVE:
        if (msg.exempt && msg.proxyState === PROXY_STATE_ACTIVE) {
          await View.setView("exempt", msg);
        } else {
          await View.setView("main", msg);
        }
        return;

      case PROXY_STATE_PROXYERROR:
        // fall through
      case PROXY_STATE_PROXYAUTHFAILED:
        // fall through
      case PROXY_STATE_OFFLINE:
        await View.setView("proxyError", msg);
        return;

      case PROXY_STATE_CONNECTING:
        await View.setView("connecting", msg);
        return;

      default:
        await View.setView("error", "internalError");
    }
  });
}

// Defer loading until the document has loaded
if (document.readyState === "loading") {
  // We don't care about waiting for init to finish in this code
  document.addEventListener("DOMContentLoaded", () => {
    // eslint-disable-next-line verify-await/check
    init();
  });
} else {
  // eslint-disable-next-line verify-await/check
  init();
}

// Disable middle click.
window.addEventListener("auxclick", event => {
  if (event.button !== 0) {
    // eslint-disable-next-line verify-await/check
    event.preventDefault();
  }
});
