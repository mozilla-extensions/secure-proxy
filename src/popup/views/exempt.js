import {View} from "../view.js";

class ViewExemptTab extends View {
  syncShow(data) {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.showToggleButton(data, false);

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
