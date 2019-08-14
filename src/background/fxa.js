// FxA openID configuration
const FXA_OPENID = "https://accounts.firefox.com/.well-known/openid-configuration";

// List of attributes for the openID configuration
const FXA_ENDPOINT_PROFILE = "userinfo_endpoint";
const FXA_ENDPOINT_TOKEN = "token_endpoint";
const FXA_ENDPOINT_ISSUER = "issuer";

const FETCH_TIMEOUT = 10000; // 10 secs

// Token scopes
const FXA_PROFILE_SCOPE = "profile";
const FXA_PROXY_SCOPE = "https://identity.mozilla.com/apps/secure-proxy";

// The client ID for this extension
const FXA_CLIENT_ID = "a8c528140153d1c6";

// Token expiration time
const FXA_EXP_TOKEN_TIME = 21600; // 6 hours
const FXA_EXP_WELLKNOWN_TIME = 3600; // 1 hour

// How early we want to re-generate the tokens (in secs)
const EXPIRE_DELTA = 3600;

/* eslint-disable-next-line no-unused-vars */
class FxAUtils extends Component {
  constructor(receiver) {
    super(receiver);

    this.fxaEndpoints = new Map();
    this.fxaEndpointsReceivedAt = 0;

    // This is Set of pending operatations to do after a token generation.
    this.postTokenGenerationOps = new Set();
    this.generatingTokens = false;

    this.nextExpireTime = 0;
  }

  async init(prefs) {
    this.fxaOpenID = prefs.value.fxaURL || FXA_OPENID;
    this.proxyURL = new URL(prefs.value.proxyURL || PROXY_URL);

    let { fxaEndpointsReceivedAt } = await browser.storage.local.get(["fxaEndpointsReceivedAt"]);
    if (fxaEndpointsReceivedAt) {
      this.fxaEndpointsReceivedAt = fxaEndpointsReceivedAt;
    }

    // Let's start the fetching, but without waiting for the result.
    this.fetchWellKnownData();
  }

  hasWellKnownData() {
    return this.fxaEndpoints.size !== 0;
  }

  async fetchWellKnownData() {
    log("Fetching well-known data");

    let now = performance.timeOrigin + performance.now();
    let nowInSecs = Math.round(now / 1000);

    if ((this.fxaEndpointsReceivedAt + FXA_EXP_WELLKNOWN_TIME) > nowInSecs) {
      log("Well-knonw data cache is good");
      return true;
    }

    log("Fetching well-known data for real");

    // Let's fetch the data with a timeout of FETCH_TIMEOUT milliseconds.
    let json = await Promise.race([
      fetch(this.fxaOpenID).then(r => r.json(), e => null),
      new Promise(resolve => {
        setTimeout(_ => resolve(null), FETCH_TIMEOUT);
      }),
    ]);

    if (!json) {
      return false;
    }

    this.fxaEndpoints.set(FXA_ENDPOINT_PROFILE, json[FXA_ENDPOINT_PROFILE]);
    this.fxaEndpoints.set(FXA_ENDPOINT_TOKEN, json[FXA_ENDPOINT_TOKEN]);
    this.fxaEndpoints.set(FXA_ENDPOINT_ISSUER, json[FXA_ENDPOINT_ISSUER]);

    this.fxaEndpointsReceivedAt = nowInSecs;

    await browser.storage.local.set({ fxaEndpointsReceivedAt: this.fxaEndpointsReceivedAt });

    return true;
  }

  async authenticate() {
    if (!this.fetchWellKnownData()) {
      throw new Error("Failure fetching well-known data");
    }

    // Let's do the authentication. This will generate a token that is going to
    // be used just to obtain the other ones.
    let refreshTokenData = await this.generateRefreshToken();
    if (!refreshTokenData) {
      throw new Error("No refresh token");
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
      throw new Error("Token generation failed");
    }
  }

  async maybeGenerateTokens() {
    log("maybe generate tokens");

    if (this.generatingTokens) {
      log("token generation in progress. Let's wait.");
      return new Promise(resolve => { this.postTokenGenerationOps.add(resolve); });
    }

    this.generatingTokens = true;
    const result = await this.maybeGenerateTokensInternal();
    this.generatingTokens = false;

    // Let's take all the ops and execute them.
    let ops = this.postTokenGenerationOps;
    this.postTokenGenerationOps = new Set();
    ops.forEach(value => value(result));

    return result;
  }

  async maybeGenerateTokensInternal() {
    let { refreshTokenData } = await browser.storage.local.get(["refreshTokenData"]);
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

    let profileTokenData = await this.maybeGenerateSingleToken("profileTokenData",
                                                               refreshTokenData,
                                                               FXA_PROFILE_SCOPE,
                                                               this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE));
    if (profileTokenData === false) {
      return false;
    }

