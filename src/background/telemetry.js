import {Component} from "./component.js";
import {constants} from "./constants.js";
import {Logger} from "./logger.js";

const log = Logger.logger("Telemetry");

const TELEMETRY_CATEGORY = "secure.proxy";
const TELEMETRY_EVENTS = {
  "general": {
    methods: [ "general" ],
    objects: [ "otherProxyInUse", "settingsShown", "loadingError", "install",
               "update", "panelShown" ],
    extra_keys: [ "version" ],
    record_on_release: true,
  },
  "state": {
    methods: [ "state" ],
    objects: [ "proxyEnabled", "proxyDisabled", ],
    extra_keys: [ "passes", "version" ],
    record_on_release: true,
  },
  "authentication": {
    methods: [ "fxa" ],
    objects: [ "authStarted", "authCompleted", "authFailed", "authFailedByGeo" ],
    extra_keys: [ "version" ],
    record_on_release: true,
  },
  "networkingEvents": {
    methods: [ "networking" ],
    objects: [ "407", "429", "502", "connecting", "proxyDown" ],
    extra_keys: [ "version" ],
    record_on_release: true,
  },
  "settingsUrlClicks": {
    methods: [ "settings_url_clicks" ],
    objects: [ "manageAccount", "helpAndSupport", "cloudflare", "privacyPolicy",
               "termsAndConditions", "giveUsFeedback", ],
    extra_keys: [ "version" ],
    record_on_release: true,
  },
  "upsellClicks": {
    methods: [ "upsell_clicks" ],
    objects: [ "footer", "expired" ],
    extra_keys: [ "version" ],
    record_on_release: true,
  },
  "settings": {
    methods: [ "settings" ],
    objects: [ "setReminder", "setAutoRenew", ],
    extra_keys: [ "version" ],
    record_on_release: true,
  },
};
const TELEMETRY_SCALARS = {
  bandwidth: {
    kind: browser.telemetry.ScalarType.COUNT,
    keyed: false,
    record_on_release: true,
  }
};

export class Telemetry extends Component {
  constructor(receiver) {
    super(receiver);

    browser.runtime.onInstalled.addListener(async details => this.onInstalled(details));

    log("Registering telemetry events");

    // eslint-disable-next-line verify-await/check
    browser.telemetry.registerEvents(TELEMETRY_CATEGORY, TELEMETRY_EVENTS).catch(e => {
      console.error("Failed to register telemetry events!", e);
    });

    // eslint-disable-next-line verify-await/check
    browser.telemetry.registerScalars(TELEMETRY_CATEGORY, TELEMETRY_SCALARS).catch(e => {
      console.error("Failed to register telemetry scalars!", e);
    });

    this.version = "";
  }

  async init() {
    const self = await browser.management.getSelf();
    this.version = self.version;
  }

  async onInstalled(details) {
    if (details.reason === "install" || details.reason === "update") {
      let version;

      try {
        let self = await browser.management.getSelf();
        version = self.version;
      } catch (e) {
        version = null;
      }

      this.syncAddEvent("general", details.reason, version);
    }
  }

  syncAddEvent(category, event, value = null, extra = null) {
    log(`Sending telemetry: ${category} - ${event} - ${value} - ${extra}`);

    if (constants.isAndroid) {
      log(`No telemetry on android`);
      return;
    }

    const extraValues = {
      version: this.version,
      ...extra
    };

    // eslint-disable-next-line verify-await/check
    browser.telemetry.recordEvent(TELEMETRY_CATEGORY, category, event, value, extraValues).catch(e => {
      console.error("Telemetry.recordEvent failed", e);
    });
  }

  syncAddScalar(scalarName, value) {
    log(`Sending telemetry scalar: ${scalarName} - ${value}`);

    // eslint-disable-next-line verify-await/check
    browser.telemetry.scalarAdd(TELEMETRY_CATEGORY + "." + scalarName, value).catch(e => {
      console.error("Telemetry.scalarAdd failed", e);
    });
  }
}
