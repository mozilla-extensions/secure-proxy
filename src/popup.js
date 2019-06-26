import {View} from './view.js';
import viewLoadingName from './views/loading.js'
import viewLoginName from './views/login.js'
import viewMainName from './views/main.js'

async function init() {
  // Let's start showing something...
  View.setView(viewLoadingName);

  const {tabInfo, userInfo, proxyState} = await View.sendMessage("initInfo");

  // No user account. Let's show the login page.
  if (userInfo === null) {
    View.setView(viewLoginName);
    return;
  }

  // The main view.
  View.setView(viewMainName, {tabInfo, userInfo, proxyState});

  // TODO: proxy setting change observer
  // TODO: network error observer
}

init();
