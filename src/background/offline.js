import {Component} from "./component.js";

const OFFLINE_TIMEOUT = 5000; // 5 secs

export class OfflineManager extends Component {
  constructor(receiver) {
    super(receiver);

    this.timeoutId = 0;
  }

  async init() {
    // Nothing here.
  }

  setProxyState(proxyState) {
    super.setProxyState(proxyState);

    clearTimeout(this.timeoutId);
    this.timeoutId = 0;

    if (this.cachedProxyState !== PROXY_STATE_OFFLINE) {
      return;
    }

    this.scheduleProxyConnection();
  }

  scheduleProxyConnection() {
    log("Scheduling the proxy connection");

    // Let's try to recover from a offline state.
    this.timeoutId = setTimeout(async _ => await this.testProxyConnection(), OFFLINE_TIMEOUT);
  }

  async testProxyConnection() {
    log("Testing the proxy connection");

    this.timeoutId = 0;

    try {
      await ConnectionTester.run();
      await this.sendMessage("onlineDetected");
    } catch (e) {
      log("We are still offline");
      this.scheduleProxyConnection();
    }
  }
}
