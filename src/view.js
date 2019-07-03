let views = new Map();

let currentView = null;

// This is the generic a view. Any other view should inherit from this class.
export class View {

  // Static method to set the current view. The previous one will be dismissed.
  static setView(name, data = null) {
    let content = document.getElementById("content");
    let view = views.get(name);
    if (!(view instanceof View)) {
      console.error("Invalid view name: " + name);
      return;
    }

    if (currentView) {
      content.removeEventListener("click", currentView);
      content.removeEventListener("submit", currentView);
      currentView.dismiss();
    }

    currentView = view;
    // Clear the display always.
    content.innerHTML = "";

    console.log(`Show: ${name}`);
    let template = currentView.show(data);
    if (template && template.escaped) {
      content.addEventListener("click", currentView);
      content.addEventListener("submit", currentView);
      content.innerHTML = template;
      currentView.postShow(data, content);
    }
  }

  // This method stores a view in the view map.
  static registerView(view, name) {
    console.log("Register view: " + name);
    views.set(name, view);
  }

  constructor() {
    let els = [...document.querySelectorAll("[data-l10n]")];
    for (let el of els) {
      el.textContent = this.getTranslation(el.getAttribute("data-l10n"));
    }
  }

  // To be overwritten if needed.
  dismiss() {}

  // This must be overwritten by views.
  show() {
    console.error("Each view should implement show() method!");
  }

  // To be overwritten if needed.
  postShow() {}

  // Helper method to receive translated string.
  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }

  // Helper method to send messages to the background script.
  static async sendMessage(type, data = {}) {
    return browser.runtime.sendMessage({
      type,
      data,
    });
  }
}
