/* eslint-disable-next-line no-unused-vars */
class Connectivity extends Component {
  constructor(receiver) {
    super(receiver);
  }

  init() {
    // proxy setting change observer
    browser.experiments.proxyutils.onChanged.addListener(async _ => {
      this.sendMessage("proxySettingsChanged");
    });

    // connectivity observer.
    browser.experiments.proxyutils.onConnectionChanged.addListener(connectivity => {
      this.sendMessage("connectivityChanged", { connectivity });
    });
  }
}
