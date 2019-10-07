import {View} from "../view.js";

// Main view.
class ViewMain extends View {
  constructor() {
    super();

    this.proxyEnabled = false;
  }

  syncShow(data) {
    if (data.proxyState !== PROXY_STATE_INACTIVE &&
        data.proxyState !== PROXY_STATE_ACTIVE) {
      throw new Error("Invalid proxy state for ViewMain");
    }

    this.proxyEnabled = data.proxyState === PROXY_STATE_ACTIVE;

    const content = this.syncMainContent(data);

    return escapedTemplate`
      <div id="passReport" hidden>
        <span id="passCount"></span>
        <span id="passCountdown"></span>
      </div>
      <p class="${content.className}">
        ${this.getTranslation(content.label)}
      </p>
      <button id="betaUpgrade" class="primary" hidden>
        ${this.getTranslation("viewMainUpgradeButton")}
      </button>
    `;
  }

  syncPostShow(data) {
    if (!data.migrationCompleted || data.totalPasses === -1) {
      View.showToggleButton(this.proxyEnabled);
    } else {
      View.hideToggleButton();

      // eslint-disable-next-line verify-await/check
      const template = escapedTemplate`${this.passCountText(data)}`;
      template.syncRenderTo(document.getElementById("passCount"));
    }

    if (this.proxyEnabled) {
      View.setState("enabled", {text: this.getTranslation("heroProxyOn")});
    } else {
      View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    }

    // Free-tier.
    if (data.migrationCompleted && data.totalPasses !== -1) {
      document.getElementById("passReport").hidden = false;

      // No pass available.
      if ((data.totalPasses - data.currentPass) === 0) {
        document.getElementById("betaUpgrade").hidden = false;
      }

      // Countdown Timer
      if (this.proxyEnabled) {
        const countdown = document.getElementById("passCountdown");
        countdown.hidden = false;
        this.syncActivateCountdown(data, countdown);
      }
    }
  }

  handleClickEvent(e) {
    if (e.target.id === "betaUpgrade") {
      // eslint-disable-next-line verify-await/check
      View.sendMessage(e.target.id);
      View.close();
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

  syncMainContent(data) {
    // Pre migration or unlimited
    if (!data.migrationCompleted || data.totalPasses === -1) {
      if (this.proxyEnabled) {
        return { label: "viewMainActive", className: "" };
      }

      return { label: "viewMainInactive", className: "" };
    }

    // Free-tier.
    if (this.proxyEnabled) {
      return { label: "viewMainActiveLimited", className: "" };
    }

    let availablePasses = data.totalPasses - data.currentPass;
    if (availablePasses > 0) {
      return { label: "viewMainInactiveWithPasses", className: "" };
    }

    return { label: "viewMainInactiveWithoutPasses", className: "warning" };
  }

  passCountText(data) {
    let available = data.totalPasses - data.currentPass;
    if (this.proxyEnabled && available === 1) {
      return this.getTranslation("viewMainLastPassActive");
    }

    if (available === 1) {
      return this.getTranslation("viewMainLastPassAvailable");
    }

    return this.getTranslation("viewMainManyPassesAvailable", available);
  }

  syncActivateCountdown(data, elm) {
    if (!data.tokenData) {
      elm.innerHTML = "";
    }

    function syncCountDown() {
      // eslint-disable-next-line verify-await/check
      const nowInSecs = Math.floor(Date.now() / 1000);
      let diff = data.tokenData.received_at + data.tokenData.expires_in - nowInSecs;
      if (diff < 0) {
        diff = 0;
      }

      const secs = diff % 60;
      diff -= secs;
      diff /= 60;

      const mins = diff % 60;
      diff -= mins;
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

      const template = escapedTemplate`${syncHelper(diff)}:${syncHelper(mins)}:${syncHelper(secs)}`;
      template.syncRenderTo(elm);
    }

    // eslint-disable-next-line verify-await/check
    setInterval(syncCountDown, 1000);
    syncCountDown();
  }
}

const view = new ViewMain();
export default view;
