import {View} from "../view.js";

class ViewError extends View {
  syncShow(data) {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    return escapedTemplate`
    <p>
      ${this.getTranslation(data)}
    </p>`;
  }
}

const view = new ViewError();
export default view;
