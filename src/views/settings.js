import {View} from '../view.js'
import {escapedTemplate} from '../template.js'

// Settings view.
class ViewSettings extends View {
  show(data) {
    let loggedIn = this.getTranslation("loggedIn", data.userInfo.email);
    return escapedTemplate`
      <ul>
        <li>${loggedIn}</li>
      </ul>
    `;
  }
}

const view = new ViewSettings();
const name = "settings";

View.registerView(view, name);
export default name;
