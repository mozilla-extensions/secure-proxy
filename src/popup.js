const loadingTimeout = 5000;

async function init() {
  const {View} = await import("./view.js");
  // Let's start showing something...
  View.setView("loading");

  let port = browser.runtime.connect({name: "panel"});
  View.setPort(port);

  let timeoutId = setTimeout(_ => View.setView("error", "loadingError"), loadingTimeout);

  let userInfo;
  let proxyState;

  let settingsButton = document.getElementById("settingsButton");
  settingsButton.addEventListener("click", () => {
    if (userInfo) {
      View.setView("settings", {userInfo, proxyState});
    }
  });

  let backElement = document.getElementById("backButton");
  backElement.addEventListener("click", () => {
    View.sendMessage("goBack");
  });

  let stateButton = document.getElementById("stateButton");
  stateButton.addEventListener("click", () => {
    View.onStateButton();
  });

  let toggleButton = document.getElementById("toggleButton");
  toggleButton.addEventListener("click", e => {
    View.onToggleButtonClicked(e);
  });

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
        View.setView("login", proxyState);
        return;

      case PROXY_STATE_PROXYERROR:
        // fall through
      case PROXY_STATE_PROXYAUTHFAILED:
        View.setView("proxyError", proxyState);
        return;

      case PROXY_STATE_OTHERINUSE:
        View.setView("otherInUse", proxyState);
        return;

      case PROXY_STATE_INACTIVE:
        // fall through
      case PROXY_STATE_ACTIVE:
        if (msg.exempt && proxyState === PROXY_STATE_ACTIVE) {
          View.setView("exempt", proxyState);
        } else {
          View.setView("main", {userInfo, proxyState});
        }
        return;

      case PROXY_STATE_CONNECTING:
        View.setView("connecting");
        return;

      case PROXY_STATE_OFFLINE:
        View.setView("offline");
        return;

      default:
        View.setView("error", "internalError");
    }
  });
}

// Defer loading until the document has loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
} else {
  init();
}
