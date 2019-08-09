// FxA openID configuration
const FXA_OPENID = "https://accounts.firefox.com/.well-known/openid-configuration";

// List of attributes for the openID configuration
const FXA_ENDPOINT_PROFILE = "userinfo_endpoint";
const FXA_ENDPOINT_TOKEN = "token_endpoint";
const FXA_ENDPOINT_ISSUER = "issuer";

// Token scopes
const FXA_PROFILE_SCOPE = "profile";
const FXA_PROXY_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";

// The client ID for this extension
const FXA_CLIENT_ID = "a8c528140153d1c6";

// Token expiration time
const FXA_EXP_TIME = 21600; // 6 hours

// Testing URL. This request is sent with the proxy settings when we are in
// connecting state. If this succeeds, we go to active state.
const CONNECTING_HTTP_REQUEST = "http://test.factor11.cloudflareclient.com/";

// Proxy configuration
const PROXY_URL = "https://proxy-staging.cloudflareclient.com:8001";

// How early we want to re-generate the tokens (in secs)
const EXPIRE_DELTA = 3600;

// These URLs must be formatted
const LEARN_MORE_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/cloudflare";
const HELP_AND_SUPPORT_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/firefox-private-network";

// These URLs do not need to be formatted
const PRIVACY_POLICY_URL = "https://www.mozilla.org/privacy/firefox-private-network";
const TERMS_AND_CONDITIONS_URL = "https://www.mozilla.org/about/legal/terms/firefox-private-network";

// Parameters for DNS over HTTP
const DOH_MODE = 3;
const DOH_BOOTSTRAP_ADDRESS = "1.1.1.1";

// If run() fails, it will be retriggered after this timeout (in milliseconds)
const RUN_TIMEOUT = 5000; // 5 secs
const FETCH_TIMEOUT = 10000; // 10 secs

// Enable debugging
let debuggingMode = false;
function log(msg, ...rest) {
  if (debuggingMode) {
    console.log("*** Background.js *** - " + msg, ...rest);
  }
}

class Background {
  constructor() {
    log("constructor");

    this.connectionId = 0;
    this.survey = new Survey();
    this.exemptTabStatus = new Map();
    this.fxaEndpoints = new Map();
    this.proxyState = PROXY_STATE_LOADING;
    this.webSocketConnectionIsolationCounter = 0;
    this.nextExpireTime = 0;

    // A map of content-script ports. The key is the tabId.
    this.contentScriptPorts = new Map();

    // This is Set of pending operatations to do after a token generation.
    this.postTokenGenerationOps = new Set();
    this.generatingTokens = false;

    // Timeout for run() when offline is detected.
    this.runTimeoutId = 0;
  }

