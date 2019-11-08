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
              <strong class="sub">${this.getTranslation("viewSettings-manageAccountLink")}</strong>
            </div>
          </a>
        </li>
        <li id="passesSettings" hidden>
          <ul>
            <li>
              <span>${this.getTranslation("viewSettings-autorenew")}</span>
              <input type="checkbox" id="autorenew" class="toggleButton" />
            <li>
              <span class="sub extraSub">${this.getTranslation("viewSettings-autorenewSub")}</span>
            </li>
            <li>
              <span>${this.getTranslation("viewSettings-reminder")}</span>
              <input type="checkbox" id="reminder" class="toggleButton" />
            <li>
              <span class="sub">${this.getTranslation("viewSettings-reminderSub")}</span>
            </li>
          </ul>
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

  syncPostShow(data) {
    if (data.totalPasses !== -1) {
      document.getElementById("passesSettings").hidden = false;
      document.getElementById("reminder").checked = data.reminder;
      document.getElementById("autorenew").checked = data.autorenew;
    }
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
    if (e.target.id === "reminder") {
      // eslint-disable-next-line verify-await/check
      View.sendMessage("setReminder", { value: e.target.checked });
      return;
    }

    if (e.target.id === "autorenew") {
      // eslint-disable-next-line verify-await/check
      View.sendMessage("setAutoRenew", { value: e.target.checked });
      return;
    }

    // eslint-disable-next-line verify-await/check
    if (["cloudflare", "helpAndSupport", "privacyPolicy", "termsAndConditions", "giveUsFeedback"].includes(e.target.id)) {
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
