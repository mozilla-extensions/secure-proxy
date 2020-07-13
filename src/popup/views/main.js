import {View} from "../view.js";
import {animateGlobe, animateRings} from "../animations.js";

// Main view.
class ViewMain extends View {
  get stateInfo() {
    return {
      name: "enabled",
      content: escapedTemplate`
        <h2>${this.getTranslation("headingOn")}</h2>
        <h3>${this.getTranslation("subheadingOn")}</h3>
      `
    };
  }

  syncPostShow() {
    animateGlobe([15, 30]);
    animateRings(true);
  }

  async stateButtonHandler() {
    // Send a message to the background script to notify the proxyEnabled has chanded.
    // This prevents the background script from having to block on reading from the storage per request.
    await View.sendMessage("setEnabledState", {
      enabledState: false,
      reason: "stateButton",
    });
  }
}

const view = new ViewMain();
export default view;
