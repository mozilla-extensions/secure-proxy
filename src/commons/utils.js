/* eslint-disable no-unused-vars */

// Proxy configuration
const PROXY_URL = "https://proxy-staging.cloudflareclient.com:8001";

// We are loading resources
const PROXY_STATE_LOADING = "loading";

// We are offline.
const PROXY_STATE_OFFLINE = "offline";

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

// Enable debugging
let debuggingMode = false;
function log(msg, ...rest) {
  if (debuggingMode) {
    console.log("*** secure-proxy *** - " + msg, ...rest);
  }
}
