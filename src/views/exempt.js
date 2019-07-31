import {View} from "../view.js";

class ViewExemptTab extends View {
  show(proxyState) {
    View.setState("disabled", this.getTranslation("heroProxyOff"));
    View.showToggleButton(false);

    return escapedTemplate`
    <p class="warning">
      ${this.getTranslation("viewExemptTab")}
    </p>`;
  }

  toggleButtonClicked() {
    View.sendMessage("removeExemptTab");
  }

  stateButtonHandler() {
    this.toggleButtonClicked();
  }
}

const view = new ViewExemptTab();
const name = "exemptTab";

View.registerView(view, name);
export default name;
