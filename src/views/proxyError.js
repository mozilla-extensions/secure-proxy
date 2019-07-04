import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewProxyError extends View {
  show(data) {
    let locale;
    switch (data) {
      case PROXY_STATE_PROXYERROR:
        locale = "viewProxyErrorGeneric";
        break;

      case PROXY_STATE_OTHERINUSE:
        locale = "viewProxyErrorOtherProxyInUse";
        break;

      case PROXY_STATE_PROXYAUTHFAILED:
        locale = "viewProxyErrorAuthFailed";
        break;

      default:
        throw "Invalid proxy state!"
        break;
    }

    return escapedTemplate`<p>
      ${this.getTranslation(locale)}
    </p>
    <button>${this.getTranslation("viewProxyErrorToggleButton")}</button>`;
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
