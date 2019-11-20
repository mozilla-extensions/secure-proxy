import {View} from "../view.js";

// Main view.
class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
  }

  syncShow(data) {
    this.proxyEnabled = data.proxyState === PROXY_STATE_ACTIVE;

    // Unlimited.
    if (data.totalPasses === -1) {
      const label = this.proxyEnabled ? "viewMainActive" : "viewMainInactive";
      return escapedTemplate`
        <p data-mode="unlimited">${this.getTranslation(label)}</p>
        <p id="proxyError" hidden>${this.getTranslation("viewMainProxyError")}</p>
      `;
    }

    // Free-tier - active.
    if (this.proxyEnabled) {
      const subRenew = data.autorenew ? "viewMainActiveSubPassAutoStartON" : "viewMainActiveSubPassAutoStartOFF";

      return escapedTemplate`
        <div class="sub subMain">${this.getTranslation(subRenew)}
          <a href="#" id="settingsLink">${this.getTranslation("viewMainSubSettings")}</a>${this.getTranslation("viewMainSubSettingsPost")}</div>
        <div id="passReport">
          <span id="passMsg">${this.getTranslation("viewMainPassAvailable")}</span>
          <span id="passCount"></span>
        </div>
        <div class="sub subMain">${this.getTranslation("viewMainSubPassLeft")}</div>
        <p id="proxyError" hidden>${this.getTranslation("viewMainProxyError")}</p>
      `;
    }

    // Free-tier - inactive.
    let availablePasses = data.totalPasses - data.currentPass;
    if (availablePasses > 0) {
      const subRenew = data.autorenew ? "viewMainInactiveSubPassAutoStartON" : "viewMainInactiveSubPassAutoStartOFF";

      return escapedTemplate`
        <div class="sub subMain">${this.getTranslation(subRenew)}
          <a href="#" id="settingsLink">${this.getTranslation("viewMainSubSettings")}</a>${this.getTranslation("viewMainSubSettingsPost")}</div>
        <div id="passReport">
          <span id="passMsg">${this.getTranslation("viewMainPassAvailable")}</span>
          <span id="passCount"></span>
        </div>
        <div class="sub subMain">${this.getTranslation("viewMainSubPassLeft")}</div>
        <p id="proxyError" hidden>${this.getTranslation("viewMainProxyError")}</p>
      `;
    }

    return escapedTemplate`
      <div id="passReport">
        <span id="passMsg">${this.getTranslation("viewMainPassAvailable")}</span>
        <span id="passCount"></span>
      </div>
      <p data-mode="0pass">${this.getTranslation("viewMainInactiveWithoutPasses")}</p>
      <p id="proxyError" hidden>${this.getTranslation("viewMainProxyError")}</p>
      <button id="vpnLink" class="primary">
        ${this.getTranslation("viewMainVPNButton")}
      </button>
    `;
  }

  syncFooter(data) {
    // No footer for unlimited.
    if (data.totalPasses === -1 ||
        (!this.proxyEnabled && (data.totalPasses - data.currentPass) === 0)) {
      return null;
    }

    // No footer with errors.
    if (data.proxyState !== PROXY_STATE_INACTIVE &&
        data.proxyState !== PROXY_STATE_ACTIVE) {
      return null;
    }

    return escapedTemplate`
      <span id="popupBeta">${this.getTranslation("popupVPNFooter")}</span>
      <a href="#" class="link popupBetaLink" id="vpnLink">${this.getTranslation("popupVPNLink")}</a>
    `;
  }

  syncPostShow(data) {
    if (data.proxyState !== PROXY_STATE_INACTIVE &&
        data.proxyState !== PROXY_STATE_ACTIVE) {
      document.getElementById("proxyError").hidden = false;
    }

    if (data.totalPasses === -1 || this.proxyEnabled ||
        (data.totalPasses - data.currentPass) > 0) {
      View.showToggleButton(data, this.proxyEnabled);
    } else {
      View.hideToggleButton();
    }

    if (this.proxyEnabled) {
      View.setState("enabled", {text: this.getTranslation("heroProxyOn")});
    } else {
      View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    }

    // Free-tier.
    if (data.totalPasses !== -1) {
      let passAvailable = data.totalPasses - data.currentPass;
      const passCount = document.getElementById("passCount");
      if (passCount) {
        passCount.textContent = passAvailable;
      }

      // Countdown Timer
      View.syncShowPassCountdown(true);
      this.syncActivateCountdown(data);
    }
  }

  handleClickEvent(e) {
    if (e.target.id === "vpnLink") {
      // eslint-disable-next-line verify-await/check
      View.sendMessage(e.target.id);
      View.close();
      return;
    }

    if (e.target.id === "settingsLink") {
      const settingsButton = document.getElementById("settingsButton");
      // eslint-disable-next-line verify-await/check
      settingsButton.click();
    }
  }

  toggleButtonClicked(e) {
    // eslint-disable-next-line verify-await/check
    View.sendMessage("setEnabledState", {
      enabledState: e.target.checked,
      reason: "toggleButton",
    });
  }

  async stateButtonHandler() {
    this.proxyEnabled = !this.proxyEnabled;
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    // eslint-disable-next-line verify-await/check
    await View.sendMessage("setEnabledState", {
      enabledState: this.proxyEnabled,
      reason: "stateButton",
    });
  }

  syncActivateCountdown(data) {
    const elm = document.getElementById("passCountdown");

    if (!data.tokenData) {
      elm.innerHTML = "";
    }

    let syncCountDown = _ => {
      // eslint-disable-next-line verify-await/check
      const nowInSecs = Math.floor(Date.now() / 1000);
      let diff;
      if (data.tokenData) {
        diff = data.tokenData.received_at + data.tokenData.expires_in - nowInSecs;
      } else {
        diff = -1;
      }

      if (diff < 0) {
        // eslint-disable-next-line verify-await/check
        clearInterval(this.countDownId);

        if (!this.proxyEnabled) {
          View.syncShowPassCountdown(false);
        }

        diff = 0;
      }

      const secs = diff % 60;
      diff -= secs;
      diff /= 60;

      function syncHelper(number) {
        if (number === 0) {
          return "00";
        }

        if (number < 10) {
          return "0" + number;
        }

        return number;
      }

      const template = escapedTemplate`${syncHelper(diff)}:${syncHelper(secs)}`;
      template.syncRenderTo(elm);
    };

    // eslint-disable-next-line verify-await/check
    clearInterval(this.countDownId);

    // eslint-disable-next-line verify-await/check
    this.countDownId = setInterval(syncCountDown, 1000);
    syncCountDown();
  }
}

const view = new ViewMain();
export default view;
