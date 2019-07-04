import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

const PROXY_STATE_INACTIVE = "inactive";
const PROXY_STATE_ACTIVE = "active";

// Main view.
class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
  }

  show(data) {
    let stateName;
    if (data.proxyState != PROXY_STATE_INACTIVE &&
        data.proxyState != PROXY_STATE_ACTIVE) {
      throw new Error("Invalid proxy state for ViewMain");
    }

    let userInfo = escapedTemplate`<p id="mainMessage"></p>
    <button>${this.getTranslation("viewMainToggleButton")}</button>`;

    return userInfo;
  }

  postShow(data) {
    this.proxyEnabled = data.proxyState == PROXY_STATE_ACTIVE;
    this.showMainMessage();
  }

  async handleEvent() {
    this.proxyEnabled = !this.proxyEnabled;
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    await View.sendMessage("setEnabledState", {enabledState: this.proxyEnabled});
    this.showMainMessage();
  }

  showMainMessage() {
    let stateText;
    if (this.proxyEnabled) {
      stateText = this.getTranslation("viewMainProxyOn");
    } else {
      // TODO: warning! ...
      stateText = this.getTranslation("viewMainProxyOff");
    }

     document.getElementById("mainMessage").textContent = stateText;
  }
}

const view = new ViewMain();
const name = "main";

View.registerView(view, name);
export default name;
