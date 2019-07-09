import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// Main view.
class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
  }

  show(data) {
    let loggedIn = this.getTranslation("loggedIn", data.userInfo.email);

    if (data.proxyState != PROXY_STATE_INACTIVE &&
        data.proxyState != PROXY_STATE_ACTIVE) {
      throw new Error("Invalid proxy state for ViewMain");
    }

    let userInfo = escapedTemplate`
    <p>
      ${loggedIn}
    </p>
    <button id="toggleButton"></button>
    <p>
      <a href="https://qsurvey.mozilla.com/s3/fx-private-network-beta-feedback" target="_blank" rel="noopener noreferrer" class="feedbackLink">${this.getTranslation("feedbackLink")}</a> <!-- TODO check if correct link -->
    </p>
    `;

    return userInfo;
  }

  postShow(data) {
    this.proxyEnabled = data.proxyState == PROXY_STATE_ACTIVE;

    let toggleButton = document.getElementById("toggleButton");
    if (this.proxyEnabled) {
      toggleButton.textContent = this.getTranslation("disableProxy");
      View.setState("enabled", this.getTranslation("proxyOn"));
    } else {
      toggleButton.textContent = this.getTranslation("enableProxy");
      View.setState("disabled", this.getTranslation("proxyOff"));
    }

  }

  async toggleProxy() {
    this.proxyEnabled = !this.proxyEnabled;
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    await View.sendMessage("setEnabledState", {enabledState: this.proxyEnabled});
  }

  handleEvent() {
    this.toggleProxy();
  }

  stateButtonHandler() {
    this.toggleProxy();
  }
}

const view = new ViewMain();
const name = "main";

View.registerView(view, name);
export default name;
