// These URLs must be formatted
const LEARN_MORE_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/cloudflare";
const HELP_AND_SUPPORT_URL = "https://support.mozilla.org/1/firefox/%VERSION%/%OS%/%LOCALE%/firefox-private-network";

// These URLs do not need to be formatted
const PRIVACY_POLICY_URL = "https://www.mozilla.org/privacy/firefox-private-network";
const TERMS_AND_CONDITIONS_URL = "https://www.mozilla.org/about/legal/terms/firefox-private-network";

/* eslint-disable-next-line no-unused-vars */
class UI extends Component {
  constructor(receiver) {
    super(receiver);

    this.exemptTabStatus = new Map();

    // A map of content-script ports. The key is the tabId.
    this.contentScriptPorts = new Map();
  }

  init() {
    browser.tabs.onRemoved.addListener((tabId) => {
      this.exemptTabStatus.delete(tabId);
    });

    browser.tabs.onUpdated.addListener((tabId) => {
      // Icon overrides are changes when the user navigates
      this.setTabIcon(tabId);
    });
    browser.tabs.onActivated.addListener((info) => {
      if (this.isTabExempt(info.tabId)) {
        this.showStatusPrompt();
      }
    });

    // eslint-disable-next-line consistent-return
    browser.runtime.onMessage.addListener(async (message, sender) => {
      if (message.type === "getBaseDomainFromHost") {
        return browser.experiments.proxyutils.getBaseDomainFromHost(message.hostname);
      }

      if (message.type === "exempt") {
        this.exemptTab(sender.tab.id, message.status);
      }
    });

    browser.runtime.onConnect.addListener(port => {
      if (port.name === "port-from-cs") {
        this.contentScriptConnected(port);
        return;
      }

      if (port.name === "panel") {
        this.panelConnected(port);
        return;
      }

      log("Invalid port name!");
    });
  }

  async getCurrentTab() {
    let currentTab = (await browser.tabs.query({currentWindow: true, active: true}))[0];
    return currentTab;
  }

  async isCurrentTabExempt() {
    let currentTab = await this.getCurrentTab();
    return currentTab && this.isTabExempt(currentTab.id);
  }

  isTabExempt(tabId) {
    return this.exemptTabStatus.get(tabId) === "exemptTab";
  }

  exemptTab(tabId, status) {
    log(`exemptTab ${tabId} ${status}`);
    this.exemptTabStatus.set(tabId, status);
    this.setTabIcon(tabId);
  }

  removeExemptTab(tabId) {
    log(`removeExemptTab ${tabId}`);
    this.exemptTabStatus.set(tabId, "ignoreTab");
    this.setTabIcon(tabId);

    // Re-enable the content script blocking on the tab
    this.informContentScripts();
  }

  // Used to set or remove tab exemption icons
  setTabIcon(tabId) {
    log(`updating tab icon: ${tabId}`);
    // default value here is undefined which resets the icon back when it becomes non exempt again
    let path;
    // default title resets the tab title
    let title = null;
    if (this.isTabExempt(tabId)) {
      title = this.getTranslation("badgeWarningText");
      path = "img/badge_warning.svg";
    }

    browser.browserAction.setIcon({
      path,
      tabId
    });
    browser.browserAction.setTitle({
      tabId,
      title
    });
  }

  contentScriptConnected(port) {
    log("content-script connected");

    this.contentScriptPorts.set(port.sender.tab.id, port);
    // Let's inform the new port about the current state.
    this.contentScriptNotify(port);

    port.onDisconnect.addListener(_ => {
      log("content-script port disconnected");
      this.contentScriptPorts.delete(port.sender.tab.id);
    });
  }

  informContentScripts() {
    this.contentScriptPorts.forEach(p => {
      this.contentScriptNotify(p);
    });
  }

  afterConnectionSteps() {
    this.informContentScripts();
    this.update();
  }

  contentScriptNotify(p) {
    const exempted = this.exemptTabStatus.get(p.sender.tab.id);
    p.postMessage({type: "proxyState", enabled: this.cachedProxyState === PROXY_STATE_ACTIVE, exempted});
  }

  async panelConnected(port) {
    log("Panel connected");

    // Overwrite any existing port. We want to talk with 1 single popup.
    this.currentPort = port;

    // Let's send the initial data.
    port.onMessage.addListener(async message => {
      log("Message received from the panel", message);

      switch (message.type) {
        case "setEnabledState":
          this.sendMessage("enableProxy", { enabledState: message.data.enabledState });
          break;

        case "removeExemptTab":
          // port.sender.tab doesn't exist for browser actions
          const currentTab = await this.getCurrentTab();
          if (currentTab) {
            this.removeExemptTab(currentTab.id);
            this.update();
          }
          break;

        case "authenticate":
          this.sendMessage("authenticationRequired");
          break;

        case "goBack":
          this.update();
          break;

        case "manageAccount":
          this.openUrl(await this.sendMessage("managerAccountURL"));
          break;

        case "helpAndSupport":
          this.formatAndOpenURL(HELP_AND_SUPPORT_URL);
          break;

        case "learnMore":
          this.formatAndOpenURL(LEARN_MORE_URL);
          break;

        case "privacyPolicy":
          this.openUrl(PRIVACY_POLICY_URL);
          break;

        case "termsAndConditions":
          this.openUrl(TERMS_AND_CONDITIONS_URL);
          break;

        case "openUrl":
          this.openUrl(message.data.url);
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
        promptNotice = "toastWarning";
        isWarning = true;
        break;

      default:
        // no message.
        break;
    }

    if (await this.isCurrentTabExempt()) {
      promptNotice = "toastWarning";
      isWarning = true;
    }

    if (promptNotice) {
      browser.experiments.proxyutils.showPrompt(browser.i18n.getMessage(promptNotice), isWarning);
    }
  }

  update() {
    this.updateIcon();
    this.sendDataToCurrentPort();
    this.showStatusPrompt();
  }

  // This updates any tab that doesn't have an exemption
  updateIcon() {
    let icon;
    let text;
    if (this.cachedProxyState === PROXY_STATE_INACTIVE ||
        this.cachedProxyState === PROXY_STATE_CONNECTING ||
        this.cachedProxyState === PROXY_STATE_OFFLINE) {
      icon = "img/badge_off.svg";
      text = "badgeOffText";
    } else if (this.cachedProxyState === PROXY_STATE_ACTIVE) {
      icon = "img/badge_on.svg";
      text = "badgeOnText";
    } else {
      icon = "img/badge_warning.svg";
      text = "badgeWarningText";
    }

    browser.browserAction.setIcon({
      path: icon,
    });
    browser.browserAction.setTitle({
      title: this.getTranslation(text),
    });
  }

  async sendDataToCurrentPort() {
    log("Update the panel: ", this.currentPort);
    if (this.currentPort) {
      let exempt = await this.isCurrentTabExempt();
      let { profileData } = await browser.storage.local.get(["profileData"]);

      return this.currentPort.postMessage({
        userInfo: profileData,
        proxyState: this.cachedProxyState,
        exempt,
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
    this.openUrl(await browser.experiments.proxyutils.formatURL(url));
  }

  openUrl(url) {
    browser.tabs.create({url});
  }
}