  async init() {
    const prefs = await browser.experiments.proxyutils.settings.get({});
    debuggingMode = prefs.value.debuggingEnabled;

    log("init");

    this.fxaOpenID = prefs.value.fxaURL || FXA_OPENID;

    this.proxyURL = new URL(prefs.value.proxyURL || PROXY_URL);
    this.proxyType = this.proxyURL.protocol === "https:" ? "https" : "http";
    this.proxyPort = this.proxyURL.port || (this.proxyURL.protocol === "https:" ? 443 : 80);
    this.proxyHost = this.proxyURL.hostname;

    try {
      const capitivePortalUrl = new URL(prefs.value.captiveDetect);
      this.captivePortalOrigin = capitivePortalUrl.origin;
    } catch (e) {
      // ignore
    }

    // Let's take the last date of usage.
    let { lastUsageDays } = await browser.storage.local.get(["lastUsageDays"]);
    if (!lastUsageDays) {
       lastUsageDays = {
         date: null,
         count: 0,
       };
    }
    this.lastUsageDays = lastUsageDays;

    browser.tabs.onRemoved.addListener((tabId) => {
      this.removeExemptTab(tabId);
    });

    browser.tabs.onUpdated.addListener((tabId) => {
      // Icon overrides are changes when the user navigates
      this.setTabIcon(tabId);
    });
    browser.tabs.onActivated.addListener((info) => {
      if (this.isTabExempt(info.tabId)) {
        this.showStatusPrompt();
      }
    });

    // Proxy configuration
    browser.proxy.onRequest.addListener(async requestInfo => {
      return this.proxyRequestCallback(requestInfo);
    }, {urls: ["<all_urls>"]});

    // Handle header errors before we render the response
    browser.webRequest.onHeadersReceived.addListener(details => {
      let hasWarpError = !!details.responseHeaders.find((header) => {
        return header.name === "cf-warp-error" && header.value === "1";
      });

      // In case of HTTP error status codes, received by onCompleted(), we know that:
      // 1. the connection is a plain/text (HTTP, no HTTPS).
      // 2. if they are 'real', there is an extra cf-warp-error header, set by
      //    the proxy.
      if (hasWarpError) {
        switch (details.statusCode) {
          case 407:
            this.processNetworkError(details.url, "NS_ERROR_PROXY_AUTHENTICATION_FAILED");
            break;

          case 429:
            this.processNetworkError(details.url, "NS_ERROR_TOO_MANY_REQUESTS");
            break;
        }
      }

      // The proxy returns errors that are warped which we should show a real looking error page for
      // These only occur over http and we can't really handle sub resources
      if ([502, 407, 429].includes(details.statusCode) &&
          details.tabId &&
          details.type === "main_frame" &&
          hasWarpError) {
        browser.experiments.proxyutils.loadNetError(details.statusCode, details.url, details.tabId);
        return {cancel: true};
      }
      return {};
    }, {urls: ["http://*/*"]}, ["responseHeaders", "blocking"]);

    browser.webRequest.onHeadersReceived.addListener(details => {
      if (this.proxyState !== PROXY_STATE_CONNECTING &&
          this.proxyState !== PROXY_STATE_OFFLINE) {
        return;
      }

      if (details.statusCode === 200) {
        this.connectionSucceeded();
      }
    }, {urls: [CONNECTING_HTTP_REQUEST]}, ["responseHeaders", "blocking"]);

    browser.webRequest.onErrorOccurred.addListener(async details => {
      await this.processNetworkError(details.url, details.error);
    }, {urls: ["<all_urls>"]});


    // proxy setting change observer
    browser.experiments.proxyutils.onChanged.addListener(async _ => {
      let hasChanged = await this.computeProxyState();
      if (hasChanged) {
        this.updateUI();
      }
    });

    browser.runtime.onMessage.addListener(async (message, sender) => {
      if (message.type === "getBaseDomainFromHost") {
        return browser.experiments.proxyutils.getBaseDomainFromHost(message.hostname);
      }
      if (message.type == "exempt") {
        this.exemptTab(sender.tab.id, message.status);
      }
    });

    browser.runtime.onConnect.addListener(port => {
      if (port.name === "port-from-cs") {
        this.contentScriptConnected(port);
        return;
      }

      if (port.name === "panel") {
        this.panelConnected(port);
        return;
      }

      log("Invalid port name!");
    });

    // connectivity observer.
    browser.experiments.proxyutils.onConnectionChanged.addListener(connectivity => {
      this.onConnectivityChanged(connectivity);
    });

    // Let's initialize the survey object.
    await this.survey.init(this);
  }

  // This method is executed multiple times: at startup time, and each time we
  // go back online. It fetches all the required resources and it computes the
  // proxy state.
  async run() {
    log("run!");

    clearTimeout(this.runTimeoutId);

    if (this.fxaEndpoints.size === 0) {
      const previousProxyState = this.proxyState;

      // Let's fetch the well-known data.
      let wellKnownData = await this.fetchWellKnownData();
      if (!wellKnownData) {
        log("failed to fetch well-known resources");

        // We are offline. Let's show the 'offline' view, and let's try to
        // fetch the well-known data again later.
        this.setOfflineAndStartRecoveringTimer();

        if (previousProxyState !== PROXY_STATE_OFFLINE) {
          this.updateUI();
        }

        return;
      }

      // Better to be in this state to compute the new one.
      this.proxyState = PROXY_STATE_LOADING;
    }

    // Here we generate the current proxy state.
    await this.computeProxyState();

    // UI
    this.updateUI();
  }

