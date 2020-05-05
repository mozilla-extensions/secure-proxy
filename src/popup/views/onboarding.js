import {View} from '../view.js';

class ViewOnboarding extends View {
  syncShow() {
    return escapedTemplate`
      <button id="onboardingCloseButton" class="close-button" aria-label="${this.getTranslation("onboardingCloseButtonLabel")}"></button>
      <div class="card">
        <div class="content-icon"></div>
        <div>
          <h2>${this.getTranslation("onboardingHeaderStep1")}</h2>
          <p>${this.getTranslation("onboardingDescriptionStep1")}</p>
        </div>
      </div>
      <div class="card" hidden>
        <div class="content-icon"></div>
        <div>
          <h2>${this.getTranslation("onboardingHeaderStep2")}</h2>
          <p>${this.getTranslation("onboardingDescriptionStep2")}</p>
        </div>
      </div>
      <div class="card" hidden>
        <div class="content-icon"></div>
        <div>
          <h2>${this.getTranslation("onboardingHeaderStep3")}</h2>
          <p>${this.getTranslation("onboardingDescriptionStep3")}</p>
        </div>
      </div>
      <button class="primary" id="onboardingNextButton">${this.getTranslation("onboardingNext")}</button>
      <button class="primary" id="onboardingDoneButton" hidden>${this.getTranslation("onboardingDone")}</button>`;
  }

  async handleClickEvent(e) {
    if (e.target.id == "onboardingNextButton") {
      // Jump to the next card on clicking "next".
      let activeCard = document.querySelector(".card:not([hidden])");
      let nextCard = activeCard.nextElementSibling;
      activeCard.toggleAttribute("hidden", true);
      nextCard.removeAttribute("hidden");

      // Show the done button on the last card.
      if (!nextCard.nextElementSibling.classList.contains("card")) {
        document.getElementById("onboardingNextButton").toggleAttribute("hidden", true);
        document.getElementById("onboardingDoneButton").removeAttribute("hidden");
      }
      e.preventDefault();
    }
    if (e.target.id == "onboardingDoneButton" || e.target.id == "onboardingCloseButton") {
      await View.sendMessage("onboardingEnd");
      e.preventDefault();
    }
  }
}

const view = new ViewOnboarding();
export default view;
