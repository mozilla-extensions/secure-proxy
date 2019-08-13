import {View} from "../view.js";

// Settings view.
class ViewSettings extends View {
  show(data) {
    View.showBack(true);
    View.showSettings(false);
    View.hideToggleButton();
    View.setState("hidden");
    return escapedTemplate`
      <ul class="settingsMenu">
        <li class="manage">
          <a href="#" id="manageAccount">
            <img src="${data.userInfo.avatar}" />
            <div class="details">
              <span id="email">${data.userInfo.email}</span>
              <strong>${this.getTranslation("viewSettings-manageAccountLink")}</strong>
            </div>
          </a>
        </li>
        <li>
          <ul>
            <li><a href="#" id="helpAndSupport">${this.getTranslation("viewSettings-helpAndSupportLink")}</a></li>
            <li><a href="#" id="giveUsFeedback">${this.getTranslation("viewSettings-giveUsFeedbackLink")}</a></li>
          </ul>
        </li>
        <li>
          <ul>
            <li><a href="#" id="privacyPolicy">${this.getTranslation("viewSettings-privacyPolicyLink")}</a></li>
            <li><a href="#" id="termsAndConditions">${this.getTranslation("viewSettings-termsAndConditionsLink")}</a></li>
          </ul>
        </li>
      </ul>
    `;
  }

  headingText() { return "introSettings"; }

  footer() {
    return escapedTemplate`
      <span>${this.getTranslation("popupPoweredBy")}</span>
      <a href="#" class="end" id="learnMore">${this.getTranslation("popupLearnMore")}</a>
    `;
  }

  async handleEvent(e) {
    if (["learnMore", "helpAndSupport", "privacyPolicy", "termsAndConditions"].includes(e.target.id)) {
      await View.sendMessage(e.target.id);
      close();
    }
    if (e.target.closest("#manageAccount")) {
      await View.sendMessage("manageAccount");
      close();
    }

    if (e.target.id === "giveUsFeedback") {
      await View.sendMessage("openUrl", {url: "https://qsurvey.mozilla.com/s3/fx-private-network-beta-feedback"});
      close();
    }

    e.preventDefault();
  }
}

const view = new ViewSettings();
export default view;
