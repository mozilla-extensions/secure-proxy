import {View} from "../view.js";

class ViewExemptTab extends View {
  show(proxyState) {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.showToggleButton(false);

    return escapedTemplate`
    <p class="warning">
      ${this.getTranslation("viewExemptTab")}
    </p>`;
  }

  toggleButtonClicked() {
    // eslint-disable-next-line verify-await/check
    View.sendMessage("removeExemptTab");
  }

  stateButtonHandler() {
    this.toggleButtonClicked();
  }
}

const view = new ViewExemptTab();
export default view;
