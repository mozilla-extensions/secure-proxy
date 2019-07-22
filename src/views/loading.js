import {View} from '../view.js'
import {escapedTemplate} from '../template.js'
import viewErrorName from './error.js'
const loadingTimeout = 5000;

// This is the first view to be shown.
class ViewLoading extends View {
  show() {
    setTimeout(this.loadingError, loadingTimeout);
    View.setState("connecting");
    return escapedTemplate`
    <p>
      ${this.getTranslation("viewLoading")}
    </p>`;
  }

  loadingError() {
    console.log("show error now");
    View.setView(viewErrorName, "loadingError");
  }
}

const view = new ViewLoading();
const name = "loading";

View.registerView(view, name);
export default name;
