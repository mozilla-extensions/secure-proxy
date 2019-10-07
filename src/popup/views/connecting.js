import {View} from "../view.js";

// This is the first view to be shown.
class ViewConnecting extends View {
  syncShow(data) {
    View.setState("connecting", {label: this.getTranslation("heroProxyConnecting")});

    if (!data.migrationCompleted || data.totalPasses === -1) {
      View.showToggleButton(true);
    } else {
      View.hideToggleButton();
    }

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
