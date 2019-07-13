import {View} from './view.js';
import viewConnectingName from './views/connecting.js'
import viewErrorName from './views/error.js'
import viewLoadingName from './views/loading.js'
import viewLoginName from './views/login.js'
import viewMainName from './views/main.js'
import viewOfflineName from './views/offline.js';
import viewOtherInUseName from './views/otherInUse.js';
import viewProxyErrorName from './views/proxyError.js';
import viewSettingsName from './views/settings.js';

async function init() {
  let port = browser.runtime.connect();
  View.setPort(port);

  // Let's start showing something...
  View.setView(viewLoadingName);

  let userInfo;
  let proxyState;
  let surveyName;
  let learnMoreUrl;

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

  let surveyLink = document.getElementById("surveyLink");
  surveyLink.addEventListener("click", e => {
    View.sendMessage("survey", {survey: surveyName});
    e.preventDefault();
    close();
  });

  let toggleButton = document.getElementById("toggleButton");
  toggleButton.addEventListener("click", e => {
    View.onToggleButtonClicked(e);
  });

  let learnMoreLink = document.getElementById("learnMoreLink");
  learnMoreLink.addEventListener("click", e => {
    View.sendMessage("openUrl", {url: learnMoreUrl});
    e.preventDefault();
    close();
  });

  port.onMessage.addListener(async msg => {
    userInfo = msg.userInfo;
    proxyState = msg.proxyState;
    surveyName = msg.pendingSurvey;
    learnMoreUrl = msg.learnMoreUrl;

    View.showSettings(!!userInfo);
    View.showBack(false);

    switch (proxyState) {
      case PROXY_STATE_UNKNOWN:
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
        View.showSurvey(surveyName);
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
        return;
    }
  });
}

init();