  setOfflineAndStartRecoveringTimer() {
    log("set offline state and start the timer");

    this.proxyState = PROXY_STATE_OFFLINE;

    clearTimeout(this.runTimeoutId);
    this.runTimeoutId = setTimeout(_ => this.run(), RUN_TIMEOUT);
  }

  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }

  async processNetworkError(url, errorStatus) {
    log(`processNetworkError: ${url}  ${errorStatus}`);

    if (this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    if (errorStatus === "NS_ERROR_PROXY_AUTHENTICATION_FAILED") {
      this.proxyState = PROXY_STATE_PROXYAUTHFAILED;

      await browser.storage.local.set({
        proxyTokenData: null,
        profileTokenData: null,
        profileData: null,
      });

      this.updateUI();
      await this.maybeGenerateTokens();
      return;
    }

    if (errorStatus === "NS_ERROR_PROXY_CONNECTION_REFUSED" ||
        errorStatus === "NS_ERROR_TOO_MANY_REQUESTS") {
      this.proxyState = PROXY_STATE_PROXYERROR;
      this.updateUI();
      return;
    }

    if ((this.proxyState === PROXY_STATE_CONNECTING ||
         this.proxyState === PROXY_STATE_OFFLINE) &&
        url === CONNECTING_HTTP_REQUEST &&
        (errorStatus === "NS_ERROR_UNKNOWN_PROXY_HOST" ||
         errorStatus === "NS_ERROR_ABORT")) {
      this.setOfflineAndStartRecoveringTimer();
      this.updateUI();
    }
  }

  async showStatusPrompt() {
    // No need to show the toast if the panel is visible.
    if (this.currentPort) {
      return;
    }

    let promptNotice;
    let isWarning = false;
    switch (this.proxyState) {
      case PROXY_STATE_INACTIVE:
        promptNotice = "toastProxyOff";
        break;

      case PROXY_STATE_ACTIVE:
        promptNotice = "toastProxyOn";
        break;

      case PROXY_STATE_OTHERINUSE:
        // Fall through
      case PROXY_STATE_PROXYERROR:
        // Fall through
      case PROXY_STATE_PROXYAUTHFAILED:
        promptNotice = "toastWarning";
        isWarning = true;
        break;

      default:
        // no message.
        break;
    }

    if (await this.isCurrentTabExempt()) {
      promptNotice = "toastWarning";
      isWarning = true;
    }

    if (promptNotice) {
      browser.experiments.proxyutils.showPrompt(browser.i18n.getMessage(promptNotice), isWarning);
    }
  }

  // Set this.proxyState based on the current settings.
  async computeProxyState() {
    log("computing status - currently: " + this.proxyState);

    // This method will schedule the token generation, if needed.
    if (this.tokenGenerationTimeout) {
      clearTimeout(this.tokenGenerationTimeout);
      this.tokenGenerationTimeout = 0;
    }

    // The run() failed to fetch the well-known resources. We are offline.
    if (this.fxaEndpoints.size === 0) {
      this.setOfflineAndStartRecoveringTimer();
    }

    // We want to keep these states.
    let currentState = this.proxyState;
    if (currentState !== PROXY_STATE_AUTHFAILURE &&
        currentState !== PROXY_STATE_PROXYERROR &&
        currentState !== PROXY_STATE_PROXYAUTHFAILED) {
      this.proxyState = PROXY_STATE_UNAUTHENTICATED;
    }

    // Something else is in use.
    let otherProxyInUse = await this.hasProxyInUse();
    if (otherProxyInUse) {
      this.proxyState = PROXY_STATE_OTHERINUSE;
    }

    // All seems good. Let's see if the proxy should enabled.
    if (this.proxyState === PROXY_STATE_UNAUTHENTICATED) {
      let { proxyState } = await browser.storage.local.get(["proxyState"]);
      if (proxyState === PROXY_STATE_INACTIVE) {
        this.proxyState = PROXY_STATE_INACTIVE;
      } else if ((await this.maybeGenerateTokens())) {
        this.proxyState = PROXY_STATE_CONNECTING;
        this.testProxyConnection();
      }
    }

    // If we are here we are not active yet. At least we are connecting.
    // Restore default settings.
    if (currentState !== this.proxyState) {
      this.inactiveSteps();
    }

    log("computing status - final: " + this.proxyState);
    return currentState !== this.proxyState;
  }

  async enableProxy(value) {
    log("enabling proxy: " + value);

    // We support the changing of proxy state only from some states.
    if (this.proxyState !== PROXY_STATE_UNAUTHENTICATED &&
        this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_INACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    // Let's force a new proxy state, and then let's compute it again.
    let proxyState = value ? PROXY_STATE_CONNECTING : PROXY_STATE_INACTIVE;
    await browser.storage.local.set({proxyState});

    if (await this.computeProxyState()) {
      this.updateUI();
    }
  }

  testProxyConnection() {
    log("executing a fetch to check the connection");

    // We don't care about the result of this fetch.
    fetch(CONNECTING_HTTP_REQUEST, { cache: "no-cache"}).catch(_ => {});
  }

  updateUI() {
    log("update UI");

    this.showStatusPrompt();
    this.updateIcon();
    this.sendDataToCurrentPort();
  }

  // This updates any tab that doesn't have an exemption
  updateIcon() {
    let icon;
    let text;
    if (this.proxyState === PROXY_STATE_INACTIVE ||
        this.proxyState === PROXY_STATE_CONNECTING ||
        this.proxyState === PROXY_STATE_OFFLINE) {
      icon = "img/badge_off.svg";
      text = "badgeOffText";
    } else if (this.proxyState === PROXY_STATE_ACTIVE) {
      icon = "img/badge_on.svg";
      text = "badgeOnText";
    } else {
      icon = "img/badge_warning.svg";
      text = "badgeWarningText";
    }

    browser.browserAction.setIcon({
      path: icon,
    });
    browser.browserAction.setTitle({
      title: this.getTranslation(text),
    });
  }

  // Used to set or remove tab exemption icons
  setTabIcon(tabId) {
    log(`updating tab icon: ${tabId}`);
    // default value here is undefined which resets the icon back when it becomes non exempt again
    let path;
    // default title resets the tab title
    let title = null;
    if (this.isTabExempt(tabId)) {
      title = this.getTranslation("badgeWarningText");
      path = "img/badge_warning.svg";
    }

    browser.browserAction.setIcon({
      path,
      tabId
    });
    browser.browserAction.setTitle({
      tabId,
      title
    });
  }

  async proxyRequestCallback(requestInfo) {
    let shouldProxyRequest = this.shouldProxyRequest(requestInfo);
    let additionalConnectionIsolation = this.additionalConnectionIsolation(requestInfo);

    log("proxy request for " + requestInfo.url + " => " + shouldProxyRequest);

    if (!shouldProxyRequest) {
      return {type: "direct"};
    }

    let nowInSecs = Math.round((performance.timeOrigin + performance.now()) / 1000);
    if (this.nextExpireTime && nowInSecs >= this.nextExpireTime) {
      log("Suspend detected!");
      await this.maybeGenerateTokens();
    }

    return [{
      type: this.proxyType,
      host: this.proxyHost,
      port: this.proxyPort,
      proxyAuthorizationHeader: this.proxyAuthorizationHeader,
      connectionIsolationKey: this.proxyAuthorizationHeader + additionalConnectionIsolation + this.connectionId,
    }];
  }

  async getCurrentTab() {
    let currentTab = (await browser.tabs.query({currentWindow: true, active: true}))[0];
    return currentTab;
  }

  async isCurrentTabExempt() {
    let currentTab = await this.getCurrentTab();
    return currentTab && this.isTabExempt(currentTab.id);
  }

  isTabExempt(tabId) {
    return this.exemptTabStatus.get(tabId) === "exemptTab";
  }

  removeExemptTab(tabId) {
    log(`removeExemptTab ${tabId}`);
    this.exemptTabStatus.set(tabId, "ignoreTab");
    this.setTabIcon(tabId);
    // Re-enable the content script blocking on the tab
    this.informContentScripts();
  }

  exemptTab(tabId, status) {
    log(`exemptTab ${tabId} ${status}`);
    this.exemptTabStatus.set(tabId, status);
    this.setTabIcon(tabId);
  }

  /**
   * Decides if we should be proxying the request.
   * Returns true if the request should be proxied
   * Returns null if the request is internal and shouldn't count.
   */
  shouldProxyRequest(requestInfo) {
    // If user has exempted the tab from the proxy, don't proxy
    if (this.isTabExempt(requestInfo.tabId)) {
      return false;
    }

    function isProtocolSupported(url) {
      return url.protocol === "http:" ||
             url.protocol === "https:" ||
             url.protocol === "ftp:" ||
             url.protocol === "wss:" ||
             url.protocol === "ws:";
    }

    function isLocal(url) {
      let hostname = url.hostname;
      return (/(.+\.)?localhost$/.test(hostname) ||
        /(.+\.)?localhost6$/.test(hostname) ||
        /(.+\.)?localhost.localdomain$/.test(hostname) ||
        /(.+\.)?localhost6.localdomain6$/.test(hostname) ||
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.1[6-9]\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.2[0-9]\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.3[0-1]\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /\[[0:]+1\]/.test(hostname));
    }

    // We want to continue the sending of requests to the proxy even if we
    // receive errors, in order to avoid exposing the IP when something goes
    // wrong.
    if (this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_PROXYERROR &&
        this.proxyState !== PROXY_STATE_PROXYAUTHFAILED &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return false;
    }

    // If we are 'connecting' or 'offline' state, we want to allow just the
    // CONNECTING_HTTP_REQUEST.
    if (this.proxyState === PROXY_STATE_CONNECTING ||
        this.proxyState === PROXY_STATE_OFFLINE) {
      return requestInfo.url === CONNECTING_HTTP_REQUEST;
    }

    // Just to avoid recreating the URL several times, let's cache it.
    const url = new URL(requestInfo.url);

    // Let's skip captive portal URLs.
    if (this.captivePortalOrigin && this.captivePortalOrigin === url.origin) {
      return false;
    }

    // Only http/https/ftp requests
    if (!isProtocolSupported(url)) {
      return false;
    }

    // If the request is local, ignore
    if (isLocal(url)) {
      return false;
    }

    // If is part of oauth also ignore
    const authUrls = [
      this.fxaOpenID,
      this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE),
      this.fxaEndpoints.get(FXA_ENDPOINT_TOKEN),
    ];
    let isAuthUrl = authUrls.some((item) => {
      return new URL(item).origin === url.origin;
    });
    if (isAuthUrl) {
      return false;
    }

    this.maybeStoreUsageDays();
    return true;
  }

  additionalConnectionIsolation(requestInfo) {
    function isWebsocket(url) {
      return url.protocol === "wss:" || url.protocol === "ws:";
    }

    const url = new URL(requestInfo.url);

    if (isWebsocket(url)) {
      const isolation = ++this.webSocketConnectionIsolationCounter;
      return `-ws(${isolation})`;
    }

    return "";
  }

  async auth() {
    log("Starting the authentication");

    // non authenticate state.
    this.proxyState = PROXY_STATE_UNAUTHENTICATED;

    // Let's do the authentication. This will generate a token that is going to
    // be used just to obtain the other ones.
    let refreshTokenData = await this.generateRefreshToken();
    if (!refreshTokenData) {
      log("No refresh token");
      await this.authFailure();
      return;
    }

    // Let's store the refresh token and let's invalidate all the other tokens
    // in order to regenerate them.
    await browser.storage.local.set({
      refreshTokenData,
      proxyTokenData: null,
      profileTokenData: null,
      profileData: null,
    });

    // Let's obtain the proxy token data
    if (!await this.maybeGenerateTokens()) {
      log("Token generation failed");
      await this.authFailure();
      return;
    }

    log("Authentication completed");

    // We are in an inactive state at this point.
    this.proxyState = PROXY_STATE_INACTIVE;

    // Let's enable the proxy.
    await this.enableProxy(true);
  }

  async generateRefreshToken() {
    log("generate refresh token");

    const fxaKeysUtil = new fxaCryptoRelier.OAuthUtils({
      contentServer: this.fxaEndpoints.get(FXA_ENDPOINT_ISSUER),
    });

    let refreshTokenData;
    // This will trigger the authentication form.
    try {
      refreshTokenData = await fxaKeysUtil.launchWebExtensionFlow(FXA_CLIENT_ID, {
        redirectUri: browser.identity.getRedirectURL(),
        scopes: [FXA_PROFILE_SCOPE, FXA_PROXY_SCOPE],
      });
    } catch (e) {
      log("refresh token generation failed: " + e);
    }

    return refreshTokenData;
  }

  async generateToken(refreshTokenData, scope, resource) {
    log("generate token - scope: " + scope);

    // See https://github.com/mozilla/fxa/blob/0ed71f677637ee5f817fa17c265191e952f5500e/packages/fxa-auth-server/fxa-oauth-server/docs/pairwise-pseudonymous-identifiers.md
    const ppid_seed = Math.floor(Math.random() * 1024);

    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const request = new Request(this.fxaEndpoints.get(FXA_ENDPOINT_TOKEN), {
      method: "POST",
      headers,
      body: JSON.stringify({
        /* eslint-disable camelcase*/
        client_id: FXA_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshTokenData.refresh_token,
        scope,
        ttl: FXA_EXP_TIME,
        ppid_seed,
        resource,
        /* eslint-enable camelcase*/
      })
    });

    const resp = await fetch(request);
    if (resp.status !== 200) {
      log("token generation failed: " + resp.status);
      return null;
    }

    let token = await resp.json();

    // Let's store when this token has been received.
    token.received_at = Math.round((performance.timeOrigin + performance.now()) / 1000);

    return token;
  }

  async generateProfileData(profileTokenData) {
    log("generate profile data");

    const headers = new Headers({
      "Authorization": `Bearer ${profileTokenData.access_token}`
    });

    const request = new Request(this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE), {
      method: "GET",
      headers,
    });

    const resp = await fetch(request);
    if (resp.status !== 200) {
      log("profile data generation failed: " + resp.status);
      return null;
    }

    return resp.json();
  }

  async fetchWellKnownData() {
    log("Fetching well-known data");

    // Let's fetch the data with a timeout of FETCH_TIMEOUT milliseconds.
    let json = await Promise.race([
      fetch(this.fxaOpenID).then(r => r.json(), e => null),
      new Promise(resolve => {
        setTimeout(_ => resolve(null), FETCH_TIMEOUT);
      }),
    ]);

    if (!json) {
      return false;
    }

    this.fxaEndpoints.set(FXA_ENDPOINT_PROFILE, json[FXA_ENDPOINT_PROFILE]);
    this.fxaEndpoints.set(FXA_ENDPOINT_TOKEN, json[FXA_ENDPOINT_TOKEN]);
    this.fxaEndpoints.set(FXA_ENDPOINT_ISSUER, json[FXA_ENDPOINT_ISSUER]);

    return true;
  }

  async maybeGenerateTokens() {
    log("maybe generate tokens");

    if (this.generatingTokens) {
      log("token generation in progress. Let's wait.");
      return new Promise(resolve => { this.postTokenGenerationOps.add(resolve); });
    }

    this.generatingTokens = true;
    const result = await this.maybeGenerateTokensInternal();
    this.generatingTokens = false;

    // Let's take all the ops and execute them.
    let ops = this.postTokenGenerationOps;
    this.postTokenGenerationOps = new Set();
    ops.forEach(value => value(result));

    return result;
  }

  async maybeGenerateTokensInternal() {
    let { refreshTokenData } = await browser.storage.local.get(["refreshTokenData"]);
    if (!refreshTokenData) {
      return false;
    }

    let proxyTokenData = await this.maybeGenerateSingleToken("proxyTokenData",
                                                             refreshTokenData,
                                                             FXA_PROXY_SCOPE,
                                                             this.proxyURL.href);
    if (proxyTokenData === false) {
      return false;
    }

    let profileTokenData = await this.maybeGenerateSingleToken("profileTokenData",
                                                               refreshTokenData,
                                                               FXA_PROFILE_SCOPE,
                                                               this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE));
    if (profileTokenData === false) {
      return false;
    }

    let { profileData } = await browser.storage.local.get(["profileData"]);
    // Let's obtain the profile data for the user.
    if (!profileData || profileTokenData.tokenGenerated) {
      profileData = await this.generateProfileData(profileTokenData.tokenData);
      if (!profileData) {
        return false;
      }
    }

    await browser.storage.local.set({
      proxyTokenData: proxyTokenData.tokenData,
      profileTokenData: profileTokenData.tokenData,
      profileData,
    });

    // Let's pick the min time diff.
    let minDiff = Math.min(proxyTokenData.minDiff, profileTokenData.minDiff);

    // Let's schedule the token rotation.
    this.tokenGenerationTimeout = setTimeout(async _ => {
      if (!await this.maybeGenerateTokens()) {
        log("token generation failed");
        await this.authFailure();
      }
    }, minDiff * 1000);

    // Let's cache the header.
    this.proxyAuthorizationHeader = proxyTokenData.tokenData.token_type + " " + proxyTokenData.tokenData.access_token;

    this.nextExpireTime = Math.min(proxyTokenData.tokenData.received_at + proxyTokenData.tokenData.expires_in,
                                   profileTokenData.tokenData.received_at + profileTokenData.tokenData.expires_in);

    return true;
  }

  async maybeGenerateSingleToken(tokenName, refreshTokenData, scope, resource) {
    log(`maybe generate token:  ${tokenName}`);

    let minDiff = 0;
    let tokenGenerated = false;

    let now = performance.timeOrigin + performance.now();
    let nowInSecs = Math.round(now / 1000);

    let data = await browser.storage.local.get([tokenName]);
    let tokenData = data[tokenName];
    if (tokenData) {
      // If we are close to the expiration time, we have to generate the token.
      // We want to keep a big time margin: 1 hour seems good enough.
      let diff = tokenData.received_at + tokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      if (diff < EXPIRE_DELTA) {
        log("token exists but it's expired.");
        tokenData = null;
      } else {
        log(`token expires in ${minDiff}`);
        minDiff = diff;
      }
    }

    if (!tokenData) {
      log("generating token");
      tokenData = await this.generateToken(refreshTokenData, scope, resource);
      if (!tokenData) {
        return false;
      }

      minDiff = tokenData.received_at + tokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      log(`token expires in ${minDiff}`);
      tokenGenerated = true;
    }

    return {
      minDiff,
      tokenData,
      tokenGenerated,
    };
  }

  async authFailure() {
    this.proxyState = PROXY_STATE_AUTHFAILURE;
    await browser.storage.local.set({
      proxyState: this.proxyState,
      refreshTokenData: null,
      proxyTokenData: null,
      profileTokenData: null,
      profileData: null,
    });
  }

  async panelConnected(port) {
    log("Panel connected");

    // Overwrite any existing port. We want to talk with 1 single popup.
    this.currentPort = port;

    // Let's send the initial data.
    port.onMessage.addListener(async message => {
      log("Message received from the panel", message);

      switch (message.type) {
        case "setEnabledState":
          await this.enableProxy(message.data.enabledState);
          break;

        case "removeExemptTab":
          // port.sender.tab doesn't exist for browser actions
          const currentTab = await this.getCurrentTab();
          if (currentTab) {
            this.removeExemptTab(currentTab.id);
            this.updateUI();
          }
          break;

        case "authenticate":
          await this.auth();
          break;

        case "goBack":
          this.updateUI();
          break;

        case "manageAccount":
          this.manageAccount();
          break;

        case "helpAndSupport":
          this.formatAndOpenURL(HELP_AND_SUPPORT_URL);
          break;

        case "learnMore":
          this.formatAndOpenURL(LEARN_MORE_URL);
          break;

        case "privacyPolicy":
          this.openUrl(PRIVACY_POLICY_URL);
          break;

        case "termsAndConditions":
          this.openUrl(TERMS_AND_CONDITIONS_URL);
          break;

        case "openUrl":
          this.openUrl(message.data.url);
          break;
      }
    });

    port.onDisconnect.addListener(_ => {
      log("Panel disconnected");
      this.currentPort = null;
    });

    await this.sendDataToCurrentPort();
  }

  async sendDataToCurrentPort() {
    log("Update the panel: ", this.currentPort);
    if (this.currentPort) {
      let exempt = await this.isCurrentTabExempt();
      let { profileData } = await browser.storage.local.get(["profileData"]);

      return this.currentPort.postMessage({
        userInfo: profileData,
        proxyState: this.proxyState,
        exempt,
      });
    }
    return null;
  }

  async onConnectivityChanged(connectivity) {
    this.connectionId += 1;
    log("connectivity changed!");

    // Offline -> online.
    if ((this.proxyState === PROXY_STATE_OFFLINE) && connectivity) {
      await this.run();
    }
  }

  async manageAccount() {
    let contentServer = this.fxaEndpoints.get(FXA_ENDPOINT_ISSUER);
    let { profileData } = await browser.storage.local.get(["profileData"]);
    let url = new URL(contentServer + "/settings");
    url.searchParams.set("uid", profileData.uid);
    url.searchParams.set("email", profileData.email);
    this.openUrl(url.href);
  }

  async formatAndOpenURL(url) {
    this.openUrl(await browser.experiments.proxyutils.formatURL(url));
  }

  openUrl(url) {
    browser.tabs.create({url});
  }

  async hasProxyInUse() {
    let proxySettings = await browser.proxy.settings.get({});
    return ["manual", "autoConfig", "autoDetect"].includes(proxySettings.value.proxyType);
  }

  maybeStoreUsageDays() {
    if (this.lastUsageDaysPending) {
      return;
    }

    const options = { year: "numeric", month: "2-digit", day: "2-digit" };
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", options).format;

    let now = dateTimeFormat(Date.now());
    if (this.lastUsageDays.date === now) {
      return;
    }

    this.lastUsageDaysPending = true;
    this.lastUsageDays.date = now;
    this.lastUsageDays.count += 1;

    browser.storage.local.set({lastUsageDays: this.lastUsageDays})
           .then(_ => { this.lastUsageDaysPending = false; });
  }

  async proxyStatus() {
    let self = await browser.management.getSelf();
    return {
      proxyEnabled: this.proxyState === PROXY_STATE_ACTIVE,
      version: self.version,
      usageDays: this.lastUsageDays.count,
    };
  }

  connectionSucceeded() {
    this.afterConnectionSteps();
    this.proxyState = PROXY_STATE_ACTIVE;
    this.informContentScripts();
    this.updateUI();
  }

  afterConnectionSteps() {
    // We need to exclude FxA endpoints in order to avoid a deadlock:
    // 1. a new request is processed, but the tokens are invalid. We start the
    //    generation of a new token.
    // 2. The generation of tokens starts a new network request which will be
    //    processed as the previous point. This is deadlock.
    let excludedDomains = [ this.proxyHost ];
    [FXA_ENDPOINT_PROFILE, FXA_ENDPOINT_TOKEN, FXA_ENDPOINT_ISSUER].forEach(e => {
      try {
        excludedDomains.push(new URL(this.fxaEndpoints.get(e)).hostname);
      } catch (e) {}
    });

    browser.experiments.proxyutils.DNSoverHTTP.set({
      value: {
        mode: DOH_MODE,
        bootstrapAddress: DOH_BOOTSTRAP_ADDRESS,
        excludedDomains: excludedDomains.join(","),
      }
    });

    browser.experiments.proxyutils.FTPEnabled.set({value: false});
  }

  inactiveSteps() {
    browser.experiments.proxyutils.DNSoverHTTP.clear({});
    browser.experiments.proxyutils.FTPEnabled.clear({});
  }

  contentScriptConnected(port) {
    log("content-script connected");

    this.contentScriptPorts.set(port.sender.tab.id, port);
    // Let's inform the new port about the current state.
    this.contentScriptNotify(port);

    port.onDisconnect.addListener(_ => {
      log("content-script port disconnected");
      this.contentScriptPorts.delete(port.sender.tab.id);
    });
  }

  contentScriptNotify(p) {
    const exempted = this.exemptTabStatus.get(p.sender.tab.id);
    p.postMessage({type: "proxyState", enabled: this.proxyState === PROXY_STATE_ACTIVE, exempted});
  }

  informContentScripts() {
    this.contentScriptPorts.forEach(p => {
      this.contentScriptNotify(p);
    });
  }
}

let background = new Background();
background.init().then(_ => background.run());
