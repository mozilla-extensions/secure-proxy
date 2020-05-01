import {View} from "../view.js";

const LOG_DOWNLOAD_CLICKS = 12;

// Settings view.
class ViewSettings extends View {
  syncShow(data) {
    View.showBack(true);
    View.showSettings(false);
    View.hideToggleButton();
    View.setState("hidden");

    this.headerClicks = 0;

    return escapedTemplate`
      <ul class="settingsMenu">
        <li class="manage">
          <a href="#" class="link" id="manageAccount">
            <img src="${data.userInfo.avatar}" />
            <div class="details">
              <span id="email">${data.userInfo.email}</span>
              <strong class="sub">${this.getTranslation("viewSettings-manageAccountLink")}</strong>
            </div>
          </a>
        </li>
        <li>
          <ul>
            <li><a href="#" class="link" id="helpAndSupport">${this.getTranslation("viewSettings-helpAndSupportLink")}</a></li>
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
    if (["cloudflare", "helpAndSupport", "privacyPolicy", "termsAndConditions", "giveUsFeedback"].includes(e.target.id)) {
      await View.sendMessage(e.target.id);
      View.close();
    }

    if (e.target.closest("#manageAccount")) {
      await View.sendMessage("manageAccount");
      View.close();
    }

    if (e.target.id === "introHeading" && ++this.headerClicks === LOG_DOWNLOAD_CLICKS) {
      await View.sendMessage("logRequired");
    }

    e.preventDefault();
  }
}

const view = new ViewSettings();
export default view;
