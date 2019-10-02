import {Component} from "./component.js";

// Parameters for DNS over HTTP
const DOH_MODE = 3;
const DOH_BOOTSTRAP_ADDRESS = "1.1.1.1";
const DOH_SKIP_CONFIRMATION_NS = "skip";
const DOH_REQUEST_TIMEOUT = 30000; // 30 secs

// Timeout between 1 network error and the next one.
const NET_ERROR_TIMEOUT = 5000; // 5 seconds.

// Telemetry host
const TELEMETRY_HOST = "https://incoming.telemetry.mozilla.org";

export class Network extends Component {
  constructor(receiver) {
    super(receiver);

    this.connectionId = 0;
    this.webSocketConnectionIsolationCounter = 0;

    this.proxyPassthrough = new Set();

    // Proxy configuration is activated only when setProxyState callback
    // indicates a state we would allow proxying for content requests.
    this.requestListener = null;
    // Call now, early at the startup stage, to not cause any hypotetical leaks.
    this.syncReconfigureProxyRequestCallback();

    this.processingNetworkError = false;

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

  async init(prefs) {
    const proxyURL = await ConfigUtils.getProxyURL();
    this.proxyType = proxyURL.protocol === "https:" ? "https" : "http";
    this.proxyPort = proxyURL.port || (proxyURL.protocol === "https:" ? 443 : 80);
    this.proxyHost = proxyURL.hostname;

    try {
      const capitivePortalUrl = new URL(prefs.value.captiveDetect);
      this.captivePortalOrigin = capitivePortalUrl.origin;
    } catch (e) {
      // ignore
    }

    await this.checkProxyPassthrough();
  }

  setProxyState(proxyState) {
    super.setProxyState(proxyState);
    this.syncReconfigureProxyRequestCallback();
  }

  /**
   * Reflect changes to states affecting the decision
   * whether proxy.onRequest should be set or not.
   */
  syncReconfigureProxyRequestCallback() {
    log(`proxy.onRequest reconfiguration, state=${this.cachedProxyState}`);

    if (this.syncShouldProxyInCurrentState()) {
      this.syncActivateProxyRequestCallback();
    } else {
      this.syncDeactivateProxyRequestCallback();
    }
  }

  syncNewProxyRequestCallback() {
    return requestInfo => {
      return this.proxyRequestCallback(requestInfo);
    };
  }

  syncActivateProxyRequestCallback() {
    if (!this.requestListener) {
      this.requestListener = this.syncNewProxyRequestCallback();
      browser.proxy.onRequest.addListener(this.requestListener, { urls: ["<all_urls>"] });
      log("proxy.onRequest listener has been added");
    } else {
      log("proxy.onRequest listener remains added");
    }
  }

  syncDeactivateProxyRequestCallback() {
    if (this.requestListener) {
      // eslint-disable-next-line verify-await/check
      browser.proxy.onRequest.removeListener(this.requestListener);
      this.requestListener = null;
      log("proxy.onRequest listener has been removed");
    } else {
      log("proxy.onRequest listener remains not-added");
    }
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

    // The token is "owned" by the FxA component. Let's ask for it. We can
    // obtain the token or a Promise which will be resolved with the token,
    // eventually.
    let token = this.syncSendMessage("askForProxyToken");
    if (token instanceof Promise) {
      token = await token;
    }

    let proxyAuthorizationHeader = "";
    let proxyAuthorizationHash = "";
    if (token && token.tokenType) {
      proxyAuthorizationHeader = token.tokenType + " " + token.tokenValue;
      proxyAuthorizationHash = token.tokenHash;
    } else if (token) {
      proxyAuthorizationHeader = "Bearer " + token.tokenHash;
    }

    return [{
      type: this.proxyType,
      host: this.proxyHost,
      port: this.proxyPort,
      proxyAuthorizationHeader,
      connectionIsolationKey: proxyAuthorizationHash + additionalConnectionIsolation + this.connectionId,
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
   * We want to continue the sending of requests to the proxy even if we
   * receive errors, in order to avoid exposing the IP when something goes
   * wrong.
   *
   * This also affects whether we set or not the proxy.onRequest callback.
   */
  syncShouldProxyInCurrentState() {
    if (this.cachedProxyState === PROXY_STATE_LOADING ||
        this.cachedProxyState === PROXY_STATE_UNAUTHENTICATED ||
        this.cachedProxyState === PROXY_STATE_AUTHFAILURE ||
        this.cachedProxyState === PROXY_STATE_INACTIVE ||
        this.cachedProxyState === PROXY_STATE_CONNECTING ||
        this.cachedProxyState === PROXY_STATE_CAPTIVE ||
        this.cachedProxyState === PROXY_STATE_OTHERINUSE) {
      return false;
    }

    return true;
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

    // This is our special testing connection, sent through the proxy, always.
    if (requestInfo.url === CONNECTING_HTTP_REQUEST) {
      return true;
    }

    if (!this.syncShouldProxyInCurrentState()) {
      return false;
    }

    // Just a check...
    if (this.cachedProxyState !== PROXY_STATE_ACTIVE &&
        this.cachedProxyState !== PROXY_STATE_OFFLINE &&
        this.cachedProxyState !== PROXY_STATE_PROXYERROR &&
        this.cachedProxyState !== PROXY_STATE_PROXYAUTHFAILED) {
      console.error("In which state are we?!?");
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

    // Telemetry pings should always being delivered. Because of this, we try
    // to send them through the proxy when we know the proxy is active, but if
    // an error has been detected, we send them directly.
    if (this.cachedProxyState !== PROXY_STATE_ACTIVE &&
        url.origin === TELEMETRY_HOST) {
      return false;
    }

    // Whitelisted.
    // eslint-disable-next-line verify-await/check
    if (this.proxyPassthrough.has(url.hostname)) {
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
        confirmationNS: DOH_SKIP_CONFIRMATION_NS,
        requestTimeout: DOH_REQUEST_TIMEOUT,
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

    // Network errors are sent as events to the Main component which processes
    // them 1 by 1. Some of them trigger token rotations and connection tests.
    // Because of that, we want to avoid flooding the Main component with
    // network error events in a short time frame. Let's send 1 event only any
    // NET_ERROR_TIMEOUT milliseconds.

    if (this.processingNetworkError) {
      return;
    }

    this.processingNetworkError = true;

    // If the error has been propaged as event to the Main component, we wait a
    // bit before processing the next one.
    if (await this.processNetworkErrorInternal(errorStatus)) {
      setTimeout(_ => { this.processingNetworkError = false; }, NET_ERROR_TIMEOUT);
    }
  }

  async processNetworkErrorInternal(errorStatus) {
    if (errorStatus === "NS_ERROR_PROXY_AUTHENTICATION_FAILED") {
      await this.sendMessage("proxyAuthenticationFailed");
      this.syncSendMessage("telemetry", { category: "networking", event: "407" });
      return true;
    }

    if (errorStatus === "NS_ERROR_TOO_MANY_REQUESTS") {
      await this.sendMessage("proxyTooManyRequests");
      this.syncSendMessage("telemetry", { category: "networking", event: "429" });
      return true;
    }

    if (errorStatus === "NS_ERROR_PROXY_CONNECTION_REFUSED" ||
        errorStatus === "NS_ERROR_UNKNOWN_PROXY_HOST" ||
        errorStatus === "NS_ERROR_PROXY_BAD_GATEWAY" ||
        errorStatus === "NS_ERROR_PROXY_GATEWAY_TIMEOUT") {
      await this.sendMessage("proxyGenericError");
      return true;
    }

    log("Ignored network error: " + errorStatus);
    return false;
  }

  async checkProxyPassthrough() {
    log("Check proxy passthrough");
    const proxySettings = await browser.proxy.settings.get({});

    // eslint-disable-next-line verify-await/check
    this.proxyPassthrough.clear();
    // eslint-disable-next-line verify-await/check
    proxySettings.value.passthrough.split(",").forEach(host => {
      // eslint-disable-next-line verify-await/check
      this.proxyPassthrough.add(host.trim());
    });
  }
}