    let { profileData } = await browser.storage.local.get(["profileData"]);
    // Let's obtain the profile data for the user.
    if (!profileData || profileTokenData.tokenGenerated) {
      profileData = await this.generateProfileData(profileTokenData.tokenData);
      if (!profileData) {
        return false;
      }
    }

    await browser.storage.local.set({
      proxyTokenData: proxyTokenData.tokenData,
      profileTokenData: profileTokenData.tokenData,
      profileData,
    });

    // Let's pick the min time diff.
    let minDiff = Math.min(proxyTokenData.minDiff, profileTokenData.minDiff);

    // Let's schedule the token rotation.
    this.tokenGenerationTimeout = setTimeout(async _ => {
      if (!await this.maybeGenerateTokens()) {
        log("token generation failed");
        await this.sendMessage("authenticationFailed");
      }
    }, minDiff * 1000);

    this.nextExpireTime = Math.min(proxyTokenData.tokenData.received_at + proxyTokenData.tokenData.expires_in,
                                   profileTokenData.tokenData.received_at + profileTokenData.tokenData.expires_in);

    this.sendMessage("tokenGenerated", {
      tokenType: proxyTokenData.tokenData.token_type,
      tokenValue: proxyTokenData.tokenData.access_token,
    });

    return true;
  }

  async maybeGenerateSingleToken(tokenName, refreshTokenData, scope, resource) {
    log(`maybe generate token:  ${tokenName}`);

    let minDiff = 0;
    let tokenGenerated = false;

    let now = performance.timeOrigin + performance.now();
    let nowInSecs = Math.round(now / 1000);

    let data = await browser.storage.local.get([tokenName]);
    let tokenData = data[tokenName];
    if (tokenData) {
      // If we are close to the expiration time, we have to generate the token.
      // We want to keep a big time margin: 1 hour seems good enough.
      let diff = tokenData.received_at + tokenData.expires_in - nowInSecs - EXPIRE_DELTA;
      if (diff < EXPIRE_DELTA) {
        log("token exists but it's expired.");
        tokenData = null;
      } else {
        log(`token expires in ${minDiff}`);
        minDiff = diff;
      }
    }

    if (!tokenData) {
      log("checking well-known data");
      if (!this.fetchWellKnownData()) {
        return false;
      }

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

    const request = new Request(this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE), {
      method: "GET",
      headers,
    });

    const resp = await fetch(request);
    if (resp.status !== 200) {
      log("profile data generation failed: " + resp.status);
      return null;
    }

    return resp.json();
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

  async generateToken(refreshTokenData, scope, resource) {
    log("generate token - scope: " + scope);

    // See https://github.com/mozilla/fxa/blob/0ed71f677637ee5f817fa17c265191e952f5500e/packages/fxa-auth-server/fxa-oauth-server/docs/pairwise-pseudonymous-identifiers.md
    const ppid_seed = Math.floor(Math.random() * 1024);

    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const request = new Request(this.fxaEndpoints.get(FXA_ENDPOINT_TOKEN), {
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

  waitForTokenGeneration() {
    let nowInSecs = Math.round((performance.timeOrigin + performance.now()) / 1000);
    if (this.nextExpireTime && nowInSecs >= this.nextExpireTime) {
      log("Suspend detected!");
      return this.maybeGenerateTokens();
    }

    return null;
  }

  isAuthUrl(origin) {
    if (!this.hasWellKnownData()) {
      return false;
    }

    // If is part of oauth also ignore
    const authUrls = [
      this.fxaOpenID,
      this.fxaEndpoints.get(FXA_ENDPOINT_PROFILE),
      this.fxaEndpoints.get(FXA_ENDPOINT_TOKEN),
    ];

    return authUrls.some((item) => {
      return new URL(item).origin === origin;
    });
  }

  excludedDomains() {
    let excludedDomains = [];

    if (this.hasWellKnownData()) {
      [FXA_ENDPOINT_PROFILE, FXA_ENDPOINT_TOKEN, FXA_ENDPOINT_ISSUER].forEach(e => {
        try {
          excludedDomains.push(new URL(this.fxaEndpoints.get(e)).hostname);
        } catch (e) {}
      });
    }

    return excludedDomains;
  }

  async manageAccountURL() {
    if (!this.hasWellKnownData()) {
      throw new Error("We are not supposed to be here.");
    }

    let contentServer = this.fxaEndpoints.get(FXA_ENDPOINT_ISSUER);
    let { profileData } = await browser.storage.local.get(["profileData"]);
    let url = new URL(contentServer + "/settings");
    url.searchParams.set("uid", profileData.uid);
    url.searchParams.set("email", profileData.email);
    return url.href;
  }
}
