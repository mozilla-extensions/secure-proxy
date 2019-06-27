import {View} from './view.js';
import viewLoadingName from './views/loading.js'
import viewLoginName from './views/login.js'
import viewMainName from './views/main.js'
import viewOtherProxyName from './views/otherProxy.js'

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

  // For debugging...
  if (userInfo === null && false) {
    userInfo = { email: 'foo@bar.com' }
  }

  // No user account. Let's show the login page.
  if (userInfo === null) {
    View.setView(viewLoginName);
    return;
  }

  // The main view.
  View.setView(viewMainName, {userInfo, proxyState});

  // TODO: network error observer
}

init();
