/* eslint-disable no-unused-vars */

// We are loading resources
const PROXY_STATE_LOADING = "loading";

// We are offline.
const PROXY_STATE_OFFLINE = "offline";

// Captive portal detected.
const PROXY_STATE_CAPTIVE = "captive";

// The user is not authenticated, the proxy is not configured.
const PROXY_STATE_UNAUTHENTICATED = "unauthenticated";

// The user is registered, the proxy has been disabled.
const PROXY_STATE_INACTIVE = "inactive";

// The user is registered, the proxy is active.
const PROXY_STATE_ACTIVE = "active";

// The proxy has been configured. We want to check if it works correctly.
const PROXY_STATE_CONNECTING = "connecting";

// There is another proxy in use.
const PROXY_STATE_OTHERINUSE = "otherInUse";

// Generic proxy error.
const PROXY_STATE_PROXYERROR = "proxyError";

// The proxy rejects the current user token.
const PROXY_STATE_PROXYAUTHFAILED = "proxyAuthFailed";

// Authentication failed
const PROXY_STATE_AUTHFAILURE = "authFailure";

// Authentication failed because of geo-restrictions
const PROXY_STATE_GEOFAILURE = "geoFailure";

// FXA network error code.
const FXA_ERR_NETWORK = "networkError";

// FXA authentication failed error code.
const FXA_ERR_AUTH = "authFailed";

// FXA authentication failed because of geo restrictions.
const FXA_ERR_GEO = "authFailedByGeo";

// FXA token generation requires payment.
const FXA_PAYMENT_REQUIRED = "paymentRequired";

// FXA all good!
const FXA_OK = "ok";

// Testing URL. This request is sent with the proxy settings when we are in
// connecting state. If this succeeds, we go to active state.
const CONNECTING_HTTP_REQUEST = "http://test.factor11.cloudflareclient.com/";

// Proxy configuration
const DEFAULT_PROXY_URL = "https://firefox.factor11.cloudflareclient.com:2486";

// FxA openID configuration
const DEFAULT_FXA_OPENID = "https://accounts.firefox.com/.well-known/openid-configuration";

// SPS configuration (final '/' is important!)
const DEFAULT_SPS = "https://fpn.firefox.com/";

// How often we check if we have new passes.
const DEFAULT_PASSES_TIMEOUT = 21600; // 6 hours

const ConfigUtils = {
  async setProxyURL(proxyURL) {
    await browser.storage.local.set({proxyURL});
  },

  async getProxyURL() {
    return new URL(await this.getStorageKey("proxyURL") || DEFAULT_PROXY_URL);
  },

  async setSPService(sps) {
    await browser.storage.local.set({sps});
  },

  async getSPService() {
    return new URL(await this.getStorageKey("sps") || DEFAULT_SPS);
  },

  async setFxaOpenID(fxaOpenID) {
    await browser.storage.local.set({fxaOpenID});
  },

  async getFxaOpenID() {
    return new URL(await this.getStorageKey("fxaOpenID") || DEFAULT_FXA_OPENID);
  },

  async setDebuggingEnabled(debuggingEnabled) {
    await browser.storage.local.set({debuggingEnabled});
  },

  async getDebuggingEnabled() {
    return await this.getStorageKey("debuggingEnabled") || false;
  },

  async setMigrationCompleted(migrationCompleted) {
    await browser.storage.local.set({migrationCompleted});
  },

  async getMigrationCompleted() {
    return await this.getStorageKey("migrationCompleted") || false;
  },

  async setPassesTimeout(passesTimeout) {
    await browser.storage.local.set({passesTimeout});
  },

  async getPassesTimeout() {
    return await this.getStorageKey("passesTimeout") || DEFAULT_PASSES_TIMEOUT;
  },

  async getCurrentConfig() {
    let self = await browser.management.getSelf();

    return {
      version: self.version,
      fxaOpenID: await this.getFxaOpenID(),
      sps: await this.getSPService(),
      proxyURL: await this.getProxyURL(),
      debuggingEnabled: await this.getDebuggingEnabled(),
      migrationCompleted: await this.getMigrationCompleted(),
      // eslint-disable-next-line verify-await/check
      currentPass: parseInt(await this.getStorageKey("currentPass"), 10),
      // eslint-disable-next-line verify-await/check
      totalPasses: parseInt(await this.getStorageKey("totalPasses"), 10),
      passesTimeout: await this.getPassesTimeout(),
    };
  },

  async getStorageKey(key) {
    let data = await browser.storage.local.get([key]);
    return data[key];
  }
};

// Enable debugging
let debuggingMode = false;
// We don't want to block log's from happening so use then()
ConfigUtils.getDebuggingEnabled().then((debugging) => {
  debuggingMode = debugging;
});

function log(msg, ...rest) {
  if (debuggingMode) {
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    };
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", options).format;

    // eslint-disable-next-line verify-await/check
    let now = dateTimeFormat(Date.now());
    console.log("*** secure-proxy *** [" + now + "] - " + msg, ...rest);
  }
}
