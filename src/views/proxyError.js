import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewProxyError extends View {
  show(proxyState) {
    View.setState("disabled", this.getTranslation("heroProxyOff"));
    View.showToggleButton(false);

    return escapedTemplate`
    <p class="warning">
      ${this.getTranslation("viewProxyError-" + proxyState)}
    </p>`;
  }

  toggleButtonClicked() {
    View.sendMessage("authenticate");
  }

  stateButtonHandler() {
    this.toggleButtonClicked();
  }
}

const view = new ViewProxyError();
const name = "proxyError";

View.registerView(view, name);
export default name;
