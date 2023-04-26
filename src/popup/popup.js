const loadingTimeout = 5000;

async function init() {
  const {View} = await import("./view.js");
  // Let's start showing something...
  await View.setView("loading");

  // Disable context menu.
  window.addEventListener("contextmenu", e => e.preventDefault());

  let port = browser.runtime.connect({name: "panel"});
  View.syncSetPort(port);

  // A new telemetry event for this panel.
  View.sendMessage("telemetryEvent", { category: "general", event: "panelShown"});

  let timeoutId = setTimeout(async _ => {
    await View.setView("error", "loadingError");
    View.sendMessage("telemetryEvent", { category: "general", event: "loadingError"});
  }, loadingTimeout);

  // Set 'FPN is being sunset' strings.
  const sunsetMessage = document.getElementById("sunsetMessage");
  sunsetMessage.textContent = browser.i18n.getMessage("sunsetMessage");
  // Reusing 'Learn more' string
  const sunsetSumoLink = document.getElementById("sunsetSumoLink");
  sunsetSumoLink.textContent = browser.i18n.getMessage("viewDeviceLimitLink");
  sunsetSumoLink.addEventListener("click", () => {
    View.sendMessage("openSumoLink");
    View.close();
  });

  let lastMessage;

  let settingsButton = document.getElementById("settingsButton");
  settingsButton.addEventListener("click", async () => {
    if (lastMessage && lastMessage.userInfo) {
      await View.setView("settings", lastMessage);
      View.sendMessage("telemetryEvent", { category: "general", event: "settingsShown"});
    }
  });

  let backElement = document.getElementById("backButton");
  backElement.addEventListener("click", _ => View.sendMessage("goBack"));

  let stateButton = document.getElementById("stateButton");
  stateButton.addEventListener("click", _ => View.onStateButton());

  port.onMessage.addListener(async msg => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = 0;
    }

    lastMessage = msg;

    View.showSettings(!!msg.userInfo);
    View.showBack(false);
    View.hideError();

    // We received some logs to download.
    if (Array.isArray(msg.logs)) {
      downloadLogs(msg.logs);
      delete msg.logs;
    }

    switch (msg.proxyState) {
      case PROXY_STATE_LOADING:
        await View.setView("loading");
        return;
      case PROXY_STATE_UNAUTHENTICATED:
        // fall through
      case PROXY_STATE_AUTHFAILURE:
        // fall through
      case PROXY_STATE_GEOFAILURE:
        await View.setView("login", msg);
        return;

      case PROXY_STATE_INACTIVE:
        await View.setView("disabled", msg);
        return;
      case PROXY_STATE_ACTIVE:
        await View.setView("main", msg);
        return;

      case PROXY_STATE_PROXYAUTHFAILED:
        await View.setError("proxyError");
        await View.setView("disabled", msg);
        return;

      case PROXY_STATE_CAPTIVE:
        await View.setError("offline");
        await View.setView("disabled", msg);
        return;

      case PROXY_STATE_OTHERINUSE:
        // fall through
      case PROXY_STATE_PROXYERROR:
        // fall through
      case PROXY_STATE_OFFLINE:
        await View.setError(msg.proxyState);
        await View.setView("disabled", msg);
        return;

      case PROXY_STATE_CONNECTING:
        await View.setView("connecting", msg);
        return;

      case PROXY_STATE_DEVICELIMIT:
        await View.setView("deviceLimit", msg);
        return;

      case PROXY_STATE_PAYMENTREQUIRED:
        await View.setView("paymentRequired", msg);
        return;

      case PROXY_STATE_ONBOARDING:
        await View.setView("onboarding", msg);
        return;

      default:
        await View.setError("internalError");
        await View.setView("disabled", msg);
    }
  });
}

// Defer loading until the document has loaded
if (document.readyState === "loading") {
  // We don't care about waiting for init to finish in this code
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
} else {
  init();
}

// Disable middle click.
window.addEventListener("auxclick", event => {
  if (event.button !== 0) {
    event.preventDefault();
  }
});

function downloadLogs(logs) {
  const blob = new Blob([logs.join("\n")], {type: "octet/stream"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = url;
  a.download = "secure-proxy-logs.txt";

  a.click();
  URL.revokeObjectURL(url);
}
