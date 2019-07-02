import {View} from './view.js';
import viewErrorName from './views/error.js'
import viewLoadingName from './views/loading.js'
import viewLoginName from './views/login.js'
import viewMainName from './views/main.js'
import viewOtherProxyName from './views/otherProxy.js'

const PROXY_STATE_INACTIVE = "inactive";
const PROXY_STATE_ACTIVE = "active";
const PROXY_STATE_OTHERINUSE = "otherInUse";

async function init() {
  // Let's start showing something...
  View.setView(viewLoadingName);

  let {userInfo, proxyState} = await View.sendMessage("initInfo");

  // Other proxy setting in use...
  if (proxyState == PROXY_STATE_OTHERINUSE) {
    View.setView(viewOtherProxyName);
    return;
  }

  // No user account. Let's show the login page.
  if (userInfo === null) {
    View.setView(viewLoginName);
    return;
  }

  if (proxyState != PROXY_STATE_INACTIVE &&
      proxyState != PROXY_STATE_ACTIVE) {
    View.setView(viewErrorName, "internalError");
    return;
  }

  // The main view.
  View.setView(viewMainName, {userInfo, proxyState});

  // TODO: network error observer
}

init();
