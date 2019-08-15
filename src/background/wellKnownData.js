// FxA openID configuration
const FXA_OPENID = "https://accounts.firefox.com/.well-known/openid-configuration";

// List of attributes for the openID configuration
const FXA_ENDPOINT_PROFILE = "userinfo_endpoint";
const FXA_ENDPOINT_TOKEN = "token_endpoint";
const FXA_ENDPOINT_ISSUER = "issuer";

const FETCH_TIMEOUT = 10000; // 10 secs

// Token expiration time
const FXA_EXP_WELLKNOWN_TIME = 3600; // 1 hour

// A class to fetch well-known data only when needed.
// Well-known data resource is fetched only when required and if the current
// data is expired. The TTL is 1 hour.

/* eslint-disable-next-line no-unused-vars */
class WellKnownData {
  constructor() {
    this.fxaEndpoints = new Map();
    this.fxaEndpointsReceivedAt = 0;
  }

  async init(prefs) {
    this.fxaOpenID = prefs.value.fxaURL || FXA_OPENID;
    this.fxaEndpointsReceivedAt = 0;
  }

  syncGetEndpoint(name) {
    return this.fxaEndpoints.get(name);
  }

  syncSetEndpoint(name, value) {
    return this.fxaEndpoints.set(name, value);
  }

  hasWellKnownData() {
    return this.fxaEndpoints.size !== 0;
  }

  async fetch() {
    log("Fetching well-known data");

    let now = performance.timeOrigin + performance.now();
    let nowInSecs = Math.round(now / 1000);

    if ((this.fxaEndpointsReceivedAt + FXA_EXP_WELLKNOWN_TIME) > nowInSecs) {
      log("Well-knonw data cache is good");
      return true;
    }

    log("Fetching well-known data for real");

    // Let's fetch the data with a timeout of FETCH_TIMEOUT milliseconds.
    let json;
    try {
      json = await Promise.race([
        fetch(this.fxaOpenID).then(r => r.json(), e => {
          console.error("Failed to fetch the well-known resource", e);
          return null;
        }),
        new Promise(resolve => {
          setTimeout(_ => resolve(null), FETCH_TIMEOUT);
        }),
      ]);
    } catch (e) {
      console.error("Failed to fetch the well-known resource", e);
    }

    if (!json) {
      return false;
    }

    this.syncSetEndpoint(FXA_ENDPOINT_PROFILE, json[FXA_ENDPOINT_PROFILE]);
    this.syncSetEndpoint(FXA_ENDPOINT_TOKEN, json[FXA_ENDPOINT_TOKEN]);
    this.syncSetEndpoint(FXA_ENDPOINT_ISSUER, json[FXA_ENDPOINT_ISSUER]);

    this.fxaEndpointsReceivedAt = nowInSecs;
    return true;
  }

  isAuthUrl(origin) {
    if (new URL(this.fxaOpenID).origin === origin) {
      return true;
    }

    if (!this.hasWellKnownData()) {
      return false;
    }

    // If is part of oauth also ignore
    const authUrls = [
      this.syncGetEndpoint(FXA_ENDPOINT_PROFILE),
      this.syncGetEndpoint(FXA_ENDPOINT_TOKEN),
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
          // eslint-disable-next-line verify-await/check
          excludedDomains.push(new URL(this.syncGetEndpoint(e)).hostname);
        } catch (e) {}
      });
    }

    return excludedDomains;
  }

  async getIssuerEndpoint() {
    return this.getGenericEndpoint(FXA_ENDPOINT_ISSUER);
  }

  async getProfileEndpoint() {
    return this.getGenericEndpoint(FXA_ENDPOINT_PROFILE);
  }

  async getTokenEndpoint() {
    return this.getGenericEndpoint(FXA_ENDPOINT_TOKEN);
  }

  async getGenericEndpoint(endpoint) {
    await this.fetch();
    return this.syncGetEndpoint(endpoint);
  }
}
