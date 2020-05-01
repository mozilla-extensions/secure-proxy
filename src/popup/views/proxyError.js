import {View} from "../view.js";

class ViewProxyError extends View {
  syncShow(data) {
    const label = this.proxyEnabled ? "viewMainActive" : "viewMainInactive";
    return escapedTemplate`
      <p data-mode="unlimited">${this.getTranslation(label)}</p>
      <p id="proxyError">${this.getTranslation("viewMainProxyError")}</p>
    `;
  }

  syncPostShow(data) {
    View.showToggleButton(data, true);
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
  }

  toggleButtonClicked(e) {
    // eslint-disable-next-line verify-await/check
    View.sendMessage("setEnabledState", {
      enabledState: false,
      reason: (typeof e === "string") ? e : "toggleButton",
    });
  }

  stateButtonHandler() {
    this.toggleButtonClicked("stateButton");
  }
}

const view = new ViewProxyError();
export default view;
