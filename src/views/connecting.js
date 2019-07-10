import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// This is the first view to be shown.
class ViewConnecting extends View {
  show() {
    View.setState("connecting");

    return escapedTemplate`
    <p>
      ${this.getTranslation("viewConnecting")}
    </p>`;
  }
}

const view = new ViewConnecting();
const name = "connecting";

View.registerView(view, name);
export default name;
