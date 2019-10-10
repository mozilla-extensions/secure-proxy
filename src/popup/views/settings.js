import {View} from "../view.js";

// Settings view.
class ViewSettings extends View {
  syncShow(data) {
    View.showBack(true);
    View.showSettings(false);
    View.hideToggleButton();
    View.setState("hidden");
    return escapedTemplate`
      <ul class="settingsMenu">
        <li class="manage">
          <a href="#" class="link" id="manageAccount">
            <img src="${data.userInfo.avatar}" />
            <div class="details">
              <span id="email">${data.userInfo.email}</span>
              <strong>${this.getTranslation("viewSettings-manageAccountLink")}</strong>
            </div>
          </a>
        </li>
        <li>
          <ul>
            <li><a href="#" class="link" id="helpAndSupport">${this.getTranslation("viewSettings-helpAndSupportLink")}</a></li>
            <li><a href="#" class="link" id="howPassesWork">${this.getTranslation("viewSettings-howPassesWorkLink")}</a></li>
            <li><a href="#" class="link" id="giveUsFeedback">${this.getTranslation("viewSettings-giveUsFeedbackLink")}</a></li>
          </ul>
        </li>
        <li>
          <ul>
            <li><a href="#" class="link" id="privacyPolicy">${this.getTranslation("viewSettings-privacyPolicyLink")}</a></li>
            <li><a href="#" class="link" id="termsAndConditions">${this.getTranslation("viewSettings-termsAndConditionsLink")}</a></li>
          </ul>
        </li>
      </ul>
    `;
  }

  syncHeadingText() { return "introSettings"; }

  syncFooter() {
    return escapedTemplate`
      <span id="poweredBy">${this.getTranslation("popupPoweredBy")}</span>
      <a href="#" class="link" id="cloudflare">${this.getTranslation("popupCloudflare")}</a>
      <span>${this.getTranslation("popupCloudflareRT")}</span>
    `;
  }

  async handleClickEvent(e) {
    // eslint-disable-next-line verify-await/check
    if (["cloudflare", "howPassesWork", "helpAndSupport", "privacyPolicy", "termsAndConditions", "giveUsFeedback"].includes(e.target.id)) {
      await View.sendMessage(e.target.id);
      View.close();
    }
    if (e.target.closest("#manageAccount")) {
      await View.sendMessage("manageAccount");
      View.close();
    }

    e.preventDefault();
  }
}

const view = new ViewSettings();
export default view;
