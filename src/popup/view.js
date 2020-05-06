let views = new Map();

let currentView = null;
let currentPort = null;

// This is the generic a view. Any other view should inherit from this class.
export class View {
  // Static method to set the current view. The previous one will be dismissed.
  static async setView(name, data = null) {
    // eslint-disable-next-line verify-await/check
    if (!views.has(name)) {
      let view = await import(`./views/${name}.js`);
      this.syncRegisterView(view.default, name);
    }
    let content = document.getElementById("content");
    let stateElement = document.getElementById("state");
    // eslint-disable-next-line verify-await/check
    let view = views.get(name);
    if (!(view instanceof View)) {
      console.error("Invalid view name: " + name);
      return;
    }

    if (currentView) {
      content.removeEventListener("click", currentView);
      content.removeEventListener("submit", currentView);
    }

    currentView = view;
    // Clear the display always.
    content.innerHTML = "";

    let introHeading = document.getElementById("introHeading");
    introHeading.addEventListener("click", currentView);
    let introHeadingText = document.getElementById("introHeadingText");
    introHeadingText.textContent = currentView.getTranslation("introHeading");
    let introHeadingLite = document.getElementById("introHeadingLite");
    introHeadingLite.textContent = currentView.getTranslation("introHeadingLite");

    // eslint-disable-next-line verify-await/check
    document.body.classList.remove("loading");

    let info = currentView.stateInfo;
    if (info) {
      stateElement.setAttribute("data-state", info.name);
      stateElement.removeAttribute("hidden");

      let template = info.content;
      if (template && template instanceof Template) {
        let stateContent = document.getElementById("stateContent");
        template.syncRenderTo(stateContent);
      }
    } else {
      stateElement.toggleAttribute("hidden", true);
    }

    let template = currentView.syncShow(data);
    if (template && template instanceof Template) {
      content.setAttribute("data-name", name);
      content.toggleAttribute("hidden", false);

      content.addEventListener("click", currentView);
      content.addEventListener("submit", currentView);
      content.addEventListener("dragstart", currentView);
      template.syncRenderTo(content);
    } else {
      content.toggleAttribute("hidden", true);
    }

    currentView.syncPostShow(data, content);
  }

  static showBack(shouldShow) {
    let backElement = document.getElementById("backButton");
    backElement.setAttribute("aria-label", currentView.getTranslation("popupBackButtonLabel"));
    backElement.toggleAttribute("hidden", !shouldShow);
  }

  static showSettings(shouldShow) {
    let settingsElement = document.getElementById("settingsButton");
    settingsElement.setAttribute("aria-label", currentView.getTranslation("popupSettingsButtonLabel"));
    settingsElement.toggleAttribute("hidden", !shouldShow);
  }

  static setError(error) {
    let errorElement = document.getElementById("proxyError");
    errorElement.removeAttribute("hidden");
    errorElement.textContent = currentView.getTranslation(error);
  }

  static hideError() {
    let errorElement = document.getElementById("proxyError");
    errorElement.toggleAttribute("hidden", true);
  }

  // Closes the popup
  static close() {
    // eslint-disable-next-line verify-await/check
    close();
  }

  // To be overwritten to return an escaped template if the panel should have one
  state() { return null; }

  // Handler for state button presses on the view override if needed
  stateButtonHandler() { return null; }

  static onStateButton() {
    // eslint-disable-next-line verify-await/check
    currentView.stateButtonHandler();
  }

  // This method stores a view in the view map.
  static syncRegisterView(view, name) {
    // eslint-disable-next-line verify-await/check
    views.set(name, view);
  }

  constructor() {
    let els = [...document.querySelectorAll("[data-l10n]")];
    for (let el of els) {
      el.textContent = this.getTranslation(el.getAttribute("data-l10n"));
    }
  }

  handleEvent(e) {
    if (e instanceof DragEvent) {
      e.preventDefault();
      return;
    }

    // eslint-disable-next-line verify-await/check
    this.handleClickEvent(e);
  }

  // Override if you want to handle events
  handleClickEvent() {}

  // Override to display content from an escaped template.
  syncShow() { }

  // To be overwritten if needed.
  syncPostShow() {}

  // Helper method to receive translated string.
  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }

  // Helper method to send messages to the background script.
  static async sendMessage(type, data = {}) {
    if (!currentPort) {
      throw new Error("Invalid port!");
    }

    return currentPort.postMessage({
      type,
      data,
    });
  }

  static syncSetPort(port) {
    currentPort = port;
  }
}
