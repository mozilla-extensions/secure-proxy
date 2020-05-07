/* eslint-disable verify-await/check */
import {View} from "../view.js";
import {animateGlobe, animateRings} from "../animations.js";

class ViewDisabled extends View {
  get stateInfo() {
    return {
      name: "disabled",
      content: escapedTemplate`
        <h2>${this.getTranslation("headingOff")}</h2>
        <h3>${this.getTranslation("subheadingOff")}</h3>
      `
    };
  }

  syncPostShow() {
    animateGlobe([75, 90]);
    animateRings(false);
  }

  async stateButtonHandler() {
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    // eslint-disable-next-line verify-await/check
    await View.sendMessage("setEnabledState", {
      enabledState: true,
      reason: "stateButton",
    });
  }
}

const view = new ViewDisabled();
export default view;
