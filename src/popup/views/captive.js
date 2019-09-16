import {View} from "../view.js";

class ViewCaptive extends View {
  syncShow() {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.hideToggleButton();

    return escapedTemplate`
    <p>
      ${this.getTranslation("viewOffline")}
    </p>`;
  }
}

const view = new ViewCaptive();
export default view;
