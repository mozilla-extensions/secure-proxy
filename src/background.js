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
const FXA_EXP_TIME = 21600 // 6 hours

// Used to see if HTTP errors are actually valid. See the comment in
// browser.webRequest.onCompleted.
const SAFE_HTTPS_REQUEST = "https://www.mozilla.org/robots.txt";
const CONNECTING_HTTPS_REQUEST = "https://www.mozilla.org/robots.txt";

// Proxy configuration
const PROXY_URL = "https://proxy-staging.cloudflareclient.com:8001";

// How early we want to re-generate the tokens (in secs)
const EXPIRE_DELTA = 3600

// These URLs must be formatted
const LEARN_MORE_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/cloudflare";
const HELP_AND_SUPPORT_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/firefox-private-network"

// These URLs do not need to be formatted
const PRIVACY_POLICY_URL = "https://www.mozilla.org/privacy/firefox-private-network";
const TERMS_AND_CONDITIONS_URL = "https://www.mozilla.org/about/legal/terms/firefox-private-network";

// Parameters for DNS over HTTP
const DOH_MODE = 3;
const DOH_BOOTSTRAP_ADDRESS = "1.1.1.1"

// If run() fails, it will be retriggered after this timeout (in milliseconds)
const RUN_TIMEOUT = 5000; // 5 secs
const FETCH_TIMEOUT = 10000; // 10 secs

// Enable debugging
let debuggingMode = false;
function log(msg) {
  if (debuggingMode) {
    console.log("*** Background.js *** - " + msg);
  }
}

class Background {
  constructor() {
    log("constructor");

    this.survey = new Survey();
    this.fxaEndpoints = new Map();
    this.pendingErrorFetch = false;
    this.proxyState = PROXY_STATE_UNAUTHENTICATED;
    this.webSocketConnectionIsolationCounter = 0;
  }

  async init() {
    const prefs = await browser.experiments.proxyutils.getProxyPrefs();
    debuggingMode = prefs.debuggingEnabled;

    log("init");

    this.fxaOpenID = prefs.fxaURL || FXA_OPENID;

    let proxyURL = new URL(prefs.proxyURL || PROXY_URL);
    this.proxyType = proxyURL.protocol == "https:" ? "https" : "http";
    this.proxyPort = proxyURL.port || (proxyURL.protocol == "https:" ? 443 : 80);
    this.proxyHost = proxyURL.hostname;

    try {
      const capitivePortalUrl = new URL(prefs.captiveDetect);
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

    // Proxy configuration
    browser.proxy.onRequest.addListener((requestInfo) => this.proxyRequestCallback(requestInfo),
                                        {urls: ["<all_urls>"]});

    // Handle header errors before we render the response
    browser.webRequest.onHeadersReceived.addListener(details => {
      if (this.proxyState == PROXY_STATE_OFFLINE) {
        return;
      }

      // We can receive http error status codes onCompleted if the connection is
      // a plain/text (HTTP, no HTTPS). In case they are proxy errors (such as
      // 407 or 429), we cannot trust them, because it's too easy for a web
      // server to send them. Instead, we fetch a HTTPS request. If the proxy is
      // blocking us for real, we will receive the same status code in
      // onErrorOccurred.
      if (details.statusCode == 407 || details.statusCode == 429) {
        this.processPotentialNetworkError();
      }

      // The proxy returns errors that are warped which we should show a real looking error page for
      // These only occur over http and we can't really handle sub resources
      if ([502, 407, 429].includes(details.statusCode) &&
          details.tabId &&
          details.type == "main_frame" &&
          details.responseHeaders.find((header) => {
            return header.name == "cf-warp-error" && header.value == 1;
          })) {
        browser.experiments.proxyutils.loadNetError(details.statusCode, details.url, details.tabId);
        return {cancel: true};
      }
    }, {urls: ["http://*/*"]}, ["responseHeaders", "blocking"]);

    browser.webRequest.onHeadersReceived.addListener(details => {
      if (this.proxyState == PROXY_STATE_CONNECTING &&
          details.statusCode == 200) {
        this.connectionSucceeded();
      }
    }, {urls: [CONNECTING_HTTPS_REQUEST]}, ["responseHeaders", "blocking"]);

    browser.webRequest.onErrorOccurred.addListener(details => {
      this.processNetworkError(details.error);
    }, {urls: ["<all_urls>"]});


    // proxy setting change observer
    browser.experiments.proxyutils.onChanged.addListener(async _ => {
      let hasChanged = await this.computeProxyState();
      if (hasChanged) {
        this.updateUI();
      }
    });

    browser.runtime.onConnect.addListener(port => {
      this.panelConnected(port);
    });

    window.addEventListener('online', _ => this.onConnectivityChanged());
    window.addEventListener('offline', _ => this.onConnectivityChanged());

    // Let's initialize the survey object.
    await this.survey.init(this);
  }

  async run() {
    if (this.fxaEndpoints.size === 0) {
      this.proxyState = PROXY_STATE_LOADING;
      // Let's fetch the well-known data.
      let wellKnownData = await this.fetchWellKnownData();
      if (!wellKnownData) {
        this.proxyState = PROXY_STATE_OFFLINE;
        this.updateUI();

        setTimeout(_ => this.run(), RUN_TIMEOUT);
        return;
      }
    }
    this.proxyState = PROXY_STATE_UNAUTHENTICATED;
    this.updateUI();

    // Here we generate the current proxy state.
    await this.computeProxyState();

    // UI
    this.updateUI();
  }

  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }

