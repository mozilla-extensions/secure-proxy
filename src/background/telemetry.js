import {Component} from "./component.js";

const TELEMETRY_CATEGORY = "secure.proxy";
const TELEMETRY_EVENTS = {
  "general": {
    methods: [ "general" ],
    objects: [ "otherProxyInUse", "settingsShown", "loadingError", "install",
               "update", "proxyEnabled", "proxyDisabled" ],
    extra_keys: [],
  },
  "authentication": {
    methods: [ "fxa" ],
    objects: [ "authStarted", "authCompleted", "authFailed", ],
    extra_keys: [],
  },
  "networkingEvents": {
    methods: [ "networking" ],
    objects: [ "407", "429", ],
    extra_keys: [],
  },
  "settingsUrlClicks": {
    methods: [ "settings_url_clicks" ],
    objects: [ "manageAccount", "helpAndSupport", "cloudflare", "privacyPolicy",
               "termsAndConditions", "giveUsFeedback" ],
    extra_keys: [],
  },
  "webRTC": {
    methods: [ "webRTC" ],
    objects: [ "ignoreTab", "exemptTab" ],
    extra_keys: [],
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

  async init() {
    // Nothing here.
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
    browser.telemetry.recordEvent(TELEMETRY_CATEGORY, category, event, value).then(e => {
      console.error("Telemetry.recordEvent failed", e);
    });
  }
}
