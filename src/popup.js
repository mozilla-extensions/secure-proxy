import {View} from "./view.js";
import viewConnectingName from "./views/connecting.js";
import viewErrorName from "./views/error.js";
import viewLoadingName from "./views/loading.js";
import viewLoginName from "./views/login.js";
import viewMainName from "./views/main.js";
import viewOfflineName from "./views/offline.js";
import viewOtherInUseName from "./views/otherInUse.js";
import viewProxyErrorName from "./views/proxyError.js";
import viewSettingsName from "./views/settings.js";
const loadingTimeout = 5000;

async function init() {
  let port = browser.runtime.connect();
  View.setPort(port);

  // Let's start showing something...
  View.setView(viewLoadingName);
  let timeoutId = setTimeout(_ => View.setView(viewErrorName, "loadingError"), loadingTimeout);

  let userInfo;
  let proxyState;

  let settingsButton = document.getElementById("settingsButton");
  settingsButton.addEventListener("click", () => {
    if (userInfo) {
      View.setView(viewSettingsName, {userInfo, proxyState});
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
        View.setView(viewLoginName, proxyState);
        return;

      case PROXY_STATE_PROXYERROR:
        // fall through
      case PROXY_STATE_PROXYAUTHFAILED:
        // fall through
        View.setView(viewProxyErrorName, proxyState);
        return;

      case PROXY_STATE_OTHERINUSE:
        View.setView(viewOtherInUseName, proxyState);
        return;

      case PROXY_STATE_INACTIVE:
        // fall through
      case PROXY_STATE_ACTIVE:
        View.setView(viewMainName, {userInfo, proxyState});
        return;

      case PROXY_STATE_CONNECTING:
        View.setView(viewConnectingName);
        return;

      case PROXY_STATE_OFFLINE:
        View.setView(viewOfflineName);
        return;

      default:
        View.setView(viewErrorName, "internalError");
    }
  });
}

init();
