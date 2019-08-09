import {View} from "../view.js";

class ViewError extends View {
  show(data) {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
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
