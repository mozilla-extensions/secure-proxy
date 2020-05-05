import {View} from "../view.js";

class ViewOtherInUse extends View {
  syncShow() {
    return escapedTemplate`
    <p>
      ${this.getTranslation("viewOtherInUse")}
    </p>`;
  }
}

const view = new ViewOtherInUse();
export default view;
