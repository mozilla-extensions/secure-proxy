import {Component} from "./component.js";
import {StorageUtils} from "./storageUtils.js";

const SURVEY_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-exit-survey?sub=no";

// 15 is the min interval we are allowed to ask.
const IDLE_INTERVAL = 15;

// Survey URLs can contain 'magic' words. These will be replaced with values.
// Here the list of the supported keywords and their meanings:
// - PROXYENABLED - replaced with 'true' or 'false', based on the proxy state.
// - VERSION - the extension version.
// - USAGEDAYS - number of days with the proxy enabled (at least for 1 request)

const SURVEYS = [
  // Onboarding/welcome page
  { name: "onboarding",
    triggerAfterTime: 0,
    URL: "https://private-network.firefox.com/welcome",
    onIdle: false,
  },

  // 14 days
  { name: "14-day",
    triggerAfterTime: 1209600,
    URL: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=14-day&enabled=PROXYENABLED&v=VERSION&days=USAGEDAYS",
    onIdle: true, },

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

    await browser.runtime.setUninstallURL(SURVEY_UNINSTALL);
    await this.scheduleNextSurvey();
  }

  async scheduleNextSurvey() {
    let now = performance.now() + performance.timeOrigin;

    let surveyInitTime = await StorageUtils.getSurveyInitTime();
    if (!surveyInitTime) {
      surveyInitTime = Math.round(now / 1000);
      await StorageUtils.setSurveyInitTime(surveyInitTime);
    }

    // Let's find the next survey to show.
    let nextSurvey = await this.nextSurvey();
    if (nextSurvey) {
      now = Math.round(now / 1000);
      let diff = surveyInitTime + nextSurvey.triggerAfterTime - now;
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
      this.runSurveyInternal(survey);
    } else {
      await this.whenIdle(_ => {
        this.runSurveyInternal(survey);
      });
    }
  }

  async runSurveyInternal(survey) {
    let url = await this.formatUrl(survey.URL);
    await browser.tabs.create({url});

    await StorageUtils.setLastSurvey(survey.name);
    await this.scheduleNextSurvey();
  }

  async formatUrl(url, data) {
    let self = await browser.management.getSelf();
    // eslint-disable-next-line verify-await/check
    return url.replace(/PROXYENABLED/g, this.cachedProxyState === PROXY_STATE_ACTIVE ? "true" : "false")
              .replace(/VERSION/g, self.version)
              .replace(/USAGEDAYS/g, this.lastUsageDays.count);
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
    if (state === 'idle') {
      cb();
      return;
    }

    browser.idle.setDetectionInterval(IDLE_INTERVAL);
    browser.idle.onStateChanged.addListener(function listener(state) {
      if (state === 'idle') {
        browser.idle.onStateChanged.removeListener(listener);
        cb();
      }
    });
  }
}
