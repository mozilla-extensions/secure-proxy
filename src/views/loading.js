import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// This is the first view to be shown.
class ViewLoading extends View {
  show() {
    return escapedTemplate``;
  }
}

const view = new ViewLoading();
const name = "loading";

View.registerView(view, name);
export default name;
