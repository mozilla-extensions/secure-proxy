import {View} from '../view.js'

function addActiveListener(el, listener) {
  el.addEventListener("click", listener);
  el.addEventListener("submit", listener);
}

class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
    this.toggleButton = null;
  }

  show(data) {
    console.log("ViewMain.show");

    const content = document.getElementById("content");

    /* example state:
       {"email":"j@email.com",
        "locale":"en-US,en;q=0.5",
        "amrValues":["pwd","email"],
        "twoFactorAuthentication":false,
        "uid":"...",
        "avatar":"https://latest.dev.lcip.org/profile/a/...",
        "avatarDefault":true}
    */
    const userInfo = document.createElement("p");
    userInfo.textContent = this.getTranslation("loggedIn", data.userInfo.email);
    content.appendChild(userInfo);

    let stateName;
    if (!data.tabInfo || !("proxied" in data.tabInfo)) {
      stateName = this.getTranslation("notProxied");
    } else if (data.tabInfo.proxied) {
      stateName = this.getTranslation("isProxied");
    } else if (data.tabInfo.proxied === null) {
      stateName = this.getTranslation("isIndeterminate");
    }

    const state = document.createElement("p");
    state.textContent = this.getTranslation("proxyState", stateName);
    content.appendChild(state);

    this.toggleButton = document.createElement("button");
    content.appendChild(this.toggleButton);
    
    this.proxyEnabled = !!data.proxyState;
    this.showProxyState();

    addActiveListener(this.toggleButton, async (e) => {
      this.proxyEnabled = !this.proxyEnabled;
      // Send a message to the background script to notify the proxyEnabled has chanded.
      // This prevents the background script from having to block on reading from the storage per request.
      await View.sendMessage("setEnabledState", {enabledState: this.proxyEnabled});
      this.showProxyState();
    });
  }

  showProxyState() {
    this.toggleButton.textContent = this.proxyEnabled ? this.getTranslation("disableProxy") : this.getTranslation("enableProxy");
  }
}

const view = new ViewMain();
const name = "main";

View.registerView(view, name);
export default name;
