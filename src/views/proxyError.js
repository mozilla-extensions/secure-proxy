import {View} from '../view.js'

class ViewProxyError extends View {
  show(proxyState) {
    console.log("ViewProxyError.show");

    const content = document.getElementById("content");
    content.textContent = this.getTranslation(proxyState);
  }
}

const view = new ViewProxyError();
const name = "proxyError";

View.registerView(view, name);
export default name;
