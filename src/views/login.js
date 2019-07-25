import {View} from "../view.js";
import {escapedTemplate} from "../template.js";

// Login view.
class ViewLogin extends View {
  show(proxyState) {
    View.setState("login");

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

  stateButtonHandler() {
    View.sendMessage("authenticate");
    close();
  }

  handleEvent(e) {
    if (e.target.id === "authButton") {
      View.sendMessage("authenticate");
    }
  }
}

const view = new ViewLogin();
const name = "login";

View.registerView(view, name);
export default name;
