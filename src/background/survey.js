import {Component} from "./component.js";
import {Passes} from "./passes.js";
import {StorageUtils} from "./storageUtils.js";

const SURVEY_UNLIMITED_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-exit-survey?sub=no";
const SURVEY_FREETIER_UNINSTALL = "https://qsurvey.mozilla.com/s3/Firefox-Private-Network-Exit-Survey-Phase-Two-Pass-Based";

const IDLE_INTERVAL = 60; // seconds
const FULLSCREEN_TIMEOUT = 3600; // seconds

// Survey URLs can contain 'magic' words. These will be replaced with values.
// Here the list of the supported keywords and their meanings:
// - PROXYENABLED - replaced with 'true' or 'false', based on the proxy state.
// - VERSION - the extension version.
// - USAGEDAYS - number of days with the proxy enabled (at least for 1 request)

const SURVEYS = [
  // Onboarding/welcome page
  { name: "onboarding",
    triggerAfterTime: 0,
    URL: "pages/welcome.html",
    onIdle: false,
    background: false,
  },

  // 14 days
  { name: "14-day",
    triggerAfterTime: 1209600,
    URL: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=14-day&enabled=PROXYENABLED&v=VERSION&days=USAGEDAYS&passes=PASSES",
    onIdle: true,
    background: true,
  },

];

// This class controls the survey URLs and when they have to be shown.

export class Survey extends Component {
  constructor(receiver) {
    super(receiver);

    this.surveys = [];

    this.lastUsageDaysPending = false;
  }

  async init() {
    await this.initInternal(SURVEYS);
  }

  async initInternal(surveys) {
    this.surveys = surveys;

    // Let's take the last date of usage.
    let lastUsageDays = await StorageUtils.getLastUsageDays();
    if (!lastUsageDays) {
       lastUsageDays = {
         date: null,
         count: 0,
       };
    }
    this.lastUsageDays = lastUsageDays;

    await this.setUninstallURL();
    await this.scheduleNextSurvey();
  }

  async passReceived() {
    await this.setUninstallURL();
  }

  async setUninstallURL() {
    if (Passes.syncGet().syncAreUnlimited()) {
      await browser.runtime.setUninstallURL(SURVEY_UNLIMITED_UNINSTALL);
    } else {
      await browser.runtime.setUninstallURL(SURVEY_FREETIER_UNINSTALL);
    }
  }

  async scheduleNextSurvey() {
    // eslint-disable-next-line verify-await/check
    let now = Date.now();

    let surveyInitialTime = await StorageUtils.getSurveyInitialTime();
    if (!surveyInitialTime) {
      surveyInitialTime = Math.floor(now / 1000);
      await StorageUtils.setSurveyInitialTime(surveyInitialTime);
    }

    // Let's find the next survey to show.
    let nextSurvey = await this.nextSurvey();
    if (nextSurvey) {
      now = Math.floor(now / 1000);
      let diff = surveyInitialTime + nextSurvey.triggerAfterTime - now;
      if (diff < 0) {
        diff = 0;
      }

      // Let's continue async.
      setTimeout(_ => this.runSurvey(nextSurvey.name), diff * 1000);
    }
  }

  // Return the next available survey.
  async nextSurvey() {
    let nextSurvey = null;

    let lastSurvey = await StorageUtils.getLastSurvey();
    if (!lastSurvey) {
      nextSurvey = this.surveys[0];
    } else {
      // If the next one doesn't exist, nextSurvey will be undefined.
      // eslint-disable-next-line verify-await/check
      nextSurvey = this.surveys[this.surveys.findIndex(a => lastSurvey === a.name) + 1];
    }

    return nextSurvey;
  }

  async runSurvey(surveyName) {
    let survey = await this.nextSurvey();
    if (!survey || survey.name !== surveyName) {
      return;
    }

    if (!survey.onIdle) {
      await this.runSurveyInternal(survey);
      return;
    }

    // The current window is in fullscreen. Let's wait.
    let w = await browser.windows.getLastFocused();
    if (!w || w.type.state === "fullscreen") {
      setTimeout(_ => this.scheduleNextSurvey(), FULLSCREEN_TIMEOUT * 1000);
      return;
    }

    // As soon as in idle...
    await this.whenIdle(_ => {
      return this.runSurveyInternal(survey);
    });
  }

  async runSurveyInternal(survey) {
    if (!survey.syncSkipIf || !survey.syncSkipIf()) {
      let url = await this.formatUrl(survey.URL);
      await browser.tabs.create({
        url,
        active: !survey.background,
      });
    }

    await StorageUtils.setLastSurvey(survey.name);
    await this.scheduleNextSurvey();
  }

  async formatUrl(url, data) {
    let self = await browser.management.getSelf();
    let passes = Passes.syncGet().syncGetPasses();

    // eslint-disable-next-line verify-await/check
    url = url.replace(/PROXYENABLED/g, this.cachedProxyState === PROXY_STATE_ACTIVE ? "true" : "false")
             .replace(/VERSION/g, self.version)
             .replace(/USAGEDAYS/g, this.lastUsageDays.count)
             .replace(/PASSES/g, passes.currentPass || 0);

    // eslint-disable-next-line verify-await/check
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    return browser.runtime.getURL(url);
  }

  setProxyState(proxyState) {
    super.setProxyState(proxyState);

    if (this.cachedProxyState !== PROXY_STATE_ACTIVE) {
      return;
    }

    if (this.lastUsageDaysPending) {
      return;
    }

    const options = { year: "numeric", month: "2-digit", day: "2-digit" };
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", options).format;

    // eslint-disable-next-line verify-await/check
    let now = dateTimeFormat(Date.now());
    if (this.lastUsageDays.date === now) {
      return;
    }

    this.lastUsageDaysPending = true;
    this.lastUsageDays.date = now;
    this.lastUsageDays.count += 1;

    // eslint-disable-next-line verify-await/check
    StorageUtils.setLastUsageDays(this.lastUsageDays).
      then(_ => { this.lastUsageDaysPending = false; });
  }

  async whenIdle(cb) {
    const state = await browser.idle.queryState(IDLE_INTERVAL);
    if (state === "idle") {
      // eslint-disable-next-line verify-await/check
      cb();
      return;
    }

    // eslint-disable-next-line verify-await/check
    browser.idle.setDetectionInterval(IDLE_INTERVAL);
    browser.idle.onStateChanged.addListener(function listener(state) {
      if (state === "idle") {
        // eslint-disable-next-line verify-await/check
        browser.idle.onStateChanged.removeListener(listener);
        // eslint-disable-next-line verify-await/check
        cb();
      }
    });
  }
}
