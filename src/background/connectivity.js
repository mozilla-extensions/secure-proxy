import {Component} from "./component.js";

export class Connectivity extends Component {
  constructor(receiver) {
    super(receiver);

    // proxy setting change observer
    browser.experiments.proxyutils.onChanged.addListener(async _ => {
      return this.sendMessage("proxySettingsChanged");
    });

    // connectivity observer.
    browser.experiments.proxyutils.onConnectionChanged.addListener(async connectivity => {
      return this.sendMessage("connectivityChanged", { connectivity });
    });

    // captive portal observer.
    browser.captivePortal.onStateChanged.addListener(data => {
      return this.sendMessage("captivePortalStateChanged", data);
    });
  }

  async init() {
    if (await this.inCaptivePortal()) {
      // No await here!
      // eslint-disable-next-line verify-await/check
      this.sendMessage("captivePortalStateChanged", {state: "locked_portal" });
    }
  }

  async inCaptivePortal() {
    let state = await browser.captivePortal.getState();
    return state === "locked_portal";
  }
}
