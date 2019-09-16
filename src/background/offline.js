import {ConnectionTester} from "./connection.js";
import {Component} from "./component.js";

export class OfflineManager extends Component {
  constructor(receiver) {
    super(receiver);

    this.timeoutId = 0;
  }

  setProxyState(proxyState) {
    super.setProxyState(proxyState);

    clearTimeout(this.timeoutId);
    this.timeoutId = 0;

    this.syncResetTimeout();

    if (this.cachedProxyState !== PROXY_STATE_OFFLINE &&
        this.cachedProxyState !== PROXY_STATE_PROXYERROR) {
      return;
    }

    // eslint-disable-next-line verify-await/check
    this.syncScheduleProxyConnection();
  }

  syncScheduleProxyConnection() {
    log("Scheduling the proxy connection");

    // Let's try to recover from a offline state.
    this.timeoutId = setTimeout(async _ => this.testProxyConnection(), this.timeout * 1000);
  }

  async testProxyConnection() {
    log("Testing the proxy connection");

    this.timeoutId = 0;

    try {
      await ConnectionTester.run(this.receiver);

      // Duplicate the timeout for the next round.
      this.syncResetTimeout();

      await this.sendMessage("onlineDetected");
    } catch (e) {
      log("We are still offline");

      // Duplicate the timeout for the next round.
      this.timeout *= 2;

      this.syncScheduleProxyConnection();
    }
  }

  syncResetTimeout() {
    // Reset the timeout (in secs).
    this.timeout = 1;
  }
}
