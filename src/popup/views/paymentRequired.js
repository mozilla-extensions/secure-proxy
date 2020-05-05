import {View} from "../view.js";

// This is the first view to be shown.
class ViewPaymentRequired extends View {
  syncShow(data) {
    return escapedTemplate`
      <p>PAYMENT REQUIRED</p>
    `;
  }
}

const view = new ViewPaymentRequired();
export default view;
