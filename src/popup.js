import {View} from './view.js';
import viewErrorName from './views/error.js'
import viewLoadingName from './views/loading.js'
import viewLoginName from './views/login.js'
import viewMainName from './views/main.js'
import viewProxyErrorName from './views/proxyError.js';

async function init() {
  // Let's start showing something...
  View.setView(viewLoadingName);

  let {userInfo, proxyState} = await View.sendMessage("initInfo");

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

    case PROXY_STATE_INACTIVE:
      // fall through
    case PROXY_STATE_ACTIVE:
      View.setView(viewMainName, {userInfo, proxyState});
      return;

    default:
      View.setView(viewErrorName, "internalError");
      return;
  }
}

init();
