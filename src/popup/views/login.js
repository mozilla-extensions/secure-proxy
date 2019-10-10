import {View} from "../view.js";

// Login view.
class ViewLogin extends View {
  syncShow(data) {
    View.setState("login", {label: this.getTranslation("heroProxyLogin")});

    let text;
    let button;

    if (data.proxyState === PROXY_STATE_UNAUTHENTICATED) {
      text = "viewLoginMessage";
      button = "viewLoginButton";
    } else if (data.proxyState === PROXY_STATE_GEOFAILURE) {
      text = "viewGeoFailure";
      button = "viewTryAgainLoginButton";
    } else {
      text = "viewAuthFailure";
      button = "viewLoginButton";
    }

    return escapedTemplate`
    <p>
      ${this.getTranslation(text)}
    </p>
    <button id="authButton" class="primary">
      ${this.getTranslation(button)}
    </button>`;
  }

  async stateButtonHandler() {
    await View.sendMessage("authenticate");
    View.close();
  }

  handleClickEvent(e) {
    if (e.target.id === "authButton") {
      // eslint-disable-next-line verify-await/check
      View.sendMessage("authenticate");
    }
  }
}

const view = new ViewLogin();
export default view;
