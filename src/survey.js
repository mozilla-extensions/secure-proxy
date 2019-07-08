const SURVEY_UNINSTALL = "https://qsurvey.mozilla.com/s3/fx-private-network-beta-survey?type=exit";

// This class controls the survey URLs and when they have to be shown.
class Survey {
  async init() {
    await browser.runtime.setUninstallURL(SURVEY_UNINSTALL);
  }
}
