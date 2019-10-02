// For a description of the interaction of SP and FxA, see:
// https://gitlab.com/shane-tomlinson/mermaid-charts/blob/master/charts/secure-proxy/secure-proxy-signin-with-backend-server.svg

import {Component} from "./component.js";
import {StorageUtils} from "./storageUtils.js";
import {WellKnownData} from "./wellKnownData.js";

// Token scopes
const FXA_PROFILE_SCOPE = "profile";
const FXA_PROXY_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";

// The client ID for this extension
const FXA_CLIENT_ID = "565585c1745a144d";

// How early we want to re-generate the tokens (in secs)
const EXPIRE_DELTA = 3600;

// FxA CDNs
const FXA_CDN_DOMAINS = [
  "firefoxusercontent.com",
  "mozillausercontent.com",
  "accounts-static.cdn.mozilla.net",
  "accounts-static-2.stage.mozaws.net",
];

// If the token generation fails for network errors, when should we try again?
const NEXT_TRY_TIME = 300; // 5 minutes in secs.

export class FxAUtils extends Component {
  constructor(receiver) {
    super(receiver);

    this.wellKnownData = new WellKnownData();

    // This is Set of pending operations to do after a token request.
    this.postTokenRequestOps = new Set();
    this.requestingToken = false;

    this.nextExpireTime = 0;

    // The cached token will be populated as soon as the token is retrieved
    // from the storage or requested.
    this.cachedProxyTokenValue = {
      tokenType: "bearer",
      tokenValue: "invalid-token",
      tokenHash: "",
    };
  }

  async init(prefs) {
    this.service = await ConfigUtils.getSPService();
    this.proxyURL = await ConfigUtils.getProxyURL();
    this.fxaExpirationDelta = await ConfigUtils.getFxaExpirationDelta();

    await this.wellKnownData.init();

    // Let's see if we have to request a new token, but without waiting for the
    // result.
    // eslint-disable-next-line verify-await/check
    this.maybeObtainToken();
  }

  async authenticate() {
    // Let's do the authentication. This will generate a fxa code that is going
    // to be sent to the secure-proxy service to obtain the other ones.
    let data = await this.authenticateInternal();
    if (!data) {
      throw new Error("authentication failed");
    }

    // Let's store the state token and let's invalidate all the other tokens
    // in order to regenerate them.
    await StorageUtils.setStateToken(data.stateToken);

    // Let's obtain the proxy token data. This method will dispatch a
    // "tokenGenerated" event.
    const result = await this.maybeObtainToken(data.fxaCode);
    if (this.syncStateError(result)) {
      throw new Error("Token generation failed");
    }
  }

  async maybeObtainToken(fxaCode = null) {
    log("maybe request a token and profile data");

    if (this.requestingToken) {
      log("token request in progress. Let's wait.");
      return new Promise(resolve => this.postTokenRequestOps.add(resolve));
    }

    this.requestingToken = true;
    const result = await this.maybeObtainTokenInternal(fxaCode);
    this.requestingToken = false;

    // Let's take all the ops and execute them.
    let ops = this.postTokenRequestOps;
    this.postTokenRequestOps = new Set();
    // eslint-disable-next-line verify-await/check
    ops.forEach(value => value(result));

    return result;
  }

