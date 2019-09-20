import {View} from "../view.js";

class ViewBetaDecision extends View {
  syncShow() {
    View.setState("disabled", {text: this.getTranslation("heroProxyOff")});
    View.hideToggleButton();

    return escapedTemplate`
    <p>
      ${this.getTranslation("viewBetaDecision")}
    </p>
    <p>
      <a href="#" id="betaDecisionAlreadyMade">${this.getTranslation("viewBetaDecisionAlreadyMade")}</a>
    </p>
    <button id="betaDecision" class="primary">
      ${this.getTranslation("viewBetaDecisionButton")}
    </button>`;
  }

  handleClickEvent(e) {
    // eslint-disable-next-line verify-await/check
    if (["betaDecision", "betaDecisionAlreadyMade"].includes(e.target.id)) {
      // eslint-disable-next-line verify-await/check
      View.sendMessage(e.target.id);
      View.close();
    }
  }

  syncFooter(data) {
    // No footer here.
  }
}

const view = new ViewBetaDecision();
export default view;
