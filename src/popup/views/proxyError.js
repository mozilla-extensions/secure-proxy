import {View} from "../view.js";

class ViewProxyError extends View {
  syncShow(proxyState) {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.showToggleButton(false);

    return escapedTemplate`
    <p class="warning">
      ${this.getTranslation("viewProxyError-" + proxyState)}
    </p>`;
  }

  toggleButtonClicked() {
    // eslint-disable-next-line verify-await/check
    View.sendMessage("authenticate");
  }

  stateButtonHandler() {
    this.toggleButtonClicked();
  }
}

const view = new ViewProxyError();
export default view;