  async maybeObtainTokenInternal(fxaCode) {
    log("maybe generate proxy token");

    let tokenGenerated = false;

    // eslint-disable-next-line verify-await/check
    let now = Date.now();
    let nowInSecs = Math.round(now / 1000);

    let tokenData = await StorageUtils.getProxyTokenData();
    if (tokenData) {
      // If we are close to the expiration time, we have to generate the token.
      // We want to keep a big time margin: 1 hour seems good enough.
      let diff = tokenData.received_at + tokenData.expires_in - nowInSecs - this.fxaExpirationDelta;
      if (!diff || diff < 0) {
        log(`Token exists but it is expired. Received at ${tokenData.received_at} and expires in ${tokenData.expires_in}`);
        tokenData = null;
      } else {
        log(`token expires in ${diff}`);
      }
    }

    if (!tokenData) {
      log("generating token");
      const data = await this.generateToken(fxaCode);
      if (this.syncStateError(data)) {
        return data;
      }

      tokenData = data.proxy_token;

      tokenGenerated = true;

      await StorageUtils.setProxyTokenAndProfileData(data.proxy_token,
                                                     data.profile_data);
    }

    let minDiff = tokenData.received_at + tokenData.expires_in - nowInSecs - this.fxaExpirationDelta;
    log(`token expires in ${minDiff}`);

    // Let's schedule the token rotation.
    setTimeout(async _ => this.scheduledTokenGeneration(), minDiff * 1000);

    this.nextExpireTime = tokenData.received_at + tokenData.expires_in;

    // Let's update the proxy token cache with the new values.
    this.cachedProxyTokenValue.tokenType = "Bearer";
    this.cachedProxyTokenValue.tokenValue = tokenData.token;
    this.cachedProxyTokenValue.tokenHash = await this.digestTokenValue(tokenData.token);

    if (tokenGenerated) {
      // We cannot wait for this message because otherwise we create a bad
      // deadlock between the authentication process and the token generation
      // event.

      // eslint-disable-next-line verify-await/check
      this.sendMessage("tokenGenerated");
    }

    // All good!
    return { state: FXA_OK };
  }

  async obtainStateToken() {
    log("Obtain state token");

    const headers = new Headers();
    // eslint-disable-next-line verify-await/check
    headers.append("Content-Type", "application/json");

    const request = new Request(this.service + "browser/oauth/start", {
      method: "GET",
      headers,
    });

    try {
      let resp = await fetch(request, {cache: "no-cache"});
      if (resp.status !== 201) {
        return null;
      }

      const json = await resp.json();
      return json.state_token;
    } catch (e) {
      return null;
    }
  }

  async scheduledTokenGeneration() {
    log("Token generation scheduled");

    const result = await this.maybeObtainToken();
    if (this.syncStateError(result)) {
      log("token generation failed");
      await this.sendMessage("authenticationFailed", result.state);

      if (result.state === FXA_ERR_NETWORK) {
        log("Network error. Let's wait a bit before trying again.");
        setTimeout(async _ => this.scheduledTokenGeneration(), NEXT_TRY_TIME * 1000);
      }
    }
  }

  async generateToken(fxaCode) {
    let stateTokenData = await StorageUtils.getStateTokenData();
    if (!stateTokenData) {
      return { state: FXA_ERR_AUTH };
    }

    const headers = new Headers();
    // eslint-disable-next-line verify-await/check
    headers.append("Content-Type", "application/json");

    const request = new Request(this.service + "browser/oauth/token", {
      method: "POST",
      headers,
      body: JSON.stringify({
        state_token: stateTokenData,
        fxa_code: fxaCode,
      }),
    });

    try {
      let resp = await fetch(request, {cache: "no-cache"});
      if (resp.status >= 500 && resp.status <= 599) {
        return { state: FXA_ERR_NETWORK };
      }

      if (resp.status !== 201) {
        return { state: FXA_ERR_AUTH };
      }

      const json = await resp.json();

      // Let's store when this token has been received.
      // eslint-disable-next-line verify-await/check
      json.proxy_token.received_at = Math.round(Date.now() / 1000);

      return {
        state: FXA_OK,
        proxy_token: json.proxy_token,
        profile_data: json.profile_data,
      };
    } catch (e) {
      return { state: FXA_ERR_NETWORK };
    }
  }

  syncStateError(data) {
    if (!data || !data.state) {
      // eslint-disable-next-line verify-await/check
      console.trace();
      throw new Error("Internal error!");
    }

    return data.state !== FXA_OK;
  }

