let views = new Map();

let currentView = null;
let currentPort = null;

// This is the generic a view. Any other view should inherit from this class.
export class View {
  // Static method to set the current view. The previous one will be dismissed.
  static async setView(name, data = null) {
    if (!views.has(name)) {
      let view = await import(`./views/${name}.js`);
      this.registerView(view.default, name);
    }
    let content = document.getElementById("content");
    let footer = document.querySelector("footer");
    let view = views.get(name);
    if (!(view instanceof View)) {
      console.error("Invalid view name: " + name);
      return;
    }

    if (currentView) {
      footer.removeEventListener("click", currentView);
      content.removeEventListener("click", currentView);
      content.removeEventListener("submit", currentView);
      currentView.dismiss();
    }

    currentView = view;
    // Clear the display always.
    content.innerHTML = "";
    footer.toggleAttribute("hidden", true);

    let introHeading = document.getElementById("introHeading");
    introHeading.textContent = currentView.getTranslation(currentView.headingText());

    console.log(`Show: ${name}`);
    let template = currentView.show(data);
    if (template && template instanceof Template) {
      footer.addEventListener("click", currentView);
      content.addEventListener("click", currentView);
      content.addEventListener("submit", currentView);
      template.renderTo(content);
      currentView.postShow(data, content);
    }
    let footerTemplate = currentView.footer(data);
    if (footerTemplate && footerTemplate instanceof Template) {
      footerTemplate.renderTo(footer);
      footer.toggleAttribute("hidden", false);
    }
    document.body.classList.remove("loading");
  }

  static showToggleButton(state) {
    let toggleRow = document.getElementById("toggleRow");
    toggleRow.removeAttribute("hidden");

    let toggleButton = document.getElementById("toggleButton");
    toggleButton.setAttribute("aria-label", currentView.getTranslation("popupToggleButtonLabel"));
    toggleButton.checked = state;
  }

  static hideToggleButton() {
    let toggleRow = document.getElementById("toggleRow");
    toggleRow.setAttribute("hidden", "hidden");
  }

  static onToggleButtonClicked(e) {
    currentView.toggleButtonClicked(e);
  }

  static showBack(shouldShow) {
    let backElement = document.getElementById("backButton");
    backElement.toggleAttribute("hidden", !shouldShow);
  }

  static showSettings(shouldShow) {
    let settingsElement = document.getElementById("settingsButton");
    settingsElement.setAttribute("aria-label", currentView.getTranslation("popupSettingsButtonLabel"));
    settingsElement.toggleAttribute("hidden", !shouldShow);
  }

  static setState(state, stateButtonSettings = {}) {
    let stateElement = document.getElementById("state");
    stateElement.setAttribute("data-state", state);
    let stateButtonElement = document.getElementById("stateButton");
    stateButtonElement.textContent = stateButtonSettings.text || "";
    if (stateButtonSettings.label) {
      stateButtonElement.setAttribute("aria-label", stateButtonSettings.label);
    } else {
      stateButtonElement.removeAttribute("aria-label");
    }
  }

  // To be overwritten with a string for the header
  headingText() { return "introHeading"; }

  // To be overwritten to return an escaped template if the panel should have one
  state() { return null; }

  // Handler for state button presses on the view override if needed
  stateButtonHandler() { return null; }

  static onStateButton() {
    currentView.stateButtonHandler();
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

  // Override if you want to handle events
  handleEvent() {}

  // To be overwritten if needed.
  dismiss() {}

  // This must be overwritten by views.
  show() {
    console.error("Each view should implement show() method!");
  }

  // To be overwritten if needed.
  footer() {}

  // To be overwritten if needed.
  postShow() {}

  // To be overwritten if needed.
  toggleButtonClicked(e) {}

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

  static setPort(port) {
    currentPort = port;
  }
}
