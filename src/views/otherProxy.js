import {View} from '../view.js'

// Warning message in case a proxy has been detected.
class ViewOtherProxy extends View {
  show() {
    console.log("ViewOtherProxy.show");

    const content = document.getElementById("content");
    content.textContent = this.getTranslation("otherProxy");
  }
}

const view = new ViewOtherProxy();
const name = "otherProxy";

View.registerView(view, name);
export default name;

