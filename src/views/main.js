import {View} from "../view.js";
import {escapedTemplate} from "../template.js";

// Main view.
class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
  }

  show(data) {
    if (data.proxyState !== PROXY_STATE_INACTIVE &&
        data.proxyState !== PROXY_STATE_ACTIVE) {
      throw new Error("Invalid proxy state for ViewMain");
    }

    View.showToggleButton(data.proxyState === PROXY_STATE_ACTIVE);

    let text;
    if (data.proxyState === PROXY_STATE_ACTIVE) {
      text = "viewMainActive";
    } else {
      text = "viewMainInactive";
    }

    let userInfo = escapedTemplate`
    <p>
      ${this.getTranslation(text)}
    </p>
    `;

    return userInfo;
  }

  postShow(data) {
    this.proxyEnabled = data.proxyState === PROXY_STATE_ACTIVE;

    if (this.proxyEnabled) {
      View.setState("enabled", this.getTranslation("heroProxyOn"));
    } else {
      View.setState("disabled", this.getTranslation("heroProxyOff"));
    }
  }

  toggleButtonClicked(e) {
    View.sendMessage("setEnabledState", {enabledState: e.target.checked});
  }

  async toggleProxy() {
    this.proxyEnabled = !this.proxyEnabled;
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    await View.sendMessage("setEnabledState", {enabledState: this.proxyEnabled});
  }

  stateButtonHandler() {
    this.toggleProxy();
  }
}

const view = new ViewMain();
const name = "main";

View.registerView(view, name);
export default name;
