import {View} from "../view.js";

class ViewOffline extends View {
  show() {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.hideToggleButton();

    return escapedTemplate`<p>
      ${this.getTranslation("viewOffline")}
    </p>`;
  }
}

const view = new ViewOffline();
const name = "offline";

View.registerView(view, name);
export default name;
