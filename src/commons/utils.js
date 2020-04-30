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

// Payment is required (this is the state after a FXA_PAYMENT_REQUIRED response)
const PROXY_STATE_PAYMENTREQUIRED = "paymentRequired";

// Onboarding state
const PROXY_STATE_ONBOARDING = "onboarding";

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

const MODE_3RD_PARTY_TRACKER_ONLY = "3rdPartyTrackerOnly";
const MODE_TRACKER_ONLY = "trackerOnly";
const MODE_ALL = "all";

// Testing URL. This request is sent with the proxy settings when we are in
// connecting state. If this succeeds, we go to active state.
const CONNECTING_HTTP_REQUEST = "http://test.factor11.cloudflareclient.com/";

// Proxy configuration
const DEFAULT_PROXY_URL = "https://firefox.factor11.cloudflareclient.com:2486";

// FxA openID configuration
const DEFAULT_FXA_OPENID = "https://accounts.firefox.com/.well-known/openid-configuration";

// SPS configuration (final '/' is important!)
const DEFAULT_SPS = "https://fpn.firefox.com/";

// DNS over HTTPS
const DOH_URI = "https://mozilla.cloudflare-dns.com/dns-query";
const DOH_BOOTSTRAP_ADDRESS = "1.1.1.1";

// Message service fetch in seconds.
const DEFAULT_MESSAGE_SERVICE_INTERVAL = 7200;

const ConfigUtils = {
  async setProxyURL(proxyURL) {
    await browser.storage.local.set({proxyURL});
  },

  async getProxyURL() {
    return new URL(await this.getStorageKey("proxyURL") || DEFAULT_PROXY_URL);
  },

  async setProxyMode(proxyMode) {
    await browser.storage.local.set({proxyMode});
  },

  async getProxyMode() {
    return await this.getStorageKey("proxyMode") || MODE_ALL;
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

  async getOnboardingShown() {
    return await this.getStorageKey("onboardingShown") || false;
  },

  async getMessageServiceInterval() {
    return await this.getStorageKey("messageServiceInterval") || DEFAULT_MESSAGE_SERVICE_INTERVAL;
  },

  async setMessageServiceInterval(messageServiceInterval) {
    await browser.storage.local.set({messageServiceInterval});
  },

  async getCurrentConfig() {
    let self = await browser.management.getSelf();

    return {
      version: self.version,
      fxaOpenID: await this.getFxaOpenID(),
      sps: await this.getSPService(),
      proxyURL: await this.getProxyURL(),
      proxyMode: await this.getProxyMode(),
      debuggingEnabled: await this.getDebuggingEnabled(),
      messageServiceInterval: await this.getMessageServiceInterval(),
      onboardingShown: await this.getOnboardingShown(),
    };
  },

  async getStorageKey(key) {
    let data = await browser.storage.local.get([key]);
    return data[key];
  }
};
