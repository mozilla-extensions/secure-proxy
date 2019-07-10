import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// Login view.
class ViewLogin extends View {
  show() {
    View.setState("login");
    return escapedTemplate`
    <p>
      ${this.getTranslation("viewLoginMessage")}
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
    if (e.target.id == "authButton") {
      View.sendMessage("authenticate");
    }
  }
}

const view = new ViewLogin();
const name = "login";

View.registerView(view, name);
export default name;
