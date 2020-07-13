// For a description of the interaction of SP and FxA, see:
// https://gitlab.com/shane-tomlinson/mermaid-charts/blob/master/charts/secure-proxy/secure-proxy-signin-with-backend-server.svg

import {Component} from "./component.js";
import {Logger} from "./logger.js";
import {StorageUtils} from "./storageUtils.js";
import {WellKnownData} from "./wellKnownData.js";

const log = Logger.logger("FxA");

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

    this.tokenGenerationTimerId = 0;

    this.dohHostnames = [];

    // The cached token will be populated as soon as the token is retrieved
    // from the storage or requested.
    this.cachedProxyTokenValue = {
      tokenValue: "invalid-token",
      tokenHash: "",
    };
  }

  async init() {
    this.service = await ConfigUtils.getSPService();
    this.proxyURL = await ConfigUtils.getProxyURL();

    const prefs = await browser.experiments.proxyutils.settings.get({});

    try {
      const url = new URL(prefs.value.dohUri);
      this.dohHostnames.push(url.hostname);
    } catch (e) {
      // ignore
    }

    this.dohHostnames.push(new URL(DOH_URI).hostname);
    this.dohHostnames.push(DOH_BOOTSTRAP_ADDRESS);

    await this.wellKnownData.init();

    const data = await this.maybeObtainToken();
    if (data.state === FXA_PAYMENT_REQUIRED) {
      log("We were active, but not we need a new token");
      // We don't want to wait here to avoid a deadlock.
      this.sendMessage("payment-required-at-startup");
    }

    if (data.state === FXA_DEVICE_LIMIT) {
      log("We were active, but too many devices");
      // We don't want to wait here to avoid a deadlock.
      this.sendMessage("device-limit-at-startup");
    }
  }

  async authenticate() {
    // Let's do the authentication. This will generate a fxa code that is going
    // to be sent to the secure-proxy service to obtain the other ones.
    const data = await this.authenticateInternal();
    if (this.syncStateError(data)) {
      return data;
    }

    // Let's store the state token and let's invalidate all the other tokens
    // in order to regenerate them.
    await StorageUtils.setStateTokenAndProfileData(data.stateToken, data.profileData);

    // We don't want to wait here. It would be a deadlock.
    this.sendMessage("authCompleted");
    return { state: FXA_OK };
  }

  async maybeObtainToken() {
    log("maybe request a token and profile data");

    if (this.requestingToken) {
      log("token request in progress. Let's wait.");
      return new Promise(resolve => this.postTokenRequestOps.add(resolve));
    }

    this.requestingToken = true;
    const result = await this.maybeObtainTokenInternal();
    this.requestingToken = false;

    // Let's take all the ops and execute them.
    let ops = this.postTokenRequestOps;
    this.postTokenRequestOps = new Set();
    ops.forEach(value => value(result));

    return result;
  }

  async maybeObtainTokenInternal() {
    log("maybe generate proxy token");

    clearTimeout(this.tokenGenerationTimerId);

    // Not authenticated yet.
    const stateTokenData = await StorageUtils.getStateTokenData();
    if (!stateTokenData) {
      return { state: FXA_ERR_AUTH };
    }

    let tokenGenerated = false;

    let now = Date.now();
    let nowInSecs = Math.floor(now / 1000);

    let tokenData = await StorageUtils.getProxyTokenData();
    if (tokenData) {
      // If we are close to the expiration time, we have to generate the token.
      // We want to keep a big time margin: 1 hour seems good enough.
      let diff = tokenData.received_at + tokenData.expires_in - nowInSecs;
      if (!diff || diff < 0) {
        log(`Token exists but it is expired. Received at ${tokenData.received_at} and expires in ${tokenData.expires_in}`);
        tokenData = null;
      } else {
        log(`token expires in ${diff}`);
      }
    }

    if (!tokenData) {
      log("generating token");
      const data = await this.generateToken();
      if (this.syncStateError(data)) {
        return data;
      }

      tokenData = data.proxy_token;

      tokenGenerated = true;

      await StorageUtils.setProxyTokenAndProfileData(data.proxy_token,
                                                     data.profile_data);
    }

    let minDiff = tokenData.received_at + tokenData.expires_in - nowInSecs;
    log(`token expires in ${minDiff}`);

    this.tokenGenerationTimerId = setTimeout(async _ => this.scheduledTokenGeneration(), minDiff * 1000);

    this.nextExpireTime = tokenData.received_at + tokenData.expires_in;

    // Let's update the proxy token cache with the new values.
    this.cachedProxyTokenValue.tokenValue = tokenData.token;
    this.cachedProxyTokenValue.tokenHash = await this.digestTokenValue(tokenData.token);

    if (tokenGenerated) {
      // We cannot wait for this message because otherwise we create a bad
      // deadlock between the authentication process and the token generation
      // event.
      this.sendMessage("tokenGenerated");
    }

    // All good!
    return { state: FXA_OK };
  }

  async obtainStateData() {
    log("Obtain state token");

    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const request = new Request(this.service + "browser/oauth/state", {
      method: "GET",
      headers,
    });

    try {
      let resp = await fetch(request, {cache: "no-cache"});
      if (resp.status !== 201) {
        return null;
      }

      const json = await resp.json();
      return {
        clientID: json.client_id,
        stateToken: json.state_token,
        scopes: json.scopes,
        accessType: json.access_type,
        authorizationEndpoint: json.authorization_endpoint,
      };
    } catch (e) {
      return null;
    }
  }

  async scheduledTokenGeneration() {
    log("Token generation scheduled");

    if (this.cachedProxyState !== PROXY_STATE_ACTIVE) {
      log("Proxy is inactive. We don't need a new token.");
      return;
    }

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

  async generateToken() {
    const stateTokenData = await StorageUtils.getStateTokenData();
    if (!stateTokenData) {
      return { state: FXA_ERR_AUTH };
    }

    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const request = new Request(this.service + "browser/oauth/token", {
      method: "POST",
      headers,
      body: JSON.stringify({
        state_token: stateTokenData,
      }),
    });

    try {
      let resp = await fetch(request, {cache: "no-cache"});
      if (resp.status >= 500 && resp.status <= 599) {
        return { state: FXA_ERR_NETWORK };
      }

      if (resp.status === 402) {
        return { state: FXA_PAYMENT_REQUIRED };
      }

      if (resp.status === 429) {
        return { state: FXA_DEVICE_LIMIT };
      }

      if (resp.status !== 201) {
        return { state: FXA_ERR_AUTH };
      }

      const json = await resp.json();

      // Let's store when this token has been received.
      json.proxy_token.received_at = Math.floor(Date.now() / 1000);

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
      console.trace();
      throw new Error("Internal error!");
    }

    return data.state !== FXA_OK;
  }

  async authenticateInternal() {
    log("generate state token and the fxa code");

    const stateData = await this.obtainStateData();
    if (!stateData) {
      return { state: FXA_ERR_NETWORK };
    }

    const fxaCode = await this.obtainFxaCode(stateData);
    if (!fxaCode) {
      return { state: FXA_ERR_AUTH };
    }

    const completed = await this.completeAuthentication(stateData.stateToken, fxaCode);
    if (this.syncStateError(completed)) {
      return completed;
    }

    return {
      stateToken: stateData.stateToken,
      fxaCode,
      ...completed,
    };
  }

  async obtainFxaCode(stateData) {
    // get optional flow params for fxa metrics
    await this.maybeFetchFxaFlowParams();

    const endpoint = new URL(stateData.authorizationEndpoint);
    endpoint.searchParams.append("access_type", stateData.accessType);
    endpoint.searchParams.append("client_id", stateData.clientID);
    endpoint.searchParams.append("state", stateData.stateToken);
    endpoint.searchParams.append("scope", stateData.scopes.join(" "));
    endpoint.searchParams.append("redirect_uri", browser.identity.getRedirectURL());
    endpoint.searchParams.append("response_type", "code");
    endpoint.searchParams.append("action", "email");

    // Spread in FxA flow metrics if we have them
    if (this.fxaFlowParams && this.fxaFlowParams.deviceId) {
      endpoint.searchParams.append("device_id", this.fxaFlowParams.deviceId);
      endpoint.searchParams.append("flow_id", this.fxaFlowParams.flowId);
      endpoint.searchParams.append("flow_begin_time", this.fxaFlowParams.flowBeginTime);
    }

    try {
      const redirectURL = await browser.identity.launchWebAuthFlow({
        interactive: true,
        url: endpoint.href,
      });

      const url = new URL(redirectURL);
      const data = {
        state: url.searchParams.get("state"),
        code: url.searchParams.get("code"),
      };

      if (data.state !== stateData.stateToken) {
        throw new Error("Invalid state code received!");
      }

      return data.code;
    } catch (e) {
      console.error("Failed to fetch the refresh token", e);
      return null;
    }
  }

  async completeAuthentication(stateToken, fxaCode) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const request = new Request(this.service + "browser/oauth/authenticate", {
      method: "POST",
      headers,
      body: JSON.stringify({
        state_token: stateToken,
        fxa_code: fxaCode,
      }),
    });

    try {
      let resp = await fetch(request, {cache: "no-cache"});
      if (resp.status >= 500 && resp.status <= 599) {
        return { state: FXA_ERR_NETWORK };
      }

      if (resp.status === 451) {
        return { state: FXA_ERR_GEO };
      }

      if (resp.status !== 200) {
        return { state: FXA_ERR_AUTH };
      }

      const json = await resp.json();

      return {
        state: FXA_OK,
        profileData: json.profile_data,
      };
    } catch (e) {
      return { state: FXA_ERR_NETWORK };
    }
  }

  syncIsRequestingToken() {
    let nowInSecs = Math.floor(Date.now() / 1000);

    return this.requestingToken ||
           !this.nextExpireTime ||
           nowInSecs >= this.nextExpireTime;
  }

  // This method returns a token, null or a Promise.
  askForProxyToken() {
    if (!this.syncIsRequestingToken()) {
      // Happy path!
      return this.cachedProxyTokenValue;
    }

    return this.maybeObtainToken().then(_ => this.cachedProxyTokenValue);
  }

  async forceToken(data) {
    await StorageUtils.setProxyTokenData(data);
    this.nextExpireTime = 0;
  }

  isAuthUrl(url) {
    // Let's skip our authentication flow.
    if (url.href.startsWith(this.service + "browser/oauth")) {
      return true;
    }

    // Let's skip the DOH URIs during the token generation.
    // Otherwise we can introduce a race condition: when we are generating a
    // token we try to do the DNS lookup, but DOH requires a valid token and we
    // start the generation of the token again...
    if (this.syncIsRequestingToken() &&
        this.dohHostnames.includes(url.hostname)) {
      return true;
    }

    return this.wellKnownData.isAuthUrl(url.origin);
  }

  excludedDomains() {
    const excludedDomains = this.wellKnownData.excludedDomains();
    return excludedDomains.concat(FXA_CDN_DOMAINS);
  }

  async fxAccountURL(path = "settings") {
    let contentServer = await this.wellKnownData.getIssuerEndpoint();

    let profileData = await StorageUtils.getProfileData();
    let url = new URL(`${contentServer}/${path}`);
    url.searchParams.set("uid", profileData.uid);
    url.searchParams.set("email", profileData.email);
    url.searchParams.set("entrypoint", "secure-proxy-desktop-settings");
    return url.href;
  }


  async prefetchWellKnownData() {
    return this.wellKnownData.fetch();
  }

  async resetToken() {
    let stateTokenData = await StorageUtils.getStateTokenData();
    if (stateTokenData) {
      const headers = new Headers();
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

    await StorageUtils.setStateTokenAndProfileData(null, null);
  }

  // check storage for optional flow params
  // if they don't exist just use an empty object
  async maybeFetchFxaFlowParams() {
    if (this.fxaFlowParams === undefined) {
      this.fxaFlowParams = await StorageUtils.getFxaFlowParams() || {};
    }
  }

  async digestTokenValue(tokenValue) {
    const tokenValueUint8 = new TextEncoder().encode(tokenValue);
    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenValueUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex.substr(0, 16);
  }

  async receiveCode(object) {
    const data = await this.completeAuthentication(object.statusCode, object.authCode);
    if (this.syncStateError(data)) {
      return data;
    }

    await StorageUtils.setStateTokenAndProfileData(object.statusCode, data.profileData);

    // Let's obtain the token immediately only if the migration is not
    // completed or the user is subscribed.
    const result = await this.maybeObtainToken();
    if (this.syncStateError(result)) {
      return { state: FXA_ERR_AUTH };
    }

    return { state: FXA_OK };
  }

  async maybeRecover() {
    log(`Maybe recover from the current state: ${this.cachedProxyState}`);
    const data = await this.maybeObtainToken();
    if (!this.syncStateError(data)) {
      await this.sendMessage("enableProxy", {enabledState: false, reason: "recovering"});
    }
  }
}
