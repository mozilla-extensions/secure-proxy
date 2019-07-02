import {View} from '../view.js'

// This is the first view to be shown.
class ViewError extends View {
  show(data) {
    console.log("ViewError.show");

    const content = document.getElementById("content");
    content.textContent = "";

    const error = document.createElement("p");
    error.textContent = this.getTranslation(data);
    content.appendChild(error);
  }
}

const view = new ViewError();
const name = "error";

View.registerView(view, name);
export default name;
