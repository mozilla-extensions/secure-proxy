import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// This is the first view to be shown.
class ViewConnecting extends View {
  show() {
    View.setState("connecting");

    return escapedTemplate`
    <div id="toggleRow">${this.getTranslation("introHeading")} <input type="checkbox" id="toggleButton" checked /></div>
    <p>
      ${this.getTranslation("viewConnecting")}
    </p>`;
  }

  handleEvent(e) {
    this.toggleProxy();
  }

  async toggleProxy() {
    // In connecting state we can just disable the proxy
    await View.sendMessage("setEnabledState", {enabledState: false});
  }

  stateButtonHandler() {
    this.toggleProxy();
  }
}

const view = new ViewConnecting();
const name = "connecting";

View.registerView(view, name);
export default name;
