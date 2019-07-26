import {View} from "../view.js";
import {escapedTemplate} from "../template.js";

class ViewError extends View {
  show(data) {
    View.setState("disabled", this.getTranslation("heroProxyOff"));
    return escapedTemplate`
    <p>
      ${this.getTranslation(data)}
    </p>`;
  }
}

const view = new ViewError();
const name = "error";

View.registerView(view, name);
export default name;