  processNetworkError(errorStatus) {
    log("processNetworkError: " + errorStatus);

    if (this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return;
    }

    if (errorStatus == "NS_ERROR_PROXY_AUTHENTICATION_FAILED") {
      this.proxyState = PROXY_STATE_PROXYAUTHFAILED;
      this.updateUI();
      this.maybeGenerateTokens();
      return;
    }

    if (errorStatus == "NS_ERROR_PROXY_CONNECTION_REFUSED" ||
        errorStatus == "NS_ERROR_TOO_MANY_REQUESTS") {
      this.proxyState = PROXY_STATE_PROXYERROR;
      this.updateUI();
      return;
    }
  }

  processPotentialNetworkError() {
    log("processPotentialNetworkError");

    if (this.pendingErrorFetch) {
      return;
    }

    log("processPotentialNetworkError - fetch starting");

    this.pendingErrorFetch = true;
    fetch(SAFE_HTTPS_REQUEST, { cache: "no-cache"}).catch(_ => {}).then(_ => {
      setTimeout(() => {
        // let's wait 5 seconds before running another fetch.
        this.pendingErrorFetch = false;
        log("processPotentialNetworkError - accepting next potential error");
      }, 5000);
    });
  }

  showStatusPrompt() {
    // No need to show the toast if the panel is visible.
    if (this.currentPort) {
      return;
    }

    let promptNotice;
    let isWarning = false;
    switch(this.proxyState) {
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

    // We are offline.
    if (!navigator.onLine || this.fxaEndpoints.size === 0) {
      this.proxyState = PROXY_STATE_OFFLINE;
    }

    // We want to keep these states.
    let currentState = this.proxyState;
    if (currentState !== PROXY_STATE_AUTHFAILURE &&
        currentState !== PROXY_STATE_PROXYERROR &&
        currentState !== PROXY_STATE_PROXYAUTHFAILED &&
        currentState !== PROXY_STATE_OFFLINE) {
      this.proxyState = PROXY_STATE_UNAUTHENTICATED;
    }

    // Something else is in use.
    let otherProxyInUse = await this.hasProxyInUse();
    if (otherProxyInUse) {
      this.proxyState = PROXY_STATE_OTHERINUSE;
    }

    // All seems good. Let's see if the proxy should enabled.
    if (this.proxyState == PROXY_STATE_UNAUTHENTICATED) {
      let { proxyState } = await browser.storage.local.get(["proxyState"]);
      if (proxyState == PROXY_STATE_INACTIVE) {
        this.proxyState = PROXY_STATE_INACTIVE;
      } else if ((await this.maybeGenerateTokens())) {
        this.proxyState = PROXY_STATE_CONNECTING;
        this.testProxyConnection();
      }
    }

    // If we are here we are not active yet. At least we are connecting.
    // Restore default settings.
    if (currentState != this.proxyState) {
      this.inactiveSteps();
      this.reloadOrDiscardTabs();
    }

    log("computing status - final: " + this.proxyState);
    return currentState != this.proxyState;
  }

  /**
   * Behaviour mostly copied from reloadAllOtherTabs in Firefox code.
   * Selects all tabs that aren't already discarded, also ignoring pinned tabs
   * as we would like to always refresh pinned tabs.
   * Firefox won't discard the selected tab so after that we refresh all tabs
   *  that aren't discarded already.
   */
  async reloadOrDiscardTabs() {
    let regularTabs = await browser.tabs.query({discarded: false, pinned: false});
    let reloadTabIds = regularTabs.map(tab => tab.id);
    await browser.tabs.discard(reloadTabIds);

    let nonDiscardedTabs = await browser.tabs.query({discarded: false});
    nonDiscardedTabs.forEach(tab => {
      browser.tabs.reload(tab.id);
    });
  }

  async enableProxy(value) {
    log("enabling proxy: " + value);

    // We support the changing of proxy state only from some states.
    if (this.proxyState != PROXY_STATE_UNAUTHENTICATED &&
        this.proxyState != PROXY_STATE_ACTIVE &&
        this.proxyState != PROXY_STATE_INACTIVE &&
        this.proxyState != PROXY_STATE_CONNECTING) {
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
    fetch(CONNECTING_HTTPS_REQUEST, { cache: "no-cache"}).catch(_ => {});
  }

  updateUI() {
    log("update UI");

    this.showStatusPrompt();
    this.updateIcon();
    this.sendDataToCurrentPort();
  }

  updateIcon() {
    let icon;
    if (this.proxyState === PROXY_STATE_INACTIVE ||
        this.proxyState === PROXY_STATE_CONNECTING ||
        this.proxyState === PROXY_STATE_OFFLINE) {
      icon = "img/badge_off.svg";
    } else if (this.proxyState === PROXY_STATE_ACTIVE) {
      icon = "img/badge_on.svg";
    } else {
      icon = "img/badge_warning.svg";
    }

    browser.browserAction.setIcon({
      path: icon,
    });

    log("update icon: " + icon);
  }

  proxyRequestCallback(requestInfo) {
    let shouldProxyRequest = this.shouldProxyRequest(requestInfo);
    let additionalConnectionIsolation = this.additionalConnectionIsolation(requestInfo);

    log("proxy request for " + requestInfo.url + " => " + shouldProxyRequest);

    if (shouldProxyRequest) {
      return [{
        type: this.proxyType,
        host: this.proxyHost,
        port: this.proxyPort,
        proxyAuthorizationHeader: this.proxyAuthorizationHeader,
        connectionIsolationKey: this.proxyAuthorizationHeader + additionalConnectionIsolation,
      }];
    }

    return {type: "direct"};
  }

  /**
   * Decides if we should be proxying the request.
   * Returns true if the request should be proxied
   * Returns null if the request is internal and shouldn't count.
   */
  shouldProxyRequest(requestInfo) {
    function isProtocolSupported(url) {
      return url.protocol == "http:" ||
             url.protocol == "https:" ||
             url.protocol == "ftp:" ||
             url.protocol == "wss:" ||
             url.protocol == "ws:";
    }

    function isLocal(url) {
      if (url.hostname == "localhost" ||
          url.hostname == "localhost.localdomain" ||
          url.hostname == "localhost6" ||
          url.hostname == "localhost6.localdomain6") {
        return true;
      }
      const localports = /(^127\.)|(^192\.168\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^::1$)|(^[fF][cCdD])/;
      if (localports.test(url.hostname)) {
        return true;
      }
      return false;
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

    // If we are 'connecting', we want to allow just the CONNECTING_HTTPS_REQUEST.
    if (this.proxyState === PROXY_STATE_CONNECTING) {
      return requestInfo.url === CONNECTING_HTTPS_REQUEST;
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
      return new URL(item).origin == url.origin;
    });
    if (isAuthUrl) {
      return false;
    }

    this.maybeStoreUsageDays();
    return true;
  }

  additionalConnectionIsolation(requestInfo) {
    function isWebsocket(url) {
      return url.protocol == "wss:" || url.protocol == "ws:";
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

  async generateToken(refreshTokenData, scope) {
    log("generate token - scope: " + scope);

    // See https://github.com/mozilla/fxa/blob/0ed71f677637ee5f817fa17c265191e952f5500e/packages/fxa-auth-server/fxa-oauth-server/docs/pairwise-pseudonymous-identifiers.md
    const ppid_seed = Math.floor(Math.random() * 1024);

    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const request = new Request(this.fxaEndpoints.get(FXA_ENDPOINT_TOKEN), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        /* eslint-disable camelcase*/
        client_id: FXA_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshTokenData.refresh_token,
        scope: scope,
        ttl: FXA_EXP_TIME,
        ppid_seed,
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
      'Authorization': `Bearer ${profileTokenData.access_token}`
    });

    const request = new Request(this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE), {
      method: 'GET',
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

    let { refreshTokenData } = await browser.storage.local.get(["refreshTokenData"]);
    if (!refreshTokenData) {
      return false;
    }

    let proxyTokenData = await this.maybeGenerateToken("proxyTokenData", refreshTokenData, FXA_PROXY_SCOPE);
    if (proxyTokenData === false) {
      return false;
    }

    let profileTokenData = await this.maybeGenerateToken("profileTokenData", refreshTokenData, FXA_PROFILE_SCOPE);
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

    return true;
  }

  async maybeGenerateToken(tokenName, refreshTokenData, scope) {
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
        tokenData = null;
      } else {
        minDiff = diff;
      }
    }

    if (!tokenData) {
      tokenData = await this.generateToken(refreshTokenData, scope);
      if (!tokenData) {
        return false;
      }

      minDiff = tokenData.received_at + tokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      tokenGenerated = true;
    }

    return {
      minDiff,
      tokenData,
      tokenGenerated,
    }
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
      log("Message received from the panel");

      switch (message.type) {
        case "setEnabledState":
          await this.enableProxy(message.data.enabledState);
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
    log("Update the panel: " + this.currentPort);

    if (this.currentPort) {
      let { profileData } = await browser.storage.local.get(["profileData"]);

      return this.currentPort.postMessage({
        userInfo: profileData,
        proxyState: this.proxyState,
      });
    }
  }

  async onConnectivityChanged() {
    log("connectivity changed!");
    await this.run();
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
    browser.tabs.create({url})
  }

  async hasProxyInUse() {
    let proxySettings = await browser.proxy.settings.get({});
    return ["manual", "autoConfig", "autoDetect"].includes(proxySettings.value.proxyType);
  }

  maybeStoreUsageDays() {
    if (this.lastUsageDaysPending) {
      return;
    }

    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateTimeFormat = new Intl.DateTimeFormat('en-US', options).format;

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
      proxyEnabled: this.proxyState == PROXY_STATE_ACTIVE,
      version: self.version,
      usageDays: this.lastUsageDays.count,
    }
  }

  connectionSucceeded() {
    this.afterConnectionSteps();
    this.proxyState = PROXY_STATE_ACTIVE;
    this.updateUI();
  }

  afterConnectionSteps() {
    browser.privacy.network.peerConnectionEnabled.set({ value: false });

    browser.experiments.proxyutils.DNSoverHTTPEnabled.set({value: DOH_MODE});
    browser.experiments.proxyutils.DNSoverHTTPBootstrapAddress.set({value: DOH_BOOTSTRAP_ADDRESS});
    browser.experiments.proxyutils.DNSoverHTTPExcludeDomains.set({value: this.proxyHost});

    browser.experiments.proxyutils.FTPEnabled.set({value: false});
  }

  inactiveSteps() {
    browser.privacy.network.peerConnectionEnabled.clear({});

    browser.experiments.proxyutils.DNSoverHTTPEnabled.clear({});
    browser.experiments.proxyutils.DNSoverHTTPBootstrapAddress.clear({});
    browser.experiments.proxyutils.DNSoverHTTPExcludeDomains.clear({});

    browser.experiments.proxyutils.FTPEnabled.clear({});
  }
}

let background = new Background();
background.init().then(_ => background.run());
