import {View} from "../view.js";

class ViewPaymentRequired extends View {
  syncShow(data) {
    return escapedTemplate`
      <div class="content-icon login-icon"></div>
      <p>${this.getTranslation("viewPaymentRequired")}</p>
      <button class="primary" id="paymentButton">Continue</button>
      `;
  }

  handleClickEvent(e) {
    if (e.target.id === "paymentButton") {
      View.sendMessage("openSubscriptionLink");
      View.close();
    }
  }
}

const view = new ViewPaymentRequired();
export default view;
