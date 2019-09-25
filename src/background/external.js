import {Component} from "./component.js";
import {StorageUtils} from "./storageUtils.js";

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
      case "setProxyURL":
        return ConfigUtils.setProxyURL(message.value);
      case "setSPService":
        return ConfigUtils.setSPService(message.value);
      case "setFxaOpenID":
        return ConfigUtils.setFxaOpenID(message.value);
      case "setFxaExpirationTime":
        // eslint-disable-next-line verify-await/check
        return ConfigUtils.setFxaExpirationTime(parseInt(message.value, 10));
      case "setFxaExpirationDelta":
        // eslint-disable-next-line verify-await/check
        return ConfigUtils.setFxaExpirationDelta(parseInt(message.value, 10));
      case "getTokens":
        return {
          proxy: await StorageUtils.getStorageKey("proxyTokenData"),
          profile: await StorageUtils.getStorageKey("profileTokenData"),
        };
      case "setProxyToken":
        return this.sendMessage("forceToken", { proxy: message.value });
      case "setProfileToken":
        return this.sendMessage("forceToken", { profile: message.value });
      case "reload":
        return browser.runtime.reload();
      default:
        console.error("unhandled message from external extension");
    }
  }
}
