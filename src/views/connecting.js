import {View} from "../view.js";

// This is the first view to be shown.
class ViewConnecting extends View {
  show() {
    View.setState("connecting", {label: this.getTranslation("heroProxyConnecting")});
    View.showToggleButton(true);

    return escapedTemplate`
    <p>
      ${this.getTranslation("viewConnecting")}
    </p>`;
  }

  toggleButtonClicked() {
    View.sendMessage("setEnabledState", {enabledState: true});
  }
}

const view = new ViewConnecting();
const name = "connecting";

View.registerView(view, name);
export default name;
