import {View} from "../view.js";

class ViewDeviceLimit extends View {
  syncShow(data) {
    return escapedTemplate`
      <div class="content-icon login-icon"></div>
      <p>
        ${this.getTranslation("viewDeviceLimit")}
        <a href="#" id="link">${this.getTranslation("viewDeviceLimitLink")}</a>
      </p>
      <p>
        ${this.getTranslation("viewDeviceLimit2")}
      </p>
      <button id="tryNowButton" class="primary">
        ${this.getTranslation("viewDeviceLimitButton")}
      </button>
      `;
  }

  handleClickEvent(e) {
    if (e.target.id === "link") {
      View.sendMessage("openDeviceLimitLink");
      View.close();
    }

    if (e.target.id === "tryNowButton") {
      View.sendMessage("setEnabledState", {
        enabledState: true,
        reason: "stateButton",
      });
    }
  }
}

const view = new ViewDeviceLimit();
export default view;
