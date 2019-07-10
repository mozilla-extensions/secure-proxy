import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewOffline extends View {
  show() {
    return escapedTemplate`<p>
      ${this.getTranslation("viewOffline")}
    </p>`;
  }
}

const view = new ViewOffline();
const name = "offline";

View.registerView(view, name);
export default name;
