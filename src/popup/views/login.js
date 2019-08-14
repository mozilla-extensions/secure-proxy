import {View} from "../view.js";

// Login view.
class ViewLogin extends View {
  show(proxyState) {
    View.setState("login", {label: this.getTranslation("heroProxyLogin")});

    let text;
    if (proxyState === PROXY_STATE_UNAUTHENTICATED) {
      text = "viewLoginMessage";
    } else {
      text = "viewAuthFailure";
    }

    return escapedTemplate`
    <p>
      ${this.getTranslation(text)}
    </p>
    <button id="authButton" class="primary">
      ${this.getTranslation("viewLoginButton")}
    </button>`;
  }

  async stateButtonHandler() {
    await View.sendMessage("authenticate");
    View.close();
  }

  handleEvent(e) {
    if (e.target.id === "authButton") {
      // eslint-disable-next-line verify-await/check
      View.sendMessage("authenticate");
    }
  }
}

const view = new ViewLogin();
export default view;
