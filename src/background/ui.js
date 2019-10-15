import {Component} from "./component.js";
import {Passes} from "./passes.js";
import {StorageUtils} from "./storageUtils.js";

// These URLs must be formatted
const HELP_AND_SUPPORT_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/firefox-private-network";

// These URLs do not need to be formatted
const CLOUDFLARE_URL = "https://www.cloudflare.com/";
const PRIVACY_POLICY_URL = "https://www.mozilla.org/privacy/firefox-private-network";
const TERMS_AND_CONDITIONS_URL = "https://www.mozilla.org/about/legal/terms/firefox-private-network";
const GIVE_US_FEEDBACK_URL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-feedback";
const BETA_LEARNMORE_URL = "https://private-network.firefox.com/beta-announcement";
const BETA_UPGRADE_URL = "https://fpn.firefox.com/vpn";
const BETA_HOW_PASSES_WORK_URL = "https://fpn.firefox.com/browser";

export class UI extends Component {
  constructor(receiver) {
    super(receiver);

    this.exemptTabStatus = new Map();

    // A map of content-script ports. The key is the tabId.
    this.contentScriptPorts = new Map();

    browser.tabs.onRemoved.addListener((tabId) => {
      // eslint-disable-next-line verify-await/check
      this.exemptTabStatus.delete(tabId);
    });

    browser.tabs.onUpdated.addListener((tabId) => {
      // Icon overrides are changes when the user navigates
      // We don't care about the delay here for setting the icon and we can't block here
      // eslint-disable-next-line verify-await/check
      this.setTabIcon(tabId);
    });
    browser.tabs.onActivated.addListener((info) => {
      if (this.syncIsTabExempt(info.tabId)) {
        // Is async but doesn't have side effects
        // eslint-disable-next-line verify-await/check
        this.showStatusPrompt();
      }
    });

    // eslint-disable-next-line consistent-return
    browser.runtime.onMessage.addListener((message, sender) => {
      if (message.type === "getBaseDomainFromHost") {
        return browser.experiments.proxyutils.getBaseDomainFromHost(message.hostname);
      }

      if (message.type === "exempt") {
        this.syncExemptTab(sender.tab.id, message.status);
      }
    });

    browser.runtime.onConnect.addListener(port => {
      if (port.name === "port-from-cs") {
        // Is sync
        // eslint-disable-next-line verify-await/check
        this.contentScriptConnected(port);
        return;
      }

      if (port.name === "panel") {
        // is async but waiting for this is not important
        // eslint-disable-next-line verify-await/check
        this.panelConnected(port);
        return;
      }

      log("Invalid port name!");
    });
  }

  syncGetExemptTabStatus(name) {
    return this.exemptTabStatus.get(name);
  }

  syncSetExemptTabStatus(name, value) {
    return this.exemptTabStatus.set(name, value);
  }

  async getCurrentTab() {
    let currentTab = (await browser.tabs.query({currentWindow: true, active: true}))[0];
    return currentTab;
  }

  async isCurrentTabExempt() {
    let currentTab = await this.getCurrentTab();
    return currentTab && this.syncIsTabExempt(currentTab.id);
  }

  syncIsTabExempt(tabId) {
    return this.syncGetExemptTabStatus(tabId) === "exemptTab";
  }

  syncExemptTab(tabId, status) {
    // We don't care about the return value here.
    this.syncSendMessage("telemetry", { category: "webRTC", event: status });

    log(`exemptTab ${tabId} ${status}`);
    this.syncSetExemptTabStatus(tabId, status);
    // We don't care about the delay here for setting the icon and we can't block here
    this.setTabIcon(tabId);

    // eslint-disable-next-line verify-await/check
    this.showStatusPrompt();
  }

  syncRemoveExemptTab(tabId) {
    log(`removeExemptTab ${tabId}`);
    this.syncSetExemptTabStatus(tabId, "ignoreTab");
    // We don't care about the delay here for setting the icon and we can't block here
    this.setTabIcon(tabId);

    // Re-enable the content script blocking on the tab
    this.informContentScripts();
  }

  // Used to set or remove tab exemption icons
  async setTabIcon(tabId) {
    log(`updating tab icon: ${tabId}`);
    // default value here is undefined which resets the icon back when it becomes non exempt again
    let path;
    // default title resets the tab title
    let title = null;
    if (this.syncIsTabExempt(tabId)) {
      title = this.getTranslation("badgeWarningText");
      path = "/img/badge_warning.svg";
    }

    return Promise.all([
      browser.browserAction.setIcon({
        path,
        tabId
      }),
      browser.browserAction.setTitle({
        tabId,
        title
      }),
    ]);
  }

  contentScriptConnected(port) {
    log("content-script connected");

    // eslint-disable-next-line verify-await/check
    this.contentScriptPorts.set(port.sender.tab.id, port);
    // Let's inform the new port about the current state.
    this.syncContentScriptNotify(port);

    port.onDisconnect.addListener(_ => {
      log("content-script port disconnected");
      // eslint-disable-next-line verify-await/check
      this.contentScriptPorts.delete(port.sender.tab.id);
    });
  }

  informContentScripts() {
    for (const p of this.contentScriptPorts) {
      this.syncContentScriptNotify(p);
    }
  }

  async afterConnectionSteps() {
    this.informContentScripts();
    await this.update();
  }

