import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

const PROXY_STATE_INACTIVE = "inactive";
const PROXY_STATE_ACTIVE = "active";

// Main view.
class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
    this.toggleButton = null;
  }

  show(data) {
    /* example state:
       {"email":"j@email.com",
        "locale":"en-US,en;q=0.5",
        "amrValues":["pwd","email"],
        "twoFactorAuthentication":false,
        "uid":"...",
        "avatar":"https://latest.dev.lcip.org/profile/a/...",
        "avatarDefault":true}
    */

    let loggedIn = this.getTranslation("loggedIn", data.userInfo.email);

    let stateName;
    if (data.proxyState != PROXY_STATE_INACTIVE &&
        data.proxyState != PROXY_STATE_ACTIVE) {
      throw new Error("Invalid proxy state for ViewMain");
    }

    if (data.proxyState == PROXY_STATE_INACTIVE) {
      stateName = this.getTranslation("notProxied");
    } else if (data.proxyState == PROXY_STATE_ACTIVE) {
      stateName = this.getTranslation("isProxied");
    }

    let stateText = this.getTranslation("proxyState", stateName);
    let userInfo = escapedTemplate`<p>
      ${loggedIn}
    </p>
    <p>
      ${stateText}
    </p>
    <button id="toggleButton"></button>`;

    return userInfo;
  }

  postShow(data) {
    this.toggleButton = document.getElementById("toggleButton");
    this.proxyEnabled = data.proxyState == PROXY_STATE_ACTIVE;
    this.showProxyState();
  }

  async handleEvent() {
    this.proxyEnabled = !this.proxyEnabled;
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    await View.sendMessage("setEnabledState", {enabledState: this.proxyEnabled});
    this.showProxyState();
  }

  showProxyState() {
    this.toggleButton.textContent = this.proxyEnabled ? this.getTranslation("disableProxy") : this.getTranslation("enableProxy");
  }
}

const view = new ViewMain();
const name = "main";

View.registerView(view, name);
export default name;
