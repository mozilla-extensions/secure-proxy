import {View} from "../view.js";
import {animateGlobe} from "../animations.js";

class ViewConnecting extends View {
  constructor() {
    super();

    this.animating = false;
  }

  get stateInfo() {
    return {
      name: "connecting",
      content: escapedTemplate`
        <h2>${this.getTranslation("headingConnecting")}</h2>
        <h3>${this.getTranslation("subheadingConnecting")}</h3>
      `
    };
  }

  syncPostShow() {
    // There may be multiple "connecting" events coming from
    // the background, so we need to debounce the animation
    // to avoid starting it several times.
    if (!this.animating) {
      animateGlobe([0, 15]);
      this.animating = true;
      setTimeout(() => this.animating = false, 500);
    }
  }
}

const view = new ViewConnecting();
export default view;
