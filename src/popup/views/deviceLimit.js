import {View} from "../view.js";

class ViewDeviceLimit extends View {
  syncShow(data) {
    return escapedTemplate`
      <div class="content-icon login-icon"></div>
      <p>
        ${this.getTranslation("viewDeviceLimit")}
        <a href="#" id="link">${this.getTranslation("viewDeviceLimitLink")}</a>
      </p>
      `;
  }

  handleClickEvent(e) {
    if (e.target.id === "link") {
      View.sendMessage("openDeviceLimitLink");
      View.close();
    }
  }
}

const view = new ViewDeviceLimit();
export default view;
