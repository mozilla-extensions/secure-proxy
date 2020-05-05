import {View} from "../view.js";

class ViewCaptive extends View {
  syncShow() {
    return escapedTemplate`
    <p>
      ${this.getTranslation("viewOffline")}
    </p>`;
  }
}

const view = new ViewCaptive();
export default view;
