import {View} from "../view.js";

// This is the first view to be shown.
class ViewLoading extends View {
  syncShow() {
    return escapedTemplate`
    <div class="content-icon loading-icon"></div>
    <h2>${this.getTranslation("viewLoading")}</h2>
    `;
  }
}

const view = new ViewLoading();
export default view;
