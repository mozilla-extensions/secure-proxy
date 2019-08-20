import {Component} from "./component.js";
import {StorageUtils} from "./storage.js";

const SURVEY_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-exit-survey?sub=no";

// Survey URLs can contain 'magic' words. These will be replaced with values.
// Here the list of the supported keywords and their meanings:
// - PROXYENABLED - replaced with 'true' or 'false', based on the proxy state.
// - VERSION - the extension version.

const SURVEYS = [
  // Onboarding/welcome page
  { name: "onboarding", triggerAfterTime: 0, URL: "https://private-network.firefox.com/welcome" },

  // 14 days
  { name: "14-day", triggerAfterTime: 1209600, URL: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=14-day&enabled=PROXYENABLED&v=VERSION" },

];

// This class controls the survey URLs and when they have to be shown.

export class Survey extends Component {
  constructor(receiver) {
    super(receiver);

    this.surveys = [];
  }

  async init() {
    await this.initInternal(SURVEYS);
  }

  async initInternal(surveys) {
    this.surveys = surveys;

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

    let url = await this.formatUrl(survey.URL);
    await browser.tabs.create({url});

    await StorageUtils.setLastSurvey(surveyName);
    await this.scheduleNextSurvey();
  }

  async formatUrl(url, data) {
    let self = await browser.management.getSelf();
    // eslint-disable-next-line verify-await/check
    return url.replace(/PROXYENABLED/g, this.cachedProxyState === PROXY_STATE_ACTIVE ? "true" : "false")
              .replace(/VERSION/g, self.version);
  }
}
