import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// Settings view.
class ViewSettings extends View {
  show(data) {
    View.showBack(true);
    View.showSettings(false);
    View.setState("hidden");
    return escapedTemplate`
      <ul class="settingsLinks">
        <li><strong>${this.getTranslation("accountLabel")}</strong><span class="end">${data.userInfo.email}</span></li>
        <li><a href="#" id="manageAccountAnchor">${this.getTranslation("manageAccountLink")}</a></li>
        <li><a href="TODO">${this.getTranslation("helpAndSupportLink")}</a></li>
        <li><a href="TODO">${this.getTranslation("privacyPolicyLink")}</a></li>
        <li><a href="TODO">${this.getTranslation("termsAndConditionsLink")}</a></li>
      </ul>
      <button class="primary" id="manageAccount">${this.getTranslation("manageAccountButton")}</button>
    `;
  }

  handleEvent(e) {
    if (e.target.id == "manageAccount" || e.target.id == "manageAccountAnchor") {
      View.sendMessage("manageAccount");
      e.preventDefault();
      close();
      return;
    }
  }
}

const view = new ViewSettings();
const name = "settings";

View.registerView(view, name);
export default name;
