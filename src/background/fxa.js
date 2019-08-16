import {Component} from "./component.js";
import {StorageUtils} from "./storage.js";
import {WellKnownData} from "./wellKnownData.js";

// Token scopes
const FXA_PROFILE_SCOPE = "profile";
const FXA_PROXY_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";

// The client ID for this extension
const FXA_CLIENT_ID = "a8c528140153d1c6";

// Token expiration time
const FXA_EXP_TOKEN_TIME = 21600; // 6 hours

// How early we want to re-generate the tokens (in secs)
const EXPIRE_DELTA = 3600;

/* eslint-disable-next-line no-unused-vars */
export class FxAUtils extends Component {
  constructor(receiver) {
    super(receiver);

    this.wellKnownData = new WellKnownData();

    // This is Set of pending operatations to do after a token generation.
    this.postTokenGenerationOps = new Set();
    this.generatingTokens = false;

    this.nextExpireTime = 0;
  }

  async init(prefs) {
    this.proxyURL = new URL(prefs.value.proxyURL || PROXY_URL);

    await this.wellKnownData.init(prefs);

    // Let's see if we have to generate new tokens, but without waiting for the
    // result.
    // eslint-disable-next-line verify-await/check
    this.maybeGenerateTokens();
  }

  async authenticate() {
    // Let's do the authentication. This will generate a token that is going to
    // be used just to obtain the other ones.
    let refreshTokenData = await this.generateRefreshToken();
    if (!refreshTokenData) {
      throw new Error("No refresh token");
    }

    // Let's store the refresh token and let's invalidate all the other tokens
    // in order to regenerate them.
    await StorageUtils.setAllTokenData(refreshTokenData, null, null, null);

    // Let's obtain the proxy token data. This method will dispatch a
    // "tokenGenerated" event.
    if (!await this.maybeGenerateTokens()) {
      throw new Error("Token generation failed");
    }
  }

  async maybeGenerateTokens() {
    log("maybe generate tokens");

    if (this.generatingTokens) {
      log("token generation in progress. Let's wait.");
      return new Promise(resolve => this.postTokenGenerationOps.add(resolve));
    }

    this.generatingTokens = true;
    const result = await this.maybeGenerateTokensInternal();
    this.generatingTokens = false;

    // Let's take all the ops and execute them.
    let ops = this.postTokenGenerationOps;
    this.postTokenGenerationOps = new Set();
    // eslint-disable-next-line verify-await/check
    ops.forEach(value => value(result));

    return result;
  }

  async maybeGenerateTokensInternal() {
    let refreshTokenData = await StorageUtils.getRefreshTokenData();
    if (!refreshTokenData) {
      return false;
    }

    let proxyTokenData = await this.maybeGenerateSingleToken("proxyTokenData",
                                                             refreshTokenData,
                                                             FXA_PROXY_SCOPE,
                                                             this.proxyURL.href);
    if (proxyTokenData === false) {
      return false;
    }

    const profileEndpoint = await this.wellKnownData.getProfileEndpoint();

    let profileTokenData = await this.maybeGenerateSingleToken("profileTokenData",
                                                               refreshTokenData,
                                                               FXA_PROFILE_SCOPE,
                                                               profileEndpoint);
    if (profileTokenData === false) {
      return false;
    }

    let profileData = await StorageUtils.getProfileData();
    // Let's obtain the profile data for the user.
    if (!profileData || profileTokenData.tokenGenerated) {
      profileData = await this.generateProfileData(profileTokenData.tokenData);
      if (!profileData) {
        return false;
      }
    }

    await StorageUtils.setDynamicTokenData(proxyTokenData.tokenData, profileTokenData.tokenData, profileData);

    // Let's pick the min time diff.
    let minDiff = Math.min(proxyTokenData.minDiff, profileTokenData.minDiff);

    // Let's schedule the token rotation.
    setTimeout(async _ => {
      if (!await this.maybeGenerateTokens()) {
        log("token generation failed");
        await this.sendMessage("authenticationFailed");
      }
    }, minDiff * 1000);

    this.nextExpireTime = Math.min(proxyTokenData.tokenData.received_at + proxyTokenData.tokenData.expires_in,
                                   profileTokenData.tokenData.received_at + profileTokenData.tokenData.expires_in);

    if (proxyTokenData.tokenGenerated) {
      // We cannot wait for this message because otherwise we create a bad
      // deadlock between the authentication process and the token generation
      // event.

      // eslint-disable-next-line verify-await/check
      this.sendMessage("tokenGenerated", {
        tokenType: proxyTokenData.tokenData.token_type,
        tokenValue: proxyTokenData.tokenData.access_token,
      });
    }

    return true;
  }

