import {View} from "../view.js";

class ViewProxyError extends View {
  syncShow() {
    View.setState("disabled", {text: this.getTranslation("heroProxyOn")});

    return escapedTemplate`
      <div id="passReport" hidden>
        <span id="passCount">${this.getTranslation("viewProxyErrorPassCount")}</span>
      </div>
      <p class="warning">
        ${this.getTranslation("viewProxyError")}
      </p>`;
  }

  syncPostShow(data) {
    View.showToggleButton(data, true);

    if (data.totalPasses !== -1) {
      document.getElementById("passReport").hidden = false;
    }
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
