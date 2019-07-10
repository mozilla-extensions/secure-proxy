import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewProxyError extends View {
  show(proxyState) {
    return escapedTemplate`
    <div id="toggleRow">${this.getTranslation("introHeading")} <input type="checkbox" id="toggleButton" /></div>
    <p>
      ${this.getTranslation(proxyState)}
    </p>`;
  }

  async handleEvent() {
    View.sendMessage("authenticate");
  }
}

const view = new ViewProxyError();
const name = "proxyError";

View.registerView(view, name);
export default name;
