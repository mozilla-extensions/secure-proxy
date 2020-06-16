import {View} from "../view.js";

class ViewProxyError extends View {
  syncShow(data) {
    // Unlimited.
    if (data.totalPasses === -1) {
      const label = this.proxyEnabled ? "viewMainActive" : "viewMainInactive";
      return escapedTemplate`
        <p data-mode="unlimited">${this.getTranslation(label)}</p>
        <p id="proxyError">${this.getTranslation("viewMainProxyError")}</p>
      `;
    }

    // Free-tier - active.
    const subRenew = data.autorenew ? "viewMainActiveSubPassAutoStartON" : "viewMainActiveSubPassAutoStartOFF";

    return escapedTemplate`
      <div class="sub subMain">${this.getTranslation(subRenew)}
        <a href="#" id="settingsLink">${this.getTranslation("viewMainSubSettings")}</a>${this.getTranslation("viewMainSubSettingsPost")}</div>
      <div id="passReport">
        <span id="passMsg">${this.getTranslation("viewMainPassAvailable")}</span>
        <span id="passCount"></span>
      </div>
      <div class="sub subMain">${this.getTranslation("viewMainSubPassLeft")}</div>
      <p id="proxyError">${this.getTranslation("viewMainProxyError")}</p>
    `;
  }

  syncPostShow(data) {
    View.showToggleButton(data, true);
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});

    // Free-tier.
    if (data.totalPasses !== -1) {
      let passAvailable = data.totalPasses - data.currentPass;
      const passCount = document.getElementById("passCount");
      if (passCount) {
        passCount.textContent = passAvailable;
      }
    }
  }

  handleClickEvent(e) {
    if (e.target.id === "settingsLink") {
      const settingsButton = document.getElementById("settingsButton");
      // eslint-disable-next-line verify-await/check
      settingsButton.click();
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
