import {View} from "../view.js";

class ViewOtherInUse extends View {
  show() {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.hideToggleButton();

    return escapedTemplate`
    <p>
      ${this.getTranslation("viewOtherInUse")}
    </p>`;
  }
}

const view = new ViewOtherInUse();
const name = "otherInUse";

View.registerView(view, name);
export default name;
