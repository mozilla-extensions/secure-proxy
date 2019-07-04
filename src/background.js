// TODO whilst the proxy is enabled set media.peerconnection.enabled to false.

// Read pref for captive portal and disable.

// TODO Get the following from https://latest.dev.lcip.org/.well-known/openid-configuration
//  or https://accounts.firefox.com/.well-known/openid-configuration for stable.
const FXA_OPENID = "https://latest.dev.lcip.org/.well-known/openid-configuration";
const FXA_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";
const FXA_SCOPES = ["profile", FXA_SCOPE];
const FXA_OAUTH_SERVER = "https://oauth-latest.dev.lcip.org/v1";
const FXA_CONTENT_SERVER = "https://latest.dev.lcip.org";
const FXA_PROFILE_SERVER = "https://latest.dev.lcip.org/profile/v1";
const FXA_CLIENT_ID = "1c7882c43994658e";
const JWT_HARDCODED_TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkNGVEVTVCJ9.eyJleHAiOjE1NjI4NTYxODAsImlzcyI6InN0YWdpbmcifQ.ROI-75EonHpPsprYXlTnswm2vSmNIN0NmFlsT7zhAGwSB_6r4yTlndpEDnr3s-VBm-Dd3OBIBSMbYqCT1q_jky6ow1faDoCGmXc8UbzB0rZToT5ppIPl0lpWRD5-H-wYzV_Ld3he4uZJLQgcqtHRZUl9XbqNOIi5bSzqtoWG_uiXd-iKaK35SdQ4v0q2ZAEfamgNvWcbEjMEdifDLx47rvirp2L0V3VQxACxjsO8zkNokYVMSfQaPaZG-6ezTTZtes6QiRvGx-AeHspEfWBT-Xl8r68P_yKTgxxG-vdorVkNpOlnMzDOHCPjpS1yODUx844MbhQU1MSgb5X5_lV66g";

// Proxy configuration
const PROXY_TYPE = "https";
const PROXY_HOST = "proxy-staging.cloudflareclient.com";
const PROXY_PORT = 8001;

