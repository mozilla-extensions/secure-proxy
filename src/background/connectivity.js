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
  }
}
