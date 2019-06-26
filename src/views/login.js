import {View} from '../view.js'

class ViewLogin extends View {
  show() {
    console.log("ViewLogin.show");

    const content = document.getElementById("content");
    content.textContent = this.getTranslation("notLoggedIn");

    const authButton = document.createElement("button");
    authButton.textContent = this.getTranslation("activateButton");
    authButton.addEventListener("click", () => {
      View.sendMessage("authenticate");
    });

    content.appendChild(authButton);
  }
}

const view = new ViewLogin();
const name = "login";

View.registerView(view, name);
export default name;
