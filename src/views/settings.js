import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// Settings view.
class ViewSettings extends View {
  show(data) {
    View.setState("hidden");
    return escapedTemplate`
      <ul class="settingsLinks">
        <li><strong>${this.getTranslation("accountLabel")}</strong><span class="end">${data.userInfo.email}</span></li>
        <li><a href="https://support.mozilla.org/en-US/">${this.getTranslation("manageAccountLink")}</a></li>
        <li><a href="https://support.mozilla.org/en-US/">${this.getTranslation("helpAndSupportLink")}</a></li>
        <li><a href="https://support.mozilla.org/en-US/">${this.getTranslation("privacyPolicyLink")}</a></li>
        <li><a href="https://support.mozilla.org/en-US/">${this.getTranslation("termsAndConditionsLink")}</a></li>
      </ul>
      <button class="primary">${this.getTranslation("manageAccountButton")}</button>
    `;
  }
}

const view = new ViewSettings();
const name = "settings";

View.registerView(view, name);
export default name;
