const FXA_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";
const FXA_SCOPES = ["profile", FXA_SCOPE];
const FXA_OAUTH_SERVER = "https://oauth-latest.dev.lcip.org/v1";
const FXA_CONTENT_SERVER = "https://latest.dev.lcip.org";
const FXA_PROFILE_SERVER = "https://latest.dev.lcip.org/profile/v1";
const FXA_CLIENT_ID = "1c7882c43994658e";

async function auth() {
  const fxaKeysUtil = new fxaCryptoRelier.OAuthUtils({
    contentServer: FXA_CONTENT_SERVER,
    oauthServer: FXA_OAUTH_SERVER
  });
  const FXA_REDIRECT_URL = browser.identity.getRedirectURL();
  
  const loginDetails = await fxaKeysUtil.launchWebExtensionKeyFlow(FXA_CLIENT_ID, {
    redirectUri: FXA_REDIRECT_URL,
    scopes: FXA_SCOPES,
  });
  browser.storage.local.set({loginDetails});

  return loginDetails;
}

async function fxaFetchProfile(FXA_PROFILE_SERVER, token) { // eslint-disable-line no-unused-vars
  const headers = new Headers({
    'Authorization': `Bearer ${token}`
  });
  const request = new Request(`${FXA_PROFILE_SERVER}/profile`, {
    method: 'GET',
    headers
  });

  const resp = await fetch(request);
  if (resp.status === 200) {
    return resp.json();
  }
  throw new Error('Failed to fetch profile');
}

async function getProfile() {
/*
Login details example:

{
  "access_token": "...",
  "token_type": "bearer",
  "scope": "profile https://identity.mozilla.com/apps/secure-proxy",
  "expires_in": 1209600,
  "auth_at": 1560898917,
  "refresh_token": "...", // What does this do? Can I request for a new token and prevent sign out?
  "keys": {
    "https://identity.mozilla.com/apps/secure-proxy": {
      "kty": "oct",
      "scope": "https://identity.mozilla.com/apps/secure-proxy",
      "k": "...",
      "kid": "..."
    }
  }
}

TODO can I use the alert api to clear the data in storage.local and then prompt again?

*/
  const { loginDetails } = await browser.storage.local.get(["loginDetails"]);
  if (!loginDetails) {
    return null;
  }
  // TODO check loginDetails.auth_at + loginDetails.expired_at > Date.now()

  const key = loginDetails.keys[FXA_SCOPE];
  const credentials = {
    access_token: loginDetails.access_token,
    refresh_token: loginDetails.refresh_token,
    key,
    metadata: {
      server: FXA_OAUTH_SERVER,
      client_id: FXA_CLIENT_ID,
      scope: FXA_SCOPES
    }
  };

  return fxaFetchProfile(FXA_PROFILE_SERVER, credentials.access_token);
}

async function init() {
  // In memory store of the state of current tabs
  const tabStates = new Map([]);

  let enabledState = getEnabledState();
  if (enabledState === undefined) {
    // default proxy enabled state to on
    await setEnabledState(true);
  }

  const PROXY_HOST = "127.0.0.1";
  const PROXY_PORT = 65535;

  /**
   * Decides if we should be proxying the request.
   * Returns true if the request should be proxied
   * Returns null if the request is internal and shouldn't count.
   */
  function shouldProxyRequest(requestInfo) {
    // Internal requests, TODO verify is correct: https://github.com/jonathanKingston/secure-proxy/issues/3
    if (requestInfo.originUrl === undefined
        && requestInfo.frameInfo === 0) {
      return null;
    }
    // If the request is local, ignore
    if (isLocal(requestInfo)) {
      return null;
    }
    if (requestInfo.incognito == true) {
      return true;
    }
    return false;
  }

  function isLocal(requestInfo) {
    const hostname = new URL(requestInfo.url).hostname;
    if (hostname == "localhost" ||
        hostname == "localhost.localdomain" ||
        hostname == "localhost6" ||
        hostname == "localhost6.localdomain6") {
      return true;
    }
    const localports = /(^127\.)|(^192\.168\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^::1$)|(^[fF][cCdD])/;
    if (localports.test(hostname)) {
      return true;
    }
    return false;
  }

  function storeRequestState(decision, requestInfo) {
    let tabState = tabStates.get(requestInfo.tabId) || {};
    // TODO store something smater here for partial tab proxying etc
    if (!("proxied" in tabState)) {
      tabState.proxied = decision;
    // If we currently only have proxied resources and this isn't set false.
    } else if (tabState.proxied && !decision) {
      tabState.proxied = false;
    }
    tabStates.set(requestInfo.tabId, tabState);
    setBrowserAction(requestInfo.tabId);
  }

  browser.proxy.onRequest.addListener((requestInfo) => {
    const decision = shouldProxyRequest(requestInfo);
    if (!enabledState) {
      return {type: "direct"};
    }
    // Ignore internal requests
    if (decision === null) {
      return {type: "direct"};
    }
    storeRequestState(decision, requestInfo);
    if (decision) {
      return {type: "http", host: PROXY_HOST, port: PROXY_PORT}; // TODO this will be an array to allow for failover look at proxy.onRequest docs
    }
    return {type: "direct"};
  }, {urls: ["<all_urls>"]});

  async function messageHandler(message, sender, response) {
    switch (message.type) {
      case "initInfo":
        const tab = await browser.tabs.query({active: true, currentWindow: true});
        //Sync profile
        //const userInfo = await browser.experiments.sync.getUserProfileInfo();
        const userInfo = await getProfile();
        return {
          userInfo,
          tabInfo: tabStates.get(tab[0].id)
        };
        break;
      case "setEnabledState":
        setEnabledState(message.data.enabledState);
        break;
      case "getEnabledState":
        return getEnabledState();
        break;
      case "authenticate":
        auth();
        break;
    }
    // dunno what this message is for
    return null;
  }

  async function getEnabledState() {
    let {enabledState} = await browser.storage.local.get(["enabledState"]);
    return enabledState;
  }

  async function setEnabledState(value) {
    enabledState = value;
    await browser.storage.local.set({enabledState: value});
    return enabledState;
  }

  browser.runtime.onMessage.addListener(messageHandler);

  function setBrowserAction(tabId) {
    if (tabId == browser.tabs.TAB_ID_NONE) {
      return;
    }
    const tabState = tabStates.get(tabId);
    let icon = "img/notproxied.png";
    if (tabState == undefined) {
      icon = "img/indeterminate.png";
    } else if (tabState.proxied == true) {
      icon = "img/proxied.png";
    }
    browser.browserAction.setIcon({
      path: icon,
      tabId,
    });
  }

  browser.tabs.onActivated.addListener((activeInfo) => {
    setBrowserAction(activeInfo.tabId);
  });

  browser.tabs.onRemoved.addListener((tabInfo) => {
    tabStates.delete(tabInfo.tabId);
  });
}

init();