  syncContentScriptNotify(p) {
    try {
      const exempted = this.syncGetExemptTabStatus(p.sender.tab.id);
      // Post message explicitly is fire and forget
      // eslint-disable-next-line verify-await/check
      p.postMessage({type: "proxyState", enabled: this.cachedProxyState === PROXY_STATE_ACTIVE, exempted});
    } catch (e) {}
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

        case "removeExemptTab":
          // port.sender.tab doesn't exist for browser actions
          const currentTab = await this.getCurrentTab();
          if (currentTab) {
            this.syncRemoveExemptTab(currentTab.id);
            await this.update();
          }
          break;

        case "authenticate":
          await this.sendMessage("authenticationRequired");
          break;

        case "goBack":
          await this.update();
          break;

        case "manageAccount":
          await this.openUrl(await this.sendMessage("managerAccountURL"));
          this.syncSendMessage("telemetry", { category: "settings_url_clicks", event: message.type });
          break;

        case "helpAndSupport":
          await this.formatAndOpenURL(HELP_AND_SUPPORT_URL);
          this.syncSendMessage("telemetry", { category: "settings_url_clicks", event: message.type });
          break;

        case "cloudflare":
          await this.formatAndOpenURL(CLOUDFLARE_URL);
          this.syncSendMessage("telemetry", { category: "settings_url_clicks", event: message.type });
          break;

        case "privacyPolicy":
          await this.openUrl(PRIVACY_POLICY_URL);
          this.syncSendMessage("telemetry", { category: "settings_url_clicks", event: message.type });
          break;

        case "termsAndConditions":
          await this.openUrl(TERMS_AND_CONDITIONS_URL);
          this.syncSendMessage("telemetry", { category: "settings_url_clicks", event: message.type });
          break;

        case "giveUsFeedback":
          await this.openUrl(GIVE_US_FEEDBACK_URL);
          this.syncSendMessage("telemetry", { category: "settings_url_clicks", event: message.type });
          break;

        case "betaLearnMore":
          await this.openUrl(BETA_LEARNMORE_URL);
          break;

        case "betaUpgrade":
          await this.openUrl(BETA_UPGRADE_URL);
          break;

        case "howPassesWork":
          await this.openUrl(BETA_HOW_PASSES_WORK_URL);
          break;

        case "telemetry":
          this.syncSendMessage("telemetry", message.data);
          break;
      }
    });

    port.onDisconnect.addListener(_ => {
      log("Panel disconnected");
      this.currentPort = null;
    });

    await this.sendDataToCurrentPort();
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

    if (await this.isCurrentTabExempt()) {
      promptNotice = "toastTabExempt";
      isWarning = true;
    }

    if (promptNotice) {
      await browser.experiments.proxyutils.showPrompt(this.getTranslation(promptNotice), isWarning);
    }
  }

  async showWarningStatusPrompt() {
    await browser.experiments.proxyutils.showPrompt(this.getTranslation("toastWarning"), true);
  }

  async syncPassNeededToast() {
    if (this.currentPort) {
      return;
    }

    const passes = Passes.syncGet().syncGetPasses();
    const passesAvailable = passes.totalPasses - passes.currentPass;

    if (passesAvailable === 0) {
      // eslint-disable-next-line verify-await/check
      browser.experiments.proxyutils.showPrompt(
        this.getTranslation("toastLastPassExpired"), true);
      return;
    }

    // eslint-disable-next-line verify-await/check
    browser.experiments.proxyutils.showPrompt(
      this.getTranslation("toastPassExpired"), true);
  }

  async syncPassAvailableToast() {
    if (this.currentPort) {
      return;
    }

    const passes = Passes.syncGet().syncGetPasses();
    const passesAvailable = passes.totalPasses - passes.currentPass;

    if (passesAvailable === 1) {
      // eslint-disable-next-line verify-await/check
      browser.experiments.proxyutils.showPrompt(
        this.getTranslation("toastLastPassAvailable"), false);
      return;
    }

    if (passesAvailable > 0) {
      // eslint-disable-next-line verify-await/check
      browser.experiments.proxyutils.showPrompt(
        this.getTranslation("toastPassesAvailable", passesAvailable), false);
      return;
    }

    // eslint-disable-next-line verify-await/check
    browser.experiments.proxyutils.showPrompt(
      this.getTranslation("toastLastPassExpired", passesAvailable), true);
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

  // This updates any tab that doesn't have an exemption
  async updateIcon() {
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

    return Promise.all([
      browser.browserAction.setIcon({
        path: icon,
      }),
      browser.browserAction.setTitle({
        title: this.getTranslation(text),
      }),
    ]);
  }

  async sendDataToCurrentPort() {
    log("Update the panel: ", this.currentPort);
    if (this.currentPort) {
      const exempt = await this.isCurrentTabExempt();
      const profileData = await StorageUtils.getProfileData();
      const migrationCompleted = Passes.syncGet().syncIsMigrationCompleted();
      const dataPasses = Passes.syncGet().syncGetPasses();
      const tokenData = await StorageUtils.getProxyTokenData();

      return this.currentPort.postMessage({
        userInfo: profileData,
        proxyState: this.cachedProxyState,
        exempt,
        migrationCompleted,
        ...dataPasses,
        tokenData,
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