  async authenticateInternal() {
    log("generate state token and the fxa code");

    const contentServer = await this.wellKnownData.getIssuerEndpoint();
    const fxaKeysUtil = new fxaCryptoRelier.OAuthUtils({contentServer});

    // get optional flow params for fxa metrics
    await this.maybeFetchFxaFlowParams();

    const stateToken = await this.obtainStateToken();
    if (!stateToken) {
      return null;
    }

    let fxaCode;
    try {
      let data = await fxaKeysUtil.launchWebExtensionCodeFlow(FXA_CLIENT_ID, stateToken, {
        // eslint-disable-next-line verify-await/check
        redirectUri: browser.identity.getRedirectURL(),
        scopes: [FXA_PROFILE_SCOPE, FXA_PROXY_SCOPE],
        // Spread in FxA flow metrics if we have them
        ...this.fxaFlowParams,
        // We have our well-known-data cache, let's use it.
        ensureOpenIDConfiguration: _ => this.wellKnownData.openID(),
      });

      if (data.state !== stateToken) {
        throw new Error("Invalid state code received!");
      }

      fxaCode = data.code;
    } catch (e) {
      console.error("Failed to fetch the refresh token", e);
    }

    if (!fxaCode) {
      return null;
    }

    return {
      stateToken,
      fxaCode,
    };
  }

  // This method returns a token or a Promise.
  askForProxyToken() {
    // eslint-disable-next-line verify-await/check
    let nowInSecs = Math.round(Date.now() / 1000);
    if (this.requestingToken ||
        !this.nextExpireTime ||
        nowInSecs >= (this.nextExpireTime - EXPIRE_DELTA)) {
      // We don't care about the cached values. Maybe they are the old ones.
      return this.maybeObtainToken().then(_ => this.cachedProxyTokenValue);
    }

    return this.cachedProxyTokenValue;
  }

  async forceToken(data) {
    await StorageUtils.setProxyTokenData(data);
    this.nextExpireTime = 0;
  }

  isAuthUrl(origin) {
    return this.wellKnownData.isAuthUrl(origin);
  }

  excludedDomains() {
    // eslint-disable-next-line verify-await/check
    const excludedDomains = this.wellKnownData.excludedDomains();
    return excludedDomains.concat(FXA_CDN_DOMAINS);
  }

  async manageAccountURL() {
    let contentServer = await this.wellKnownData.getIssuerEndpoint();

    let profileData = await StorageUtils.getProfileData();
    let url = new URL(contentServer + "/settings");
    // eslint-disable-next-line verify-await/check
    url.searchParams.set("uid", profileData.uid);
    // eslint-disable-next-line verify-await/check
    url.searchParams.set("email", profileData.email);
    return url.href;
  }

  async prefetchWellKnownData() {
    return this.wellKnownData.fetch();
  }

  async resetToken() {
    let stateTokenData = await StorageUtils.getStateTokenData();
    if (stateTokenData) {
      const headers = new Headers();
      // eslint-disable-next-line verify-await/check
      headers.append("Content-Type", "application/json");

      const request = new Request(this.service + "browser/oauth/forget", {
        method: "POST",
        headers,
        body: JSON.stringify({
          state_token: stateTokenData,
        }),
      });

      try {
        let resp = await fetch(request, {cache: "no-cache"});
        if (resp.status !== 200) {
          throw new Error("200 exepcted");
        }
      } catch (e) {
        console.error("Failed to fetch /forget request: ", e);
      }
    }

    await StorageUtils.setStateToken(null);
  }

  // check storage for optional flow params
  // if they don't exist just use an empty object
  async maybeFetchFxaFlowParams() {
    if (this.fxaFlowParams === undefined) {
      this.fxaFlowParams = await StorageUtils.getFxaFlowParams() || {};
    }
  }

  async digestTokenValue(tokenValue) {
    // eslint-disable-next-line verify-await/check
    const tokenValueUint8 = new TextEncoder().encode(tokenValue);
    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenValueUint8);
    // eslint-disable-next-line verify-await/check
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // eslint-disable-next-line verify-await/check
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    // eslint-disable-next-line verify-await/check
    return hashHex.substr(0, 16);
  }
}
