// TODO whilst the proxy is enabled set media.peerconnection.enabled to false.

// Read pref for captive portal and disable.

const FXA_OPENID = "https://stomlinson.dev.lcip.org/.well-known/openid-configuration";

const FXA_ENDPOINT_PROFILE = "userinfo_endpoint";
const FXA_ENDPOINT_TOKEN = "token_endpoint";
const FXA_ENDPOINT_ISSUER = "issuer";

const FXA_PROFILE_SCOPE = "profile";
const FXA_PROXY_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";
const FXA_CLIENT_ID = "a8c528140153d1c6";
const FXA_EXP_TIME = 21600 // 6 hours

// Used to see if HTTP errors are actually valid. See the comment in
// browser.webRequest.onCompleted.
const SAFE_HTTPS_REQUEST = "https://www.mozilla.org/robots.txt";
const CONNECTING_HTTPS_REQUEST = "https://www.mozilla.org/robots.txt";

// Proxy configuration
const PROXY_TYPE = "https";
const PROXY_HOST = "proxy-staging.cloudflareclient.com";
const PROXY_PORT = 8001;

// How early we want to re-generate the tokens (in secs)
const EXPIRE_DELTA = 3600

// Enable debugging
const DEBUGGING = true
function log(msg) {
  if (DEBUGGING) {
    console.log("*** Background.js *** - " + msg);
  }
}

class Background {
  constructor() {
    log("constructor");

    this.survey = new Survey();
    this.fxaEndpoints = new Map();
    this.pendingErrorFetch = false;
    this.proxyState = PROXY_STATE_UNKNOWN;
  }

  async init() {
    log("init");

    // I don't think the extension will ever control this, however it's worth exempting in case.
    this.CAPTIVE_PORTAL_URL = await browser.experiments.proxyutils.getCaptivePortalURL();

    // Proxy configuration
    browser.proxy.onRequest.addListener((requestInfo) => this.proxyRequestCallback(requestInfo),
                                        {urls: ["<all_urls>"]}, ["requestHeaders"]);

    // We can receive http error status codes onCompleted if the connection is
    // a plain/text (HTTP, no HTTPS). In case they are proxy errors (such as
    // 407 or 429), we cannot trust them, because it's too easy for a web
    // server to send them. Instead, we fetch a HTTPS request. If the proxy is
    // blocking us for real, we will receive the same status code in
    // onErrorOccurred.
    browser.webRequest.onCompleted.addListener(details => {
      if (this.proxyState == PROXY_STATE_OFFLINE) {
        return;
      }

      if (details.statusCode == 407 || details.statusCode == 429) {
        this.processPotentialNetworkError();
      }

      if (this.proxyState == PROXY_STATE_CONNECTING &&
          details.statusCode == 200) {
        this.proxyState = PROXY_STATE_ACTIVE;
        this.updateUI();
      }
    }, {urls: ["<all_urls>"]});

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
    await this.survey.init();
  }