class Background {
  async init() {
    // Basic configuration
    await this.computeProxyState();

    // I don't think the extension will ever control this, however it's worth exempting in case.
    this.CAPTIVE_PORTAL_URL = await browser.experiments.proxyutils.getCaptivePortalURL();

    // Message handler
    browser.runtime.onMessage.addListener((m, s, r) => this.messageHandler(m, s, r));

    // Proxy configuration
    browser.proxy.onRequest.addListener((requestInfo) => this.proxyRequestCallback(requestInfo),
                                        {urls: ["<all_urls>"]}, ["requestHeaders"]);

    // This is kind of buggy. In theory we should receive errors in the
    // onErrorOccurred callback, but sometimes we receive them here instead.
    browser.webRequest.onCompleted.addListener(details => {
      if (details.statusCode == 407) {
        this.processNetworkError("NS_ERROR_PROXY_AUTHENTICATION_FAILED");
        return;
      }

      if (details.statusCode == 501 || details.statusCode == 403) {
        this.processNetworkError("NS_ERROR_PROXY_CONNECTION_REFUSED");
        return;
      }

      if (details.statusCode == 502) {
        this.processNetworkError("NS_ERROR_PROXY_BAD_GATEWAY");
        return;
      }

      if (details.statusCode == 504) {
        this.processNetworkError("NS_ERROR_PROXY_GATEWAY_TIMEOUT");
        return;
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
    if (this.proxyState != PROXY_STATE_ACTIVE) {
      return;
    }

    if (errorStatus == "NS_ERROR_PROXY_AUTHENTICATION_FAILED") {
      this.proxyState = PROXY_STATE_PROXYAUTHFAILED;
      this.updateUI();
      // TODO: rotate the token.. maybe?
      return;
    }

    if (errorStatus == "NS_ERROR_PROXY_CONNECTION_REFUSED" ||
        errorStatus == "NS_ERROR_PROXY_BAD_GATEWAY" ||
        errorStatus == "NS_ERROR_PROXY_GATEWAY_TIMEOUT") {
      this.proxyState = PROXY_STATE_PROXYERROR;
      this.updateUI();
      return;
    }
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
    let currentState = this.proxyState;
    if (currentState !== PROXY_STATE_AUTHFAILURE) {
      this.proxyState = PROXY_STATE_UNKNOWN;
    }

    // We want to keep these states.
    if (currentState == PROXY_STATE_PROXYERROR ||
        currentState == PROXY_STATE_PROXYAUTHFAILED) {
      this.proxyState == currentState;
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
    }

    return currentState != this.proxyState;
  }

  // Our message handler
  async messageHandler(message, sender, response) {
    switch (message.type) {
      case "initInfo":
        return {
          userInfo: await this.getProfile(),
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
    // We support the changing of proxy state only from some states.
    if (this.proxyState != PROXY_STATE_UNKNOWN &&
        this.proxyState != PROXY_STATE_ACTIVE &&
        this.proxyState != PROXY_STATE_INACTIVE) {
      return;
    }

    this.proxyState = value ? PROXY_STATE_ACTIVE : PROXY_STATE_INACTIVE;
    await browser.storage.local.set({proxyState: this.proxyState});
    this.updateIcon();
  }

  updateUI() {
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
  }

  proxyRequestCallback(requestInfo) {
    // TODO rotate hardcoded token here based on the user.
    if (this.shouldProxyRequest(requestInfo)) {
      return [{
        type: PROXY_TYPE,
        host: PROXY_HOST,
        port: PROXY_PORT,
        // TODO: bearer should be replaced by the token_type from the user profile.
        proxyAuthorizationHeader: 'bearer ' + JWT_HARDCODED_TOKEN,
        connectionIsolationKey: 'bearer' + JWT_HARDCODED_TOKEN,
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

    function isAuthUrl(url) {
      const authUrls = [FXA_OPENID, FXA_OAUTH_SERVER, FXA_CONTENT_SERVER, FXA_PROFILE_SERVER];
      return authUrls.some((item) => {
        return new URL(item).origin == url.origin;
      });
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
    if (isAuthUrl(url)) {
      return false;
    }

    return true;
  }

  async hasValidProfile() {
    return !!(await this.getLocalProfile());
  }

  async getLocalProfile() {
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
    */
    const { loginDetails } = await browser.storage.local.get(["loginDetails"]);
    if (!loginDetails) {
      return null;
    }

    // loginDetails expired.
    if (loginDetails.auth_at + loginDetails.expires_in <= Date.now() / 1000) {
      return null;
    }

    return loginDetails;
  }

  async getProfile() {
    let loginDetails = await this.getLocalProfile();
    if (!loginDetails) {
      return null;
    }

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

    const headers = new Headers({
      'Authorization': `Bearer ${credentials.access_token}`
    });
    const request = new Request(`${FXA_PROFILE_SERVER}/profile`, {
      method: 'GET',
      headers
    });

    const resp = await fetch(request);
    if (resp.status === 200) {
      return resp.json();
    }

    return null;
  }

  async auth() {
    const fxaKeysUtil = new fxaCryptoRelier.OAuthUtils({
      contentServer: FXA_CONTENT_SERVER,
      oauthServer: FXA_OAUTH_SERVER
    });
    const FXA_REDIRECT_URL = browser.identity.getRedirectURL();

    try {
      const loginDetails = await fxaKeysUtil.launchWebExtensionKeyFlow(FXA_CLIENT_ID, {
        redirectUri: FXA_REDIRECT_URL,
        scopes: FXA_SCOPES,
      });

      if (!loginDetails) {
        throw new Error("auth failure");
      }

      browser.storage.local.set({loginDetails});
    } catch (e) {
      await browser.storage.local.set({proxyState: PROXY_STATE_AUTHFAILURE});
      return;
    }

    // Let's enable the proxy.
    await this.enableProxy(true);
  }
}

let background = new Background();
background.init();
