import {View} from "../view.js";

class ViewProxyError extends View {
  syncShow(data) {
    const label = this.proxyEnabled ? "viewMainActive" : "viewMainInactive";
    return escapedTemplate`
      <p data-mode="unlimited">${this.getTranslation(label)}</p>
      <p id="proxyError">${this.getTranslation("viewMainProxyError")}</p>
    `;
  }
}

const view = new ViewProxyError();
export default view;
