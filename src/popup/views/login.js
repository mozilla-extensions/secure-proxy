import {View} from "../view.js";

// Login view.
class ViewLogin extends View {
  syncShow(data) {
    View.setState("login", {label: this.getTranslation("heroProxyLogin")});

    let text;
    let mode;

    if (data.proxyState === PROXY_STATE_UNAUTHENTICATED) {
      text = "viewLoginMessage";
      mode = "";
    } else if (data.proxyState === PROXY_STATE_GEOFAILURE) {
      text = "viewGeoFailure";
      mode = "warning";
    } else {
      text = "viewAuthFailure";
      mode = "warning";
    }

    return escapedTemplate`
    <p data-mode="${mode}">
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

  handleClickEvent(e) {
    if (e.target.id === "authButton") {
      // eslint-disable-next-line verify-await/check
      View.sendMessage("authenticate");

      // eslint-disable-next-line verify-await/check
      View.close();
    }
  }
}

const view = new ViewLogin();
export default view;
