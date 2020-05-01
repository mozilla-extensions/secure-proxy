import {View} from "../view.js";

// Main view.
class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
  }

  syncShow(data) {
    this.proxyEnabled = data.proxyState === PROXY_STATE_ACTIVE;

    const label = this.proxyEnabled ? "viewMainActive" : "viewMainInactive";
    return escapedTemplate`
      <p data-mode="unlimited">${this.getTranslation(label)}</p>
    `;
  }

  syncPostShow(data) {
    View.showToggleButton(data, this.proxyEnabled);

    if (data.proxyState === PROXY_STATE_ACTIVE) {
      View.setState("enabled", {text: this.getTranslation("heroProxyOn")});
    } else {
      View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    }
  }

  toggleButtonClicked(e) {
    // eslint-disable-next-line verify-await/check
    View.sendMessage("setEnabledState", {
      enabledState: e.target.checked,
      reason: "toggleButton",
    });
  }

  async stateButtonHandler() {
    this.proxyEnabled = !this.proxyEnabled;
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    // eslint-disable-next-line verify-await/check
    await View.sendMessage("setEnabledState", {
      enabledState: this.proxyEnabled,
      reason: "stateButton",
    });
  }
}

const view = new ViewMain();
export default view;
