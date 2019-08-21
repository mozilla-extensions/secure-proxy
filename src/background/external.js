import {Component} from "./component.js";

// This component handles message from external extensions
// It's current use is to accept configuration of the addon
export class ExternalHandler extends Component {
  constructor(receiver) {
    super(receiver);

    browser.runtime.onMessageExternal.addListener(message => this.handleExternalMessage(message));
  }

  async init() {
    // Nothing to do here
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
      default:
        console.error("unhandled message from external extension");
    }
  }
}
