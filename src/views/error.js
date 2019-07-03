import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// This is the first view to be shown.
class ViewError extends View {
  show(data) {
    return escapedTemplate`<p>
      ${this.getTranslation(data)}
    </p>`;
  }
}

const view = new ViewError();
const name = "error";

View.registerView(view, name);
export default name;
