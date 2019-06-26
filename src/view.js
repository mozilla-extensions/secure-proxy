let views = new Map();

let currentView = null;

// This is the generic a view. Any other view should inherit from this class.
export class View {
  static setView(name, data = null) {
    let view = views.get(name);
    if (!(view instanceof View)) {
      console.error("Invalid view name: " + name);
      return;
    }

    if (currentView) {
      currentView.dismiss();
    }

    currentView = view;

    currentView.show(data);
  }

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

  dismiss() {}

  show() {
    console.error("Each view should implement show() method!");
  }

  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }

  static async sendMessage(type, data = {}) {
    return browser.runtime.sendMessage({
      type,
      data,
    });
  }
}
