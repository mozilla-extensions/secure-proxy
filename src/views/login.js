import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// Login view.
class ViewLogin extends View {
  show() {
    View.setState("login");
    return escapedTemplate`
    <p>
      ${this.getTranslation("signInMessage")}
    </p>
    <button id="authButton" class="primary">
      ${this.getTranslation("signInButton")}
    </button>`;
  }

  stateButtonHandler() {
    View.sendMessage("authenticate");
  }

  handleEvent(e) {
    if (e.target.id == "authButton") {
      View.sendMessage("authenticate");
    }
  }
}

const view = new ViewLogin();
const name = "login";

View.registerView(view, name);
export default name;
