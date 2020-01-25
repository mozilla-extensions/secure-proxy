import {Component} from "./component.js";
import {Logger} from "./logger.js";
import {StorageUtils} from "./storageUtils.js";

const log = Logger.logger("ExternalHandler");

// This component handles message from external extensions
// It's current use is to accept configuration of the addon
export class ExternalHandler extends Component {
  constructor(receiver) {
    super(receiver);

    browser.runtime.onMessageExternal.addListener(message => this.handleExternalMessage(message));
  }

  // eslint-disable-next-line consistent-return
  async handleExternalMessage(message) {
    log("Got external message", message);
    switch (message.type) {
      case "getCurrentConfig":
        return ConfigUtils.getCurrentConfig();
      case "setDebuggingEnabled":
        return ConfigUtils.setDebuggingEnabled(message.value);
      case "setReminder":
        return ConfigUtils.setReminder(message.value);
      case "setAutoRenew":
        return ConfigUtils.setAutoRenew(message.value);
      case "setPassesTimeout":
        return ConfigUtils.setPassesTimeout(message.value);
      case "setProxyURL":
        return ConfigUtils.setProxyURL(message.value);
      case "setProxyMode":
        return ConfigUtils.setProxyMode(message.value);
      case "setSPService":
        return ConfigUtils.setSPService(message.value);
      case "setFxaOpenID":
        return ConfigUtils.setFxaOpenID(message.value);
      case "getProxyToken":
        return StorageUtils.getProxyTokenData();
      case "setProxyToken":
        return this.sendMessage("forceToken", message.value);
      case "reload":
        return browser.runtime.reload();
      case "clear":
        await browser.storage.local.clear();
        return browser.runtime.reload();
      default:
        console.error("unhandled message from external extension");
    }
  }
}
