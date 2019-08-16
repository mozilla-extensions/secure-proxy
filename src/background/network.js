import {Component} from "./component.js";

// Testing URL. This request is sent with the proxy settings when we are in
// connecting state. If this succeeds, we go to active state.
const CONNECTING_HTTP_REQUEST = "http://test.factor11.cloudflareclient.com/";

// Parameters for DNS over HTTP
const DOH_MODE = 3;
const DOH_BOOTSTRAP_ADDRESS = "1.1.1.1";

/* eslint-disable-next-line no-unused-vars */
export class Network extends Component {
  constructor(receiver) {
    super(receiver);

    this.connectionId = 0;
    this.webSocketConnectionIsolationCounter = 0;
  }

  async init(prefs) {
    const proxyURL = new URL(prefs.value.proxyURL || PROXY_URL);
    this.proxyType = proxyURL.protocol === "https:" ? "https" : "http";
    this.proxyPort = proxyURL.port || (proxyURL.protocol === "https:" ? 443 : 80);
    this.proxyHost = proxyURL.hostname;

    try {
      const capitivePortalUrl = new URL(prefs.value.captiveDetect);
      this.captivePortalOrigin = capitivePortalUrl.origin;
    } catch (e) {
      // ignore
    }

    // Proxy configuration
    browser.proxy.onRequest.addListener(async requestInfo => {
      return this.proxyRequestCallback(requestInfo);
    }, {urls: ["<all_urls>"]});

    // Handle header errors before we render the response
    browser.webRequest.onHeadersReceived.addListener(async details => {
      // eslint-disable-next-line verify-await/check
      let hasWarpError = !!details.responseHeaders.find((header) => {
        return header.name === "cf-warp-error" && header.value === "1";
      });

      // In case of HTTP error status codes, received by onCompleted(), we know that:
      // 1. the connection is a plain/text (HTTP, no HTTPS).
      // 2. if they are 'real', there is an extra cf-warp-error header, set by
      //    the proxy.
      if (hasWarpError) {
        switch (details.statusCode) {
          case 407:
            await this.processNetworkError(details.url, "NS_ERROR_PROXY_AUTHENTICATION_FAILED");
            break;

          case 429:
            await this.processNetworkError(details.url, "NS_ERROR_TOO_MANY_REQUESTS");
            break;
        }
      }

      // The proxy returns errors that are warped which we should show a real looking error page for
      // These only occur over http and we can't really handle sub resources
      // eslint-disable-next-line verify-await/check
      if ([502, 407, 429].includes(details.statusCode) &&
          details.tabId &&
          details.type === "main_frame" &&
          hasWarpError) {
        await browser.experiments.proxyutils.loadNetError(details.statusCode, details.url, details.tabId);
        return {cancel: true};
      }
      return {};
    }, {urls: ["http://*/*"]}, ["responseHeaders", "blocking"]);

    browser.webRequest.onErrorOccurred.addListener(async details => {
      await this.processNetworkError(details.url, details.error);
    }, {urls: ["<all_urls>"]});
  }

  syncTokenGenerated(tokenType, tokenValue) {
    this.proxyAuthorizationHeader = tokenType + " " + tokenValue;
  }

  async proxyRequestCallback(requestInfo) {
    // eslint-disable-next-line verify-await/check
    let shouldProxyRequest = this.shouldProxyRequest(requestInfo);
    // eslint-disable-next-line verify-await/check
    let additionalConnectionIsolation = this.additionalConnectionIsolation(requestInfo);

    log("proxy request for " + requestInfo.url + " => " + shouldProxyRequest);

    if (!shouldProxyRequest) {
      return {type: "direct"};
    }

    // Let's see if we have to wait for token generation.
    let wftg = this.syncSendMessage("waitForTokenGeneration");
    if (wftg !== null) {
      await wftg;
    }

    return [{
      type: this.proxyType,
      host: this.proxyHost,
      port: this.proxyPort,
      proxyAuthorizationHeader: this.proxyAuthorizationHeader,
      connectionIsolationKey: this.proxyAuthorizationHeader + additionalConnectionIsolation + this.connectionId,
    }];
  }

  increaseConnectionIsolation() {
    this.connectionId += 1;
  }

  additionalConnectionIsolation(requestInfo) {
    function isWebsocket(url) {
      return url.protocol === "wss:" || url.protocol === "ws:";
    }

    const url = new URL(requestInfo.url);

    if (isWebsocket(url)) {
      const isolation = ++this.webSocketConnectionIsolationCounter;
      return `-ws(${isolation})`;
    }

    return "";
  }

