import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewError extends View {
  show(data) {
    return escapedTemplate`
    <div id="toggleRow">${this.getTranslation("introHeading")} <input type="checkbox" id="toggleButton" /></div>
    <p>
      ${this.getTranslation(data)}
    </p>`;
  }

  async handleEvent() {
    View.sendMessage("authenticate");
  }
}

const view = new ViewError();
const name = "error";

View.registerView(view, name);
export default name;
