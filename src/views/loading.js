import {View} from '../view.js'

// This is the first view to be shown.
class ViewLoading extends View {
  show() {
    console.log("ViewLoading.show");

    const content = document.getElementById("content");

    const loading = document.createElement("p");
    loading.textContent = this.getTranslation("loading");
    content.appendChild(loading);
  }
}

const view = new ViewLoading();
const name = "loading";

View.registerView(view, name);
export default name;
