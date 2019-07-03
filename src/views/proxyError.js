import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewProxyError extends View {
  show(data) {
    return escapedTemplate`<p>
      ${this.getTranslation(data)}
    </p>
    <button id="toggleButton"></button>`;
  }

  postShow(data) {
    const toggleButton = document.getElementById("toggleButton");
    toggleButton.textContent = this.getTranslation("enableProxy");
  }

  async handleEvent() {
    await View.sendMessage("setEnabledState", {enabledState: true});
    close();
  }
}

const view = new ViewProxyError();
const name = "proxyError";

View.registerView(view, name);
export default name;
