import {View} from "../view.js";

class ViewProxyError extends View {
  show(proxyState) {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
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
export default view;
