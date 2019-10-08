import {Component} from "./component.js";

const TELEMETRY_CATEGORY = "secure.proxy";
const TELEMETRY_EVENTS = {
  "general": {
    methods: [ "general" ],
    objects: [ "otherProxyInUse", "settingsShown", "loadingError", "install",
               "update", "proxyEnabled", "proxyDisabled", "panelShown" ],
    extra_keys: [],
    record_on_release: true,
  },
  "authentication": {
    methods: [ "fxa" ],
    objects: [ "authStarted", "authCompleted", "authFailed", ],
    extra_keys: [],
    record_on_release: true,
  },
  "networkingEvents": {
    methods: [ "networking" ],
    objects: [ "407", "429", "connecting", "proxyDown" ],
    extra_keys: [],
    record_on_release: true,
  },
  "settingsUrlClicks": {
    methods: [ "settings_url_clicks" ],
    objects: [ "manageAccount", "helpAndSupport", "cloudflare", "privacyPolicy",
               "termsAndConditions", "giveUsFeedback" ],
    extra_keys: [],
    record_on_release: true,
  },
  "webRTC": {
    methods: [ "webRTC" ],
    objects: [ "ignoreTab", "exemptTab" ],
    extra_keys: [],
    record_on_release: true,
  },
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

  syncAddEvent(category, event, value = null) {
    log(`Sending telemetry: ${category} - ${event} - ${value}`);

    // eslint-disable-next-line verify-await/check
    browser.telemetry.recordEvent(TELEMETRY_CATEGORY, category, event, value).catch(e => {
      console.error("Telemetry.recordEvent failed", e);
    });
  }
}
