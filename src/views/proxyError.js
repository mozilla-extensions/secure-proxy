import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewProxyError extends View {
  show(proxyState) {
    if (proxyState == PROXY_STATE_OTHERINUSE) {
      View.setState("hidden");
      View.hideToggleButton();
    } else {
      View.setState("disabled", this.getTranslation("heroProxyOff"));
      View.showToggleButton(false);
    }
    return escapedTemplate`
    <p>
      ${this.getTranslation("viewError-" + proxyState)}
    </p>`;
  }

  toggleButtonClicked() {
    View.sendMessage("authenticate");
  }
}

const view = new ViewProxyError();
const name = "proxyError";

View.registerView(view, name);
export default name;
