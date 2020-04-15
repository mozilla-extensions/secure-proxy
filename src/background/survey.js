import {Component} from "./component.js";
import {Passes} from "./passes.js";
import {StorageUtils} from "./storageUtils.js";
import {Logger} from "./logger.js";

const log = Logger.logger("Survey");

const SURVEY_UNLIMITED_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-exit-survey?sub=no";
const SURVEY_FREETIER_UNINSTALL = "https://qsurvey.mozilla.com/s3/Firefox-Private-Network-Exit-Survey-Phase-Two-Pass-Based";

// Onboarding/welcome page
const ONBOARDING = "/pages/welcome.html";

// This class controls the onboarding page and the uninstall survey URLs.
export class Survey extends Component {
  constructor(receiver) {
    super(receiver);
    browser.runtime.onInstalled.addListener(async details => this.onInstalled(details));
  }

  async init() {
    log("init");
    await this.setUninstallURL();
  }

  async onInstalled(details) {
    log("installed");

    if (details.reason !== "install") {
      return;
    }

    const url = browser.runtime.getURL(ONBOARDING);

    browser.tabs.create({
      url,
      active: true,
    });
  }

  async passReceived() {
    log("passes received");
    await this.setUninstallURL();
  }

  async setUninstallURL() {
    if (Passes.syncGet().syncAreUnlimited()) {
      log("setting the uninstall URL: unlimited");
      await browser.runtime.setUninstallURL(SURVEY_UNLIMITED_UNINSTALL);
    } else {
      log("setting the uninstall URL: limited");
      await browser.runtime.setUninstallURL(SURVEY_FREETIER_UNINSTALL);
    }
  }
}
