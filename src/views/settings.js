import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// Settings view.
class ViewSettings extends View {
  show(data) {
    View.showBack(true);
    View.showSettings(false);
    View.hideToggleButton();
    View.setState("hidden");
    return escapedTemplate`
      <ul class="settingsLinks">
        <li><strong>${this.getTranslation("viewSettings-accountLabel")}</strong><span class="end">${data.userInfo.email}</span></li>
        <li><a href="#" id="manageAccountAnchor">${this.getTranslation("viewSettings-manageAccountLink")}</a></li>
        <li><a href="#" id="helpAndSupport">${this.getTranslation("viewSettings-helpAndSupportLink")}</a></li>
        <li><a href="#" id="giveUsFeedback">${this.getTranslation("viewSettings-giveUsFeedbackLink")}</a></li>
        <li><a href="TODO">${this.getTranslation("viewSettings-privacyPolicyLink")}</a></li>
        <li><a href="TODO">${this.getTranslation("viewSettings-termsAndConditionsLink")}</a></li>
      </ul>
      <button class="primary" id="manageAccount">${this.getTranslation("viewSettings-manageAccountButton")}</button>
    `;
  }

  footer() {
    return escapedTemplate`
      <span>${this.getTranslation("popupPoweredBy")}</span>
      <a href="#" data-l10n="popupLearnMore" class="end" id="learnMoreLink"></a>
    `;
  }

  handleEvent(e) {
    if (e.target.id == "learnMoreLink") {
      View.sendMessage("learnMore");
    }
    if (e.target.id == "manageAccount" || e.target.id == "manageAccountAnchor") {
      View.sendMessage("manageAccount");
    }

    if (e.target.id == "giveUsFeedback") {
      View.sendMessage("openUrl", {url: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-feedback"});
    }

    if (e.target.id == "helpAndSupport") {
      View.sendMessage("helpAndSupport");
    }

    e.preventDefault();
    close();
  }
}

const view = new ViewSettings();
const name = "settings";

View.registerView(view, name);
export default name;
