import {View} from "../view.js";

class ViewOnboarding extends View {
  syncShow() {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.hideToggleButton();

    return escapedTemplate`
      <a href="#" id="onboardingEnd">END THE ONBOARDING</a></p>
    `;
  }

  async handleClickEvent(e) {
    if (e.target.id == "onboardingEnd") {
      await View.sendMessage(e.target.id);
      e.preventDefault();
    }
  }
}

const view = new ViewOnboarding();
export default view;
