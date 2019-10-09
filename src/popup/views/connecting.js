import {View} from "../view.js";

// This is the first view to be shown.
class ViewConnecting extends View {
  syncShow(data) {
    View.setState("connecting", {label: this.getTranslation("heroProxyConnecting")});
    View.showToggleButton(data, true);

    return escapedTemplate`
    <p>
      ${this.getTranslation("viewConnecting")}
    </p>`;
  }

  toggleButtonClicked() {
    // eslint-disable-next-line verify-await/check
    View.sendMessage("setEnabledState", {
      enabledState: true,
      reason: "toggleButton",
    });
  }
}

const view = new ViewConnecting();
export default view;