  async run() {
    this.proxyState = PROXY_STATE_UNKNOWN;

    // Let's fetch the well-known data.
    if (this.fxaEndpoints.size === 0 &&
        !await this.fetchWellKnownData()) {
      this.proxyState = PROXY_STATE_OFFLINE;
      this.updateUI();
      return;
    }

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
    switch(this.proxyState) {
      case PROXY_STATE_INACTIVE:
        promptNotice = "notProxied";
        break;

      case PROXY_STATE_ACTIVE:
        promptNotice = "isProxied";
        break;

      case PROXY_STATE_OTHERINUSE:
        promptNotice = "otherProxy";
        break;

      case PROXY_STATE_PROXYERROR:
        promptNotice = "proxyError";
        break;

      case PROXY_STATE_PROXYAUTHFAILED:
        promptNotice = "proxyAuthFailed";
        break;

      default:
        // no message.
        break;
    }

    if (promptNotice) {
      browser.experiments.proxyutils.showPrompt(browser.i18n.getMessage(promptNotice));
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

    // We want to keep these states.
    let currentState = this.proxyState;
    if (currentState !== PROXY_STATE_AUTHFAILURE &&
        currentState !== PROXY_STATE_PROXYERROR &&
        currentState !== PROXY_STATE_PROXYAUTHFAILED &&
        currentState !== PROXY_STATE_OFFLINE) {
      this.proxyState = PROXY_STATE_UNKNOWN;
    }

    // Something else is in use.
    let otherProxyInUse = await browser.experiments.proxyutils.hasProxyInUse();
    if (otherProxyInUse) {
      this.proxyState = PROXY_STATE_OTHERINUSE;
    }

    // All seems good. Let's see if the proxy should enabled.
    if (this.proxyState == PROXY_STATE_UNKNOWN) {
      let { proxyState } = await browser.storage.local.get(["proxyState"]);
      if (proxyState == PROXY_STATE_INACTIVE) {
        this.proxyState = PROXY_STATE_INACTIVE;
      } else if ((await this.maybeGenerateTokens())) {
        this.proxyState = PROXY_STATE_CONNECTING;
        this.testProxyConnection();
      }
    }

    log("computing status - final: " + this.proxyState);
    return currentState != this.proxyState;
  }

  async enableProxy(value) {
    log("enabling proxy: " + value);

    // We support the changing of proxy state only from some states.
    if (this.proxyState != PROXY_STATE_UNKNOWN &&
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

    log("proxy request for " + requestInfo.url + " => " + shouldProxyRequest);

    if (shouldProxyRequest) {
      return [{
        type: PROXY_TYPE,
        host: PROXY_HOST,
        port: PROXY_PORT,
        proxyAuthorizationHeader: this.proxyAuthorizationHeader,
        connectionIsolationKey: this.proxyAuthorizationHeader,
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
             url.protocol == "ftp:";
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

    if (this.proxyState !== PROXY_STATE_ACTIVE &&
        this.proxyState !== PROXY_STATE_CONNECTING) {
      return false;
    }

    // If we are 'connecting', we want to allow just the CONNECTING_HTTPS_REQUEST.
    if (this.proxyState === PROXY_STATE_CONNECTING) {
      return requestInfo.url === CONNECTING_HTTPS_REQUEST;
    }

    if (this.CAPTIVE_PORTAL_URL === requestInfo.url) {
      return false;
    }

    // Internal requests, TODO verify is correct: https://github.com/jonathanKingston/secure-proxy/issues/3
    // Verify originUrl is never undefined in normal content
    if (requestInfo.originUrl === undefined &&
        requestInfo.frameInfo === 0) {
      return false;
    }

    // Just to avoid recreating the URL several times, let's cache it.
    const url = new URL(requestInfo.url);

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
      FXA_OPENID,
      this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE),
      this.fxaEndpoints.get(FXA_ENDPOINT_TOKEN),
    ];
    let isAuthUrl = authUrls.some((item) => {
      return new URL(item).origin == url.origin;
    });
    if (isAuthUrl) {
      return false;
    }

    return true;
  }

  async auth() {
    log("Starting the authentication");

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

    let json = await fetch(FXA_OPENID).then(r => r.json(), e => null);
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

    let now = performance.timeOrigin + performance.now();
    let nowInSecs = Math.round(now / 1000);

    let minProxyDiff = 0;
    let minProfileDiff = 0;

    let { proxyTokenData } = await browser.storage.local.get(["proxyTokenData"]);
    if (proxyTokenData) {
      // If we are close to the expiration time, we have to generate the token.
      // We want to keep a big time margin: 1 hour seems good enough.
      let diff = proxyTokenData.received_at + proxyTokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      if (diff < EXPIRE_DELTA) {
        proxyTokenData = null;
      } else {
        minProxyDiff = diff;
      }
    }

    if (!proxyTokenData) {
      proxyTokenData = await this.generateToken(refreshTokenData, FXA_PROXY_SCOPE);
      if (!proxyTokenData) {
        return false;
      }

      minProxyDiff = proxyTokenData.received_at + proxyTokenData.expires_in - nowInSecs - EXPIRE_DELTA;
    }

    let profileTokenGenerated = false;

    let { profileTokenData } = await browser.storage.local.get(["profileTokenData"]);
    if (profileTokenData) {
      // diff - EXPIRE_DELTA
      let diff = profileTokenData.received_at + profileTokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      if (diff < EXPIRE_DELTA) {
        profileTokenData = null;
      } else {
        minProfileDiff = diff;
      }
    }

    if (!profileTokenData) {
      profileTokenData = await this.generateToken(refreshTokenData, FXA_PROFILE_SCOPE);
      if (!profileTokenData) {
        return false;
      }

      profileTokenGenerated = true;

      minProfileDiff = profileTokenData.received_at + profileTokenData.expires_in - nowInSecs - EXPIRE_DELTA;
    }

    let { profileData } = await browser.storage.local.get(["profileData"]);
    // Let's obtain the profile data for the user.
    if (!profileData || profileTokenGenerated) {
      profileData = await this.generateProfileData(profileTokenData);
      if (!profileData) {
        return false;
      }
    }

    await browser.storage.local.set({proxyTokenData, profileTokenData, profileData});

    // Let's pick the min time diff.
    let minDiff = Math.min(minProxyDiff, minProfileDiff);

    // Let's schedule the token rotation.
    this.tokenGenerationTimeout = setTimeout(async _ => {
      if (!await this.maybeGenerateTokens()) {
        log("token generation failed");
        await this.authFailure();
      }
    }, minDiff);

    // Let's cache the header.
    this.proxyAuthorizationHeader = proxyTokenData.token_type + " " + proxyTokenData.access_token;

    // TODO: cloudflare doesn't accept our token yet...
    this.proxyAuthorizationHeader = "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IkNGVEVTVCJ9.eyJleHAiOjE1NjI4NTYxODAsImlzcyI6InN0YWdpbmcifQ.ROI-75EonHpPsprYXlTnswm2vSmNIN0NmFlsT7zhAGwSB_6r4yTlndpEDnr3s-VBm-Dd3OBIBSMbYqCT1q_jky6ow1faDoCGmXc8UbzB0rZToT5ppIPl0lpWRD5-H-wYzV_Ld3he4uZJLQgcqtHRZUl9XbqNOIi5bSzqtoWG_uiXd-iKaK35SdQ4v0q2ZAEfamgNvWcbEjMEdifDLx47rvirp2L0V3VQxACxjsO8zkNokYVMSfQaPaZG-6ezTTZtes6QiRvGx-AeHspEfWBT-Xl8r68P_yKTgxxG-vdorVkNpOlnMzDOHCPjpS1yODUx844MbhQU1MSgb5X5_lV66g";

    return true;
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

        case "survey":
          await this.survey.runSurvey(message.data.survey);
          break;

        case "goBack":
          this.updateUI();
          break;

        case "manageAccount":
          this.manageAccount();
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
      let nextSurvey = await this.survey.nextSurvey();

      return this.currentPort.postMessage({
        userInfo: profileData,
        proxyState: this.proxyState,
        pendingSurvey: nextSurvey ? nextSurvey.name : null,
      });
    }
  }

  async onConnectivityChanged() {
    if (navigator.onLine) {
      log("We are online!");
      await this.run();
    } else {
      log("We are offline!");
      this.proxyState = PROXY_STATE_OFFLINE;
      this.updateUI();
    }
  }

  manageAccount() {
    let contentServer = this.fxaEndpoints.get(FXA_ENDPOINT_ISSUER);
    browser.tabs.create({
      url: contentServer + "/settings",
    })
  }
}

let background = new Background();
background.init();
background.run();
