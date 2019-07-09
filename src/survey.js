const SURVEY_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=exit";

// TODO set the correct deltaTime and URLs
const SURVEYS = [
 { name: "start", deltaTime: 1, URL: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=start" },
 { name: "mid", deltaTime: 300, URL: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=start" },
 { name: "late", deltaTime: 600, URL: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=start" },
];

// This class controls the survey URLs and when they have to be shown.
class Survey {
  async init() {
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
    let { lastSurvey } = await browser.storage.local.get(["lastSurvey"]);
    let nextSurvey = null;
    if (!lastSurvey) {
      nextSurvey = SURVEYS[0];
    } else {
      // If the next one doesn't exist, nextSurvey will be undefined.
      nextSurvey = SURVEYS[SURVEYS.findIndex(a => lastSurvey == a.name) + 1];
    }

    if (nextSurvey) {
      now = Math.round(now / 1000);
      let diff = surveyInitTime + nextSurvey.deltaTime - now;
      if (diff < 0) {
        this.showSurvey(nextSurvey);
      } else {
        setTimeout(_ => { this.showSurvey(nextSurvey); }, diff * 1000);
      }
    }
  }

  async showSurvey(survey) {
    await browser.tabs.create({
      url: survey.URL,
    })

    await browser.storage.local.set({lastSurvey: survey.name});
    await this.scheduleNextSurvey();
  }
}
