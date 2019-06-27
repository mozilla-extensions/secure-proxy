import {View} from './view.js';
import viewLoadingName from './views/loading.js'
import viewLoginName from './views/login.js'
import viewMainName from './views/main.js'
import viewOtherProxyName from './views/otherProxy.js'

async function init() {
  // Let's start showing something...
  View.setView(viewLoadingName);

  let {userInfo, proxyState, otherProxyInUse} = await View.sendMessage("initInfo");

  // Other proxy setting in use...
  if (otherProxyInUse) {
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

  // TODO: proxy setting change observer
  // TODO: network error observer
}

init();
