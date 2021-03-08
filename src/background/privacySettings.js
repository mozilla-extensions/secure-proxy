import {Component} from "./component.js";
import {Logger} from "./logger.js";

const log = Logger.logger("PrivacySettings");

// Make sure we have dFPI (or stronger) enabled.
let enforceCookieIsolation = async () => {
  const initialConfig = await browser.privacy.websites.cookieConfig.get({});
  log(`initial privacy config: ${initialConfig}`);

  if (initialConfig.value.behavior === "reject_trackers") {
    // Cookie behavior is too weak. Let's upgrade to dFPI.
    await browser.privacy.websites.cookieConfig.set({
      value: {behavior: "reject_trackers_and_partition_foreign"}});
  }

  const finalConfig = await browser.privacy.websites.cookieConfig.get({});
  log(`final privacy config: ${finalConfig}`);
};

export class PrivacySettings extends Component {
  constructor(receiver) {
    super(receiver);
    browser.runtime.onInstalled.addListener(enforceCookieIsolation);
  }
}