  /**
   * Decides if we should be proxying the request.
   * Returns true if the request should be proxied
   * Returns null if the request is internal and shouldn't count.
   */
  shouldProxyRequest(requestInfo) {
    function isProtocolSupported(url) {
      return url.protocol === "http:" ||
             url.protocol === "https:" ||
             url.protocol === "ftp:" ||
             url.protocol === "wss:" ||
             url.protocol === "ws:";
    }

    function isLocal(url) {
      let hostname = url.hostname;
      return (/^(.+\.)?localhost$/.test(hostname) ||
        /^(.+\.)?localhost6$/.test(hostname) ||
        /^(.+\.)?localhost.localdomain$/.test(hostname) ||
        /^(.+\.)?localhost6.localdomain6$/.test(hostname) ||
        // https://tools.ietf.org/html/rfc2606
        /\.example$/.test(hostname) ||
        /\.invalid$/.test(hostname) ||
        /\.test$/.test(hostname) ||
        // https://tools.ietf.org/html/rfc8375
        /^(.+\.)?home\.arpa$/.test(hostname) ||
        // https://tools.ietf.org/html/rfc6762
        /\.local$/.test(hostname) ||
        // Loopback
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        // Link Local
        /^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        // Private use
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        // Private use
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        // Private use
        /^172\.1[6-9]\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.2[0-9]\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.3[0-1]\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /\[[0:]+1\]/.test(hostname));
    }

    // We want to continue the sending of requests to the proxy even if we
    // receive errors, in order to avoid exposing the IP when something goes
    // wrong.
    if (this.cachedProxyState !== PROXY_STATE_ACTIVE &&
        this.cachedProxyState !== PROXY_STATE_PROXYERROR &&
        this.cachedProxyState !== PROXY_STATE_PROXYAUTHFAILED &&
        this.cachedProxyState !== PROXY_STATE_CONNECTING) {
      return false;
    }

    // If we are 'connecting' or 'offline' state, we want to allow just the
    // CONNECTING_HTTP_REQUEST.
    if (this.cachedProxyState === PROXY_STATE_CONNECTING ||
        this.cachedProxyState === PROXY_STATE_OFFLINE) {
      return requestInfo.url === CONNECTING_HTTP_REQUEST;
    }

    // Just to avoid recreating the URL several times, let's cache it.
    const url = new URL(requestInfo.url);

    // Let's skip captive portal URLs.
    if (this.captivePortalOrigin && this.captivePortalOrigin === url.origin) {
      return false;
    }

    // Only http/https/ftp requests
    if (!isProtocolSupported(url)) {
      return false;
    }

    // If the request is local, ignore
    if (isLocal(url)) {
      return false;
    }

    // Do we have to skip this request?
    // skipProxy is sync
    if (this.syncSendMessage("skipProxy", { requestInfo, url, })) {
      return false;
    }

    return true;
  }

  syncAfterConnectionSteps() {
    // We need to exclude FxA endpoints in order to avoid a deadlock:
    // 1. a new request is processed, but the tokens are invalid. We start the
    //    generation of a new token.
    // 2. The generation of tokens starts a new network request which will be
    //    processed as the previous point. This is deadlock.
    let excludedDomains = this.syncSendMessage("excludedDomains");
    // eslint-disable-next-line verify-await/check
    excludedDomains.push(this.proxyHost);

    // eslint-disable-next-line verify-await/check
    browser.experiments.proxyutils.DNSoverHTTP.set({
      value: {
        mode: DOH_MODE,
        bootstrapAddress: DOH_BOOTSTRAP_ADDRESS,
        // eslint-disable-next-line verify-await/check
        excludedDomains: excludedDomains.join(","),
      }
    });

    // eslint-disable-next-line verify-await/check
    browser.experiments.proxyutils.FTPEnabled.set({value: false});
  }

  inactiveSteps() {
    // eslint-disable-next-line verify-await/check
    browser.experiments.proxyutils.DNSoverHTTP.clear({});
    // eslint-disable-next-line verify-await/check
    browser.experiments.proxyutils.FTPEnabled.clear({});
  }

  async processNetworkError(url, errorStatus) {
    log(`processNetworkError: ${url}  ${errorStatus}`);

    if (errorStatus === "NS_ERROR_PROXY_AUTHENTICATION_FAILED") {
      await this.sendMessage("proxyAuthenticationFailed");
      return;
    }

    if (errorStatus === "NS_ERROR_PROXY_CONNECTION_REFUSED" ||
        errorStatus === "NS_ERROR_TOO_MANY_REQUESTS") {
      await this.sendMessage("proxyGenericError");
      return;
    }

    if (this.connectionTester &&
        (this.cachedProxyState === PROXY_STATE_CONNECTING ||
         this.cachedProxyState === PROXY_STATE_OFFLINE) &&
        url === CONNECTING_HTTP_REQUEST &&
        (errorStatus === "NS_ERROR_UNKNOWN_PROXY_HOST" ||
         errorStatus === "NS_ERROR_ABORT")) {
      // eslint-disable-next-line verify-await/check
      this.connectionTester.rejectCb();
    }
  }

  testProxyConnection() {
    this.connectionTester = new ConnectionTester();
    return this.connectionTester.run();
  }
}

class ConnectionTester {
  run() {
    browser.webRequest.onHeadersReceived.addListener(details => {
      if (details.statusCode === 200) {
        // eslint-disable-next-line verify-await/check
        this.resolveCb();
      }
    }, {urls: [CONNECTING_HTTP_REQUEST]}, ["responseHeaders", "blocking"]);

    return new Promise((resolve, reject) => {
      log("executing a fetch to check the connection");

      // We don't care about the result of this fetch.
      // eslint-disable-next-line verify-await/check
      fetch(CONNECTING_HTTP_REQUEST, { cache: "no-cache"}).catch(_ => {});

      this.resolveCb = resolve;
      this.rejectCb = reject;
    });
  }
}
