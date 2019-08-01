const SURVEY_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-exit-survey?sub=no";

// Survey URLs can contain 'magic' words. These will be replaced with values.
// Here the list of the supported keywords and their meanings:
// - PROXYENABLED - replaced with 'true' or 'false', based on the proxy state.
// - VERSION - the extension version.
// - USAGEDAYS - number of days with the proxy enabled (at least for 1 request)

const SURVEYS = [
  // Onboarding/welcome page
  { name: "onboarding", triggerAfterTime: 0, URL: "https://private-network.firefox.com/welcome" },

  // 14 days
  { name: "14-day", triggerAfterTime: 1209600, URL: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=14-day&enabled=PROXYENABLED&v=VERSION&days=USAGEDAYS" },

];

// This class controls the survey URLs and when they have to be shown.

// eslint-disable-next-line
class Survey {
  async init(backgroundObj) {
    this.background = backgroundObj;

    await browser.runtime.setUninstallURL(SURVEY_UNINSTALL);
    await this.scheduleNextSurvey();
  }

  async scheduleNextSurvey() {
    let now = performance.now() + performance.timeOrigin;

    let { surveyInitTime } = await browser.storage.local.get(["surveyInitTime"]);
    if (!surveyInitTime) {
      surveyInitTime = Math.round(now / 1000);
      await browser.storage.local.set({surveyInitTime});
    }

    // Let's find the next survey to show.
    let nextSurvey = await this.nextSurvey();
    if (nextSurvey) {
      now = Math.round(now / 1000);
      let diff = surveyInitTime + nextSurvey.triggerAfterTime - now;
      if (diff < 0) {
        this.runSurvey(nextSurvey.name);
      } else {
        setTimeout(_ => { this.runSurvey(nextSurvey.name); }, diff * 1000);
      }
    }
  }

  // Return the next available survey.
  async nextSurvey() {
    let { lastSurvey } = await browser.storage.local.get(["lastSurvey"]);
    let nextSurvey = null;
    if (!lastSurvey) {
      nextSurvey = SURVEYS[0];
    } else {
      // If the next one doesn't exist, nextSurvey will be undefined.
      nextSurvey = SURVEYS[SURVEYS.findIndex(a => lastSurvey === a.name) + 1];
    }

    return nextSurvey;
  }

  async runSurvey(surveyName) {
    let survey = await this.nextSurvey();
    if (!survey || survey.name !== surveyName) {
      return;
    }

    let data = await this.background.proxyStatus();
    let url = this.formatUrl(survey.URL, data);

    await this.background.openUrl(url);

    await browser.storage.local.set({lastSurvey: surveyName});
    await this.scheduleNextSurvey();
  }

  formatUrl(url, data) {
    return url.replace(/PROXYENABLED/g, data.proxyEnabled ? "true" : "false")
              .replace(/VERSION/g, data.version)
              .replace(/USAGEDAYS/g, data.usageDays);
  }
}
