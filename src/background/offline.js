import {ConnectionTester} from "./connection.js";
import {Component} from "./component.js";

const OFFLINE_TIMEOUT = 5000; // 5 secs

export class OfflineManager extends Component {
  constructor(receiver) {
    super(receiver);

    this.timeoutId = 0;
  }

  setProxyState(proxyState) {
    super.setProxyState(proxyState);

    clearTimeout(this.timeoutId);
    this.timeoutId = 0;

    if (this.cachedProxyState !== PROXY_STATE_OFFLINE) {
      return;
    }

    // eslint-disable-next-line verify-await/check
    this.syncScheduleProxyConnection();
  }

  syncScheduleProxyConnection() {
    log("Scheduling the proxy connection");

    // Let's try to recover from a offline state.
    this.timeoutId = setTimeout(async _ => this.testProxyConnection(), OFFLINE_TIMEOUT);
  }

  async testProxyConnection() {
    log("Testing the proxy connection");

    this.timeoutId = 0;

    try {
      await ConnectionTester.run(this.receiver);
      await this.sendMessage("onlineDetected");
    } catch (e) {
      log("We are still offline");
      this.syncScheduleProxyConnection();
    }
  }
}
