import {Component} from "./component.js";
import {constants} from "./constants.js";
import {Logger} from "./logger.js";

const log = Logger.logger("MobileEvents");

export class MobileEvents extends Component {
  async init() {
    if (!constants.isAndroid) {
      return;
    }

    // eslint-disable-next-line verify-await/check
    let port = browser.runtime.connectNative("mozacSecureProxy");
    port.onMessage.addListener(async message => {
      switch (message.action) {
        case "sendCode":
          log("Received sendCode");
          await this.sendMessage("sendCode", message);
          return;

        case "disableProxy":
          log("Received disableProxy");
          // reason is a NOOP as mobile uses its own telemetry
          await this.sendMessage("enableProxy", {enabledState: false, reason: "mobile"});
          return;

        case "enableProxy":
          log("Received enableProxy");
          // reason is a NOOP as mobile uses its own telemetry
          await this.sendMessage("enableProxy", {enabledState: true, reason: "mobile"});
          return;

        default:
          console.error(`Received invalid action ${message.action}`);
      }
    });
  }
}
