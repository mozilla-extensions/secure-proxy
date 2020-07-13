import {Component} from "./component.js";
import {constants} from "./constants.js";
import {Logger} from "./logger.js";
import {StorageUtils} from "./storageUtils.js";

const log = Logger.logger("UI");

// These URLs must be formatted
const HELP_AND_SUPPORT_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/firefox-private-network";

// These URLs do not need to be formatted
const CLOUDFLARE_URL = "https://www.cloudflare.com/";
const PRIVACY_POLICY_URL = "https://www.mozilla.org/privacy/firefox-private-network";
const TERMS_AND_CONDITIONS_URL = "https://www.mozilla.org/about/legal/terms/firefox-private-network";
const GIVE_US_FEEDBACK_URL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-feedback";
const SUBSCRIPTION_URL = "https://fpn.firefox.com/r/browser/subscriptionNeeded";
const DEVICELIMIT_URL = "https://fpn.firefox.com/r/browser/devicelimit";

export class UI extends Component {
  constructor(receiver) {
    super(receiver);

    browser.runtime.onConnect.addListener(port => {
      if (port.name === "panel") {
        // is async but waiting for this is not important
        this.panelConnected(port);
        return;
      }

      log("Invalid port name!");
    });
  }

  setProxyState(proxyState) {
    const wasLoading = (this.cachedProxyState === PROXY_STATE_LOADING);

    super.setProxyState(proxyState);

    // No after steps if we jump from "loading" to "active". In this case we
    // are at startup time and we don't want to annoy the user with the toast
    // message.
    if (!constants.isAndroid && !wasLoading && proxyState === PROXY_STATE_ACTIVE) {
      this.afterConnectionSteps();
    }
  }

  async afterConnectionSteps() {
    await this.update();
  }

  async panelConnected(port) {
    log("Panel connected");

    // Overwrite any existing port. We want to talk with 1 single popup.
    this.currentPort = port;

    // Let's inform the main component about this panel shown.
    this.syncSendMessage("panelShown");

    // Let's send the initial data.
    port.onMessage.addListener(async message => {
      log("Message received from the panel", message);

      switch (message.type) {
        case "setEnabledState":
          await this.sendMessage("enableProxy", {
            enabledState: message.data.enabledState,
            reason: message.data.reason,
          });
          break;

        case "authenticate":
          await this.sendMessage("authenticationRequired");
          break;

        case "goBack":
          await this.update();
          break;

        case "manageAccount":
          await this.openUrl(await this.sendMessage("managerAccountURL"));
          this.syncSendMessage("telemetryEvent", { category: "settings_url_clicks", event: message.type });
          break;

        case "contactUs":
          await this.openUrl(await this.sendMessage("accountSupportURL"));
          this.syncSendMessage("telemetryEvent", { category: "settings_url_clicks", event: message.type });
          break;

        case "helpAndSupport":
          await this.formatAndOpenURL(HELP_AND_SUPPORT_URL);
          this.syncSendMessage("telemetryEvent", { category: "settings_url_clicks", event: message.type });
          break;

        case "cloudflare":
          await this.formatAndOpenURL(CLOUDFLARE_URL);
          this.syncSendMessage("telemetryEvent", { category: "settings_url_clicks", event: message.type });
          break;

        case "privacyPolicy":
          await this.openUrl(PRIVACY_POLICY_URL);
          this.syncSendMessage("telemetryEvent", { category: "settings_url_clicks", event: message.type });
          break;

        case "termsAndConditions":
          await this.openUrl(TERMS_AND_CONDITIONS_URL);
          this.syncSendMessage("telemetryEvent", { category: "settings_url_clicks", event: message.type });
          break;

        case "giveUsFeedback":
          await this.openUrl(GIVE_US_FEEDBACK_URL);
          this.syncSendMessage("telemetryEvent", { category: "settings_url_clicks", event: message.type });
          break;

        case "openSubscriptionLink":
          await this.openUrl(SUBSCRIPTION_URL);
          this.syncSendMessage("telemetryEvent", { category: "upsell_clicks", event: "paymentRequired" });
          break;

        case "openDeviceLimitLink":
          await this.openUrl(DEVICELIMIT_URL);
          break;

        case "telemetryEvent":
          this.syncSendMessage("telemetryEvent", message.data);
          break;

        case "logRequired":
          this.logRequired();
          break;

        case "onboardingEnd":
          this.sendMessage("onboardingEnd");
          break;
      }
    });

    port.onDisconnect.addListener(_ => {
      log("Panel disconnected");
      this.currentPort = null;
    });

    await this.sendDataToCurrentPort();
  }

