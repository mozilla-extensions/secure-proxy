import {View} from './view.js';
import viewAuthFailureName from './views/authFailure.js'
import viewConnectingName from './views/connecting.js'
import viewErrorName from './views/error.js'
import viewLoadingName from './views/loading.js'
import viewLoginName from './views/login.js'
import viewMainName from './views/main.js'
import viewOfflineName from './views/offline.js';
import viewProxyErrorName from './views/proxyError.js';
import viewSettingsName from './views/settings.js';

async function init() {
  let port = browser.runtime.connect();
  View.setPort(port);

  // Let's start showing something...
  View.setView(viewLoadingName);

  port.onMessage.addListener(async msg => {
    let {userInfo, proxyState, pendingSurvey} = msg;

    View.showSettings(!!userInfo);
    if (userInfo) {
      let settingsButton = document.getElementById("settingsButton");
      settingsButton.addEventListener("click", () => {
        View.setView(viewSettingsName, {userInfo, proxyState});
      });
    }

    View.showBack(false);
    let backElement = document.getElementById("backButton");
    backElement.addEventListener("click", () => {
      View.sendMessage("goBack");
    });

    let stateButton = document.getElementById("stateButton");
    stateButton.addEventListener("click", () => {
      View.onStateButton();
    });

    switch (proxyState) {
      case PROXY_STATE_UNKNOWN:
        View.setView(viewLoginName);
        return;

      case PROXY_STATE_PROXYERROR:
        // fall through
      case PROXY_STATE_PROXYAUTHFAILED:
        // fall through
      case PROXY_STATE_OTHERINUSE:
        View.setView(viewProxyErrorName, proxyState);
        return;

      case PROXY_STATE_AUTHFAILURE:
        View.setView(viewAuthFailureName);
        return;

      case PROXY_STATE_INACTIVE:
        // fall through
      case PROXY_STATE_ACTIVE:
        View.setView(viewMainName, {userInfo, proxyState, pendingSurvey});
        return;

      case PROXY_STATE_CONNECTING:
        View.setView(viewConnectingName);
        return;

      case PROXY_STATE_OFFLINE:
        View.setView(viewOfflineName);
        return;

      default:
        View.setView(viewErrorName, "internalError");
        return;
    }
  });
}

init();
