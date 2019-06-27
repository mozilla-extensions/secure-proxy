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
const PROXY_HOST = "35.199.173.51";
const PROXY_PORT = 8001;

class Background {
  constructor() {
    this.proxyState = undefined;
  }

  async init() {
    // Basic configuration
    let { enabledState } = await browser.storage.local.get(["enabledState"]);
    this.proxyState = enabledState;

    // I don't think the extension will ever control this, however it's worth exempting in case.
    this.CAPTIVE_PORTAL_URL = await browser.experiments.proxyutils.getCaptivePortalURL();

    // Message handler
    browser.runtime.onMessage.addListener((m, s, r) => this.messageHandler(m, s, r));

    // Proxy configuration
    browser.proxy.onRequest.addListener((requestInfo) => this.proxyRequestCallback(requestInfo),
                                        {urls: ["<all_urls>"]}, ["requestHeaders"]);

    // UI
    this.updateIcon();
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
        this.enableProxy(message.data.enabledState);
        break;

      case "authenticate":
        await this.auth();
        break;
    }

    return null;
  }

  async enableProxy(value) {
    this.proxyState = value;
    await browser.storage.local.set({enabledState: value});
    this.updateIcon(value);
  }

  updateIcon() {
    let icon;
    if (this.proxyState === undefined) {
      icon = "img/indeterminate.png";
    } else if (this.proxyState === false) {
      icon = "img/notproxied.png";
    } else {
      icon = "img/proxied.png";
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
        proxyAuthorizationHeader: JWT_HARDCODED_TOKEN,
        connectionIsolationKey: JWT_HARDCODED_TOKEN,
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

    if (this.proxyState !== true) {
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

  async getProfile() {
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

    throw new Error('Failed to fetch profile');
  }

  async auth() {
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

    // Let's enable the proxy.
    return this.enableProxy(true);
  }
}

let background = new Background();
background.init();
