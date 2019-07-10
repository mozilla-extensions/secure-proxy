import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

class ViewProxyError extends View {
  show(proxyState) {
    return escapedTemplate`
    <p>
      ${this.getTranslation(proxyState)}
    </p>`;
  }
}

const view = new ViewProxyError();
const name = "proxyError";

View.registerView(view, name);
export default name;
