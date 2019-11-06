import {Component} from "./component.js";
import {ConnectionTester} from "./connection.js";

// How often should we check the proxy connectivity in case of errors?
const PDC_TIME = 3600; // 1 hour

export class ProxyDownChecker extends Component {
  constructor(receiver) {
    super(receiver);

    this.lastCheckTime = 0;
    this.checking = false;
  }

  async init() {
    if (browser.captivePortal.canonicalURL) {
      this.captivePortalUrl = await browser.captivePortal.canonicalURL.get({});
    } else {
      const prefs = await browser.experiments.proxyutils.settings.get({});
      this.captivePortalUrl = prefs.value.captiveDetect;
    }
  }

  syncRun() {
    log("Performing a proxy down check");

    // The following proxy states are risky. More likely it's our fault.
    if (this.cachedProxyState === PROXY_STATE_PROXYAUTHFAILED ||
        this.cachedProxyState === PROXY_STATE_LOADING ||
        this.cachedProxyState === PROXY_STATE_UNAUTHENTICATED ||
        this.cachedProxyState === PROXY_STATE_GEOFAILURE ||
        this.cachedProxyState === PROXY_STATE_AUTHFAILURE) {
      log(`No checking for the current proxy state: ${this.cachedProxyState}`);
      return;
    }

    if (this.checking) {
      log("Performing already in progress. Skip.");
      return;
    }

    // eslint-disable-next-line verify-await/check
    let now = Date.now();
    let nowInSecs = Math.floor(now / 1000);
    if ((this.lastCheckTime + PDC_TIME) > nowInSecs) {
      // We can wait a bit more before running another check.
      log("Proxy down check postponed");
      return;
    }

    this.checking = true;

    // We consider the proxy down in case the following conditions happens
    // twice in a row:
    // - a connection through the proxy fails.
    // - a connection outside the proxy outside the proxy doesn't fail.
    // The 2 connections are executed "at the same time".


    // Don't await the response here
    // eslint-disable-next-line verify-await/check
    this.runTestsHandler();
  }

  async runTestsHandler() {
    try {
      await this.runTests();
      await this.runTests();

      log("The proxy is down!");
      this.syncSendMessage("telemetry", { category: "networking", event: "proxyDown" });
    } catch (e) {
      log("All up or all down. We don't want to report this.");
    } finally {
      this.checking = false;
      // eslint-disable-next-line verify-await/check
      this.lastCheckTime = Date.now();
    }
  }

  runTests() {
    return Promise.all([
      // ConnectionTester fetches a resource through the proxy. We want to see
      // this failing.
      new Promise((resolve, reject) => {
        // We want to resolve in case of failure!
        // eslint-disable-next-line verify-await/check
        ConnectionTester.run(this.receiver).then(reject, resolve);
      }),

      // Here a request that doesn't go through the proxy.
      fetch(this.captivePortalUrl).then(response => {
        if (response.status !== 200) {
          throw new Error("Captive portal is down?!?");
        }
      }),
    ]);
  }
}
