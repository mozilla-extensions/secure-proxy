import {View} from "../view.js";
import {escapedTemplate} from "../template.js";

class ViewOtherInUse extends View {
  show() {
    View.setState("disabled", this.getTranslation("heroProxyOff"));
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
