import {View} from '../view.js'

class ViewLoading extends View {
  show() {
    console.log("ViewLoading.show");
    // TODO: do something...
  }
}

const view = new ViewLoading();
const name = "loading";

View.registerView(view, name);
export default name;
