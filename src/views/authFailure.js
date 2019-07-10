import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// AuthFailure view.
class ViewAuthFailure extends View {
  show() {
    return escapedTemplate`
    <div id="toggleRow">${this.getTranslation("introHeading")} <input type="checkbox" id="toggleButton" /></div>
    <p>
      ${this.getTranslation("authFailure")}
    </p>`;
  }

  async handleEvent() {
    View.sendMessage("authenticate");
  }
}

const view = new ViewAuthFailure();
const name = "authFailure";

View.registerView(view, name);
export default name;
