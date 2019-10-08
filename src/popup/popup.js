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
  View.sendMessage("telemetry", { category: "general", event: "panelShown"});

  let timeoutId = setTimeout(async _ => {
    await View.setView("error", "loadingError");
    // eslint-disable-next-line verify-await/check
    View.sendMessage("telemetry", { category: "general", event: "loadingError"});
  }, loadingTimeout);

  let userInfo;
  let proxyState;

  let settingsButton = document.getElementById("settingsButton");
  settingsButton.addEventListener("click", async () => {
    if (userInfo) {
      await View.setView("settings", {userInfo, proxyState});
      // eslint-disable-next-line verify-await/check
      View.sendMessage("telemetry", { category: "general", event: "settingsShown"});
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
    userInfo = msg.userInfo;
    proxyState = msg.proxyState;

    View.showSettings(!!userInfo);
    View.showBack(false);

    switch (proxyState) {
      case PROXY_STATE_LOADING:
        // We want to keep the 'loading' view.
        return;
      case PROXY_STATE_UNAUTHENTICATED:
        // fall through
      case PROXY_STATE_AUTHFAILURE:
        await View.setView("login", msg);
        return;

      case PROXY_STATE_PROXYERROR:
        // fall through
      case PROXY_STATE_PROXYAUTHFAILED:
        // fall through
      case PROXY_STATE_OFFLINE:
        await View.setView("proxyError", msg);
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
        if (msg.exempt && proxyState === PROXY_STATE_ACTIVE) {
          await View.setView("exempt", msg);
        } else {
          await View.setView("main", msg);
        }
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
