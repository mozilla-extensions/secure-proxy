import {View} from "../view.js";

// This is the first view to be shown.
class ViewLoading extends View {
  show() {
    View.setState("connecting");
    return escapedTemplate`
    <p>
      ${this.getTranslation("viewLoading")}
    </p>`;
  }
}

const view = new ViewLoading();
const name = "loading";

View.registerView(view, name);
export default name;
