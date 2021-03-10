import {Component} from "./component.js";
import {Logger} from "./logger.js";

const log = Logger.logger("PrivacySettings");

// Make sure we have dFPI (or stronger) enabled.
let enableCookieIsolation = async () => {
  const initialConfig = await browser.privacy.websites.cookieConfig.get({});
  if (["reject_trackers", "allow_all", "allow_visited"].includes(
    initialConfig.value.behavior)) {
    // Cookie behavior is too weak. Let's upgrade to dFPI.
    await browser.privacy.websites.cookieConfig.set({
      value: {behavior: "reject_trackers_and_partition_foreign"}});
  }
};

// Relinquish control of cookie settings.
let resetCookieSettings = async () => {
  await browser.privacy.websites.cookieConfig.clear({});
};

// Class to control the cookie settings when the proxy is enabled.
export class PrivacySettings extends Component {
  constructor(receiver) {
    super(receiver);
  }

  setProxyState(proxyState) {
    log(`${proxyState}: proxyState`);
    if (proxyState === PROXY_STATE_INACTIVE) {
      resetCookieSettings();
    } else {
      enableCookieIsolation();
    }
  }
}
