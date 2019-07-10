import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// AuthFailure view.
class ViewAuthFailure extends View {
  show() {
    View.showToggleButton(false);
    return escapedTemplate`
    <p>
      ${this.getTranslation("authFailure")}
    </p>`;
  }

  toggleButtonClicked() {
    View.sendMessage("authenticate");
  }
}

const view = new ViewAuthFailure();
const name = "authFailure";

View.registerView(view, name);
export default name;
