import {Component} from "./component.js";
import {Logger} from "./logger.js";

const log = Logger.logger("Survey");

const SURVEY_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-exit-survey?sub=no";

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
    await browser.runtime.setUninstallURL(SURVEY_UNINSTALL);
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
}