  async logRequired() {
    const logs = await this.sendMessage("logRequired");
    if (logs) {
      this.sendDataToCurrentPort(logs);
    }
  }

  async showStatusPrompt() {
    // No need to show the toast if the panel is visible.
    if (this.currentPort) {
      return;
    }

    let promptNotice;
    let isWarning = false;
    switch (this.cachedProxyState) {
      case PROXY_STATE_INACTIVE:
        promptNotice = "toastProxyOff";
        break;

      case PROXY_STATE_ACTIVE:
        promptNotice = "toastProxyOn";
        break;

      case PROXY_STATE_OTHERINUSE:
        // Fall through
      case PROXY_STATE_PROXYERROR:
        // Fall through
      case PROXY_STATE_PROXYAUTHFAILED:
        // Fall through
      case PROXY_STATE_OFFLINE:
        // Fall through
      case PROXY_STATE_CAPTIVE:
        // Fall through
      case PROXY_STATE_GEOFAILURE:
        // Fall through
      case PROXY_STATE_AUTHFAILURE:
        promptNotice = "toastWarning";
        isWarning = true;
        break;

      default:
        // no message.
        break;
    }

    if (promptNotice) {
      await browser.experiments.proxyutils.showPrompt(this.getTranslation(promptNotice), isWarning);
    }
  }

  async showWarningStatusPrompt() {
    await browser.experiments.proxyutils.showPrompt(this.getTranslation("toastWarning"), true);
  }

  async update(showToast = true) {
    if (showToast) {
      await this.showStatusPrompt();
    }

    await Promise.all([
      this.updateIcon(),
      this.sendDataToCurrentPort(),
    ]);
  }

  async updateIcon() {
    if (constants.isAndroid) {
      return;
    }

    let icon;
    let text;
    if (this.cachedProxyState === PROXY_STATE_INACTIVE ||
        this.cachedProxyState === PROXY_STATE_CONNECTING ||
        this.cachedProxyState === PROXY_STATE_OFFLINE ||
        this.cachedProxyState === PROXY_STATE_CAPTIVE) {
      icon = "/img/badge_off.svg";
      text = "badgeOffText";
    } else if (this.cachedProxyState === PROXY_STATE_ACTIVE) {
      icon = "/img/badge_on.svg";
      text = "badgeOnText";
    } else {
      icon = "/img/badge_warning.svg";
      text = "badgeWarningText";
    }

    await Promise.all([
      browser.browserAction.setIcon({
        path: icon,
      }),
      browser.browserAction.setTitle({
        title: this.getTranslation(text),
      }),
    ]);
  }

  async sendDataToCurrentPort(logs = null) {
    log("Update the panel: ", this.currentPort);
    if (this.currentPort) {
      const profileData = await StorageUtils.getProfileData();
      const tokenData = await StorageUtils.getProxyTokenData();

      return this.currentPort.postMessage({
        userInfo: profileData,
        proxyState: this.cachedProxyState,
        tokenData,
        logs,
      });
    }
    return null;
  }

  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }

  async formatAndOpenURL(url) {
    await this.openUrl(await browser.experiments.proxyutils.formatURL(url));
  }

  async openUrl(url) {
    await browser.tabs.create({url});
  }
}
