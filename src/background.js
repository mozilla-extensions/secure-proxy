// TODO whilst the proxy is enabled set media.peerconnection.enabled to false.

// Read pref for captive portal and disable.

const FXA_OPENID = "https://stomlinson.dev.lcip.org/.well-known/openid-configuration";

const FXA_ENDPOINT_PROFILE = "userinfo_endpoint";
const FXA_ENDPOINT_TOKEN = "token_endpoint";
const FXA_ENDPOINT_ISSUER = "issuer";

const FXA_PROFILE_SCOPE = "profile";
const FXA_PROXY_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";
const FXA_CLIENT_ID = "a8c528140153d1c6";

// Used to see if HTTP errors are actually valid. See the comment in
// browser.webRequest.onCompleted.
const SAFE_HTTPS_REQUEST = "https://www.mozilla.org/robots.txt";

// Proxy configuration
const PROXY_TYPE = "https";
const PROXY_HOST = "proxy-staging.cloudflareclient.com";
const PROXY_PORT = 8001;

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
  }

  async init() {
    log("init");

    await this.fetchWellKnownData();

    // Basic configuration
    await this.computeProxyState();

    // I don't think the extension will ever control this, however it's worth exempting in case.
    this.CAPTIVE_PORTAL_URL = await browser.experiments.proxyutils.getCaptivePortalURL();

    // Message handler
    browser.runtime.onMessage.addListener((m, s, r) => this.messageHandler(m, s, r));

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
      if (details.statusCode == 407 || details.statusCode == 429) {
        this.processPotentialNetworkError();
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

    // Let's initialize the survey object.
    await this.survey.init();

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

    if (this.proxyState != PROXY_STATE_ACTIVE) {
      return;
    }

    if (errorStatus == "NS_ERROR_PROXY_AUTHENTICATION_FAILED") {
      this.proxyState = PROXY_STATE_PROXYAUTHFAILED;
      this.updateUI();
      this.runTokenRotation();
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

    let currentState = this.proxyState;
    if (currentState !== PROXY_STATE_AUTHFAILURE) {
      this.proxyState = PROXY_STATE_UNKNOWN;
    }

    // We want to keep these states.
    if (currentState == PROXY_STATE_PROXYERROR ||
        currentState == PROXY_STATE_PROXYAUTHFAILED) {
      this.proxyState = currentState;
    }

    // Something else is in use.
    let otherProxyInUse = await browser.experiments.proxyutils.hasProxyInUse();
    if (otherProxyInUse) {
      this.proxyState = PROXY_STATE_OTHERINUSE;
    }

    if (this.proxyState == PROXY_STATE_UNKNOWN &&
        await this.hasValidProfile()) {
      // The proxy is active by default. If proxyState contains a invalid
      // value, we still want the proxy to be active.
      this.proxyState = PROXY_STATE_ACTIVE;
      let { proxyState } = await browser.storage.local.get(["proxyState"]);
      if (proxyState == PROXY_STATE_INACTIVE) {
        this.proxyState = PROXY_STATE_INACTIVE;
      }

      if (this.proxyState == PROXY_STATE_ACTIVE) {
        await this.cacheHeaderAndScheduleTokenRotation();
      }
    }

    log("computing status - final: " + this.proxyState);
    return currentState != this.proxyState;
  }

  // Our message handler
  async messageHandler(message, sender, response) {
    log("messageHandler - " + message.type);

    switch (message.type) {
      case "initInfo":
        return {
          userInfo: await browser.storage.local.get(["profileData"]),
          proxyState: this.proxyState,
        };

      case "setEnabledState":
        await this.enableProxy(message.data.enabledState);
        break;

      case "authenticate":
        await this.auth();
        break;
    }

    return null;
  }

  async enableProxy(value) {
    log("enabling proxy: " + value);

    // We support the changing of proxy state only from some states.
    if (this.proxyState != PROXY_STATE_UNKNOWN &&
        this.proxyState != PROXY_STATE_ACTIVE &&
        this.proxyState != PROXY_STATE_INACTIVE) {
      return;
    }

    this.proxyState = value ? PROXY_STATE_ACTIVE : PROXY_STATE_INACTIVE;
    await browser.storage.local.set({proxyState: this.proxyState});
    this.updateIcon();

    await this.cacheHeaderAndScheduleTokenRotation();
  }

  updateUI() {
    log("update UI");

    this.showStatusPrompt();
    this.updateIcon();
  }

  updateIcon() {
    let icon;
    if (this.proxyState === PROXY_STATE_INACTIVE) {
      icon = "img/badge_off.png";
    } else if (this.proxyState === PROXY_STATE_ACTIVE) {
      icon = "img/badge_on.png";
    } else {
      icon = "img/badge_warning.png";
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

    if (this.proxyState !== PROXY_STATE_ACTIVE) {
      return false;
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

  async hasValidProfile() {
    log("validating profile");

    let now = performance.timeOrigin + performance.now();

    const { refreshTokenData } = await browser.storage.local.get(["refreshTokenData"]);
    if (!refreshTokenData) {
      log("no refresh token");
      return false;
    }

    if (refreshTokenData.received_at + refreshTokenData.expires_in <= now / 1000) {
      log("refresh token expired");
      return false;
    }

    const { proxyTokenData } = await browser.storage.local.get(["proxyTokenData"]);
    if (!proxyTokenData) {
      log("no proxy token");
      return false;
    }

    if (proxyTokenData.received_at + proxyTokenData.expires_in <= now / 1000) {
      log("proxy token expired");
      return false;
    }

    const { profileTokenData } = await browser.storage.local.get(["profileTokenData"]);
    if (!profileTokenData) {
      log("no profile token");
      return false;
    }

    if (profileTokenData.received_at + profileTokenData.expires_in <= now / 1000) {
      log("profile token expired");
      return false;
    }

    log("profile validated");
    return true;
  }

  async auth() {
    log("Starting the authentication");

    // Let's do the authentication. This will generate a token that is going to
    // be used just to obtain the other ones.
    let refreshTokenData = await this.generateRefreshToken();
    if (!refreshTokenData) {
      log("No refresh token");

      this.proxyState = PROXY_STATE_AUTHFAILURE;
      await browser.storage.local.set({proxyState: this.proxyState});
      return;
    }

    // Let's store the refresh token and let's invalidate all the other tokens.
    browser.storage.local.set({
      refreshTokenData,
      proxyTokenData: null,
      profileTokenData: null,
      profileData: null,
    });

    // Let's obtain the proxy token data
    if (!await this.maybeGenerateTokens()) {
      log("Token generation failed");

      this.profileState = PROXY_STATE_AUTHFAILURE;
      await browser.storage.local.set({profileState: this.profileState});
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
    token.received_at = performance.timeOrigin + performance.now();

    return token;
  }

  async generateProfileData(refreshTokenData) {
    log("generate profile data");

    const headers = new Headers({
      'Authorization': `Bearer ${refreshTokenData.access_token}`
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

    let resp = await fetch(FXA_OPENID);
    let json = await resp.json();

    this.fxaEndpoints.set(FXA_ENDPOINT_PROFILE, json[FXA_ENDPOINT_PROFILE]);
    this.fxaEndpoints.set(FXA_ENDPOINT_TOKEN, json[FXA_ENDPOINT_TOKEN]);
    this.fxaEndpoints.set(FXA_ENDPOINT_ISSUER, json[FXA_ENDPOINT_ISSUER]);
  }

  async maybeGenerateTokens() {
    log("maybe generate tokens");

    let { refreshTokenData } = await browser.storage.local.get(["refreshTokenData"]);
    if (!refreshTokenData) {
      throw new Error("Invalid refreshToken?!?");
    }

    let now = performance.timeOrigin + performance.now();
    let minDiff;

    let { proxyTokenData } = await browser.storage.local.get(["proxyTokenData"]);
    if (proxyTokenData) {
      // diff - 1 hour.
      let diff = proxyTokenData.received_at + proxyTokenData.expires_in - now / 1000 - 3600;
      if (diff < 3600) {
        proxyTokenData = null;
      } else {
        minDiff = diff;
      }
    }

    if (!proxyTokenData) {
      proxyTokenData = await this.generateToken(refreshTokenData, FXA_PROXY_SCOPE);
      if (!proxyTokenData) {
        return false;
      }
    }

    let profileTokenGenerated = false;

    let { profileTokenData } = await browser.storage.local.get(["profileTokenData"]);
    if (profileTokenData) {
      // diff - 1 hour.
      let diff = profileTokenData.received_at + profileTokenData.expires_in - now / 1000 - 3600;
      if (diff < 3600) {
        profileTokenData = null;
      } if (minDiff > diff) {
        minDiff = diff;
      }
    }

    if (!profileTokenData) {
      profileTokenData = await this.generateToken(refreshTokenData, FXA_PROFILE_SCOPE);
      if (!profileTokenData) {
        return false;
      }

      profileTokenGenerated = true;
    }

    let { profileData } = await browser.storage.local.get(["profileData"]);
    // Let's obtain the profile data for the user.
    if (!profileData || profileTokenGenerated) {
      profileData = await this.generateProfileData(profileTokenData);
      if (!profileData) {
        return false;
      }
    }

    browser.storage.local.set({proxyTokenData, profileTokenData, profileData});

    // Let's schedule the token rotation.
    setTimeout(_ => { this.maybeGenerateTokens(); }, minDiff);

    return true;
  }

  async cacheHeaderAndScheduleTokenRotation() {
    log("cache header and schedule token rotation");

    // Token generation can fail.
    if (!await this.maybeGenerateTokens()) {
      log("token generation failed");

      this.proxyState = PROXY_STATE_AUTHFAILURE;
      await browser.storage.local.set({proxyState: this.proxyState});
      return;
    }

    let { proxyTokenData } = await browser.storage.local.get(["proxyTokenData"]);
    if (!proxyTokenData) {
      throw new Error("Invalid proxyTokenData?!?");
    }

    this.proxyAuthorizationHeader = proxyTokenData.token_type + " " + proxyTokenData.access_token;

    // TODO: cloudflare doesn't accept our token yet...
    this.proxyAuthorizationHeader = "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IkNGVEVTVCJ9.eyJleHAiOjE1NjI4NTYxODAsImlzcyI6InN0YWdpbmcifQ.ROI-75EonHpPsprYXlTnswm2vSmNIN0NmFlsT7zhAGwSB_6r4yTlndpEDnr3s-VBm-Dd3OBIBSMbYqCT1q_jky6ow1faDoCGmXc8UbzB0rZToT5ppIPl0lpWRD5-H-wYzV_Ld3he4uZJLQgcqtHRZUl9XbqNOIi5bSzqtoWG_uiXd-iKaK35SdQ4v0q2ZAEfamgNvWcbEjMEdifDLx47rvirp2L0V3VQxACxjsO8zkNokYVMSfQaPaZG-6ezTTZtes6QiRvGx-AeHspEfWBT-Xl8r68P_yKTgxxG-vdorVkNpOlnMzDOHCPjpS1yODUx844MbhQU1MSgb5X5_lV66g";
  }
}

let background = new Background();
background.init();