  async maybeGenerateSingleToken(tokenName, refreshTokenData, scope, resource) {
    log(`maybe generate token:  ${tokenName}`);

    let minDiff = 0;
    let tokenGenerated = false;

    let now = performance.timeOrigin + performance.now();
    let nowInSecs = Math.round(now / 1000);

    let tokenData = await StorageUtils.getStorageKey(tokenName);
    if (tokenData) {
      // If we are close to the expiration time, we have to generate the token.
      // We want to keep a big time margin: 1 hour seems good enough.
      let diff = tokenData.received_at + tokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      if (diff < EXPIRE_DELTA) {
        log(`Token exists but it is expired. Received at ${tokenData.received_at} and expires in ${tokenData.expires_in}`);
        tokenData = null;
      } else {
        log(`token expires in ${diff}`);
        minDiff = diff;
      }
    }

    if (!tokenData) {
      log("generating token");
      tokenData = await this.generateToken(refreshTokenData, scope, resource);
      if (!tokenData) {
        return false;
      }

      minDiff = tokenData.received_at + tokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      log(`token expires in ${minDiff}`);
      tokenGenerated = true;
    }

    return {
      minDiff,
      tokenData,
      tokenGenerated,
    };
  }

  async generateProfileData(profileTokenData) {
    log("generate profile data");

    const headers = new Headers({
      "Authorization": `Bearer ${profileTokenData.access_token}`
    });

    const profileEndpoint = await this.wellKnownData.getProfileEndpoint();
    const request = new Request(profileEndpoint, {
      method: "GET",
      headers,
    });

    try {
      const resp = await fetch(request);
      if (resp.status !== 200) {
        log("profile data generation failed: " + resp.status);
        return null;
      }

      return resp.json();
    } catch (e) {
      console.error("Failed to fetch profile data", e);
      return null;
    }
  }

  async generateRefreshToken() {
    log("generate refresh token");

    const contentServer = await this.wellKnownData.getIssuerEndpoint();
    const fxaKeysUtil = new fxaCryptoRelier.OAuthUtils({contentServer});

    let refreshTokenData;
    // This will trigger the authentication form.
    try {
      refreshTokenData = await fxaKeysUtil.launchWebExtensionFlow(FXA_CLIENT_ID, {
        // eslint-disable-next-line verify-await/check
        redirectUri: browser.identity.getRedirectURL(),
        scopes: [FXA_PROFILE_SCOPE, FXA_PROXY_SCOPE],
      });
    } catch (e) {
      console.error("Failed to fetch the refresh token", e);
    }

    return refreshTokenData;
  }

  async generateToken(refreshTokenData, scope, resource) {
    log("generate token - scope: " + scope);

    // See https://github.com/mozilla/fxa/blob/0ed71f677637ee5f817fa17c265191e952f5500e/packages/fxa-auth-server/fxa-oauth-server/docs/pairwise-pseudonymous-identifiers.md
    const ppid_seed = Math.floor(Math.random() * 1024);

    const headers = new Headers();
    // eslint-disable-next-line verify-await/check
    headers.append("Content-Type", "application/json");

    const tokenEndpoint = await this.wellKnownData.getTokenEndpoint();
    const request = new Request(tokenEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        /* eslint-disable camelcase*/
        client_id: FXA_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshTokenData.refresh_token,
        scope,
        ttl: FXA_EXP_TOKEN_TIME,
        ppid_seed,
        resource,
        /* eslint-enable camelcase*/
      })
    });

    let token;
    try {
      const resp = await fetch(request);
      if (resp.status !== 200) {
        log("token generation failed: " + resp.status);
        return null;
      }

      token = await resp.json();
    } catch (e) {
      console.error("Failed to fetch the token with scope: " + scope, e);
      return null;
    }

    // Let's store when this token has been received.
    token.received_at = Math.round((performance.timeOrigin + performance.now()) / 1000);

    return token;
  }

  waitForTokenGeneration() {
    let nowInSecs = Math.round((performance.timeOrigin + performance.now()) / 1000);
    if (this.generatingTokens ||
        (this.nextExpireTime && nowInSecs >= this.nextExpireTime)) {
      log("Suspend detected!");
      return this.maybeGenerateTokens();
    }

    return null;
  }

  isAuthUrl(origin) {
    return this.wellKnownData.isAuthUrl(origin);
  }

  excludedDomains() {
    return this.wellKnownData.excludedDomains();
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
}
