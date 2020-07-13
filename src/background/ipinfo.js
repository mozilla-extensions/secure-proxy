import {Component} from "./component.js";
import {Logger} from "./logger.js";

const log = Logger.logger("IPInfo");

export class IPInfo extends Component {
  constructor(receiver) {
    super(receiver);

    this.pendingRequests = [];
    this.fetching = false;
    this.ipInfo = null;
  }

  setProxyState(proxyState) {
    log(`set proxy state: ${proxyState}`);

    if (proxyState !== PROXY_STATE_ACTIVE) {
      this.ipInfo = null;
      return;
    }

    this.fetch();
  }

  async init() {
    log("init");
    this.service = await ConfigUtils.getSPService();
  }

  async fetch() {
    log("maybe fetch ip info");

    if (this.ipInfo !== null) {
      log("Data already available");
      return this.ipInfo;
    }

    if (this.fetching) {
      log("Already fetching data. Queue the operation");

      await new Promise(resolve => {
        this.pendingRequests.push(resolve);
      });

      return this.ipInfo;
    }

    this.fetching = true;
    const data = await this.fetchInternal();
    this.fetching = false;

    this.ipInfo = data;

    // Process pending operations.
    log(`We have ${this.pendingRequests.length} pending requests`);
    while (this.pendingRequests.length) {
      this.pendingRequests.shift()();
    }

    return this.ipInfo;
  }

  async fetchInternal() {
    log("Fetch internal");

    const request = new Request(this.service + "browser/oauth/ipinfo", {
      method: "GET",
    });

    try {
      let resp = await Promise.race([
        fetch(request, {cache: "no-cache"}),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000))
      ]);

      if (!resp || resp.status !== 200) {
        return null;
      }

      return await resp.json();
    } catch (e) {
      return null;
    }
  }

  isIpInfoUrl(url) {
    log("ipinfo URL check");
    // the IP info check _must_ be executed through the proxy.
    return url.href === this.service + "browser/oauth/ipinfo";
  }
}
