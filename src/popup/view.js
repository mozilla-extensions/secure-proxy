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
    let footer = document.querySelector("footer");
    // eslint-disable-next-line verify-await/check
    let view = views.get(name);
    if (!(view instanceof View)) {
      console.error("Invalid view name: " + name);
      return;
    }

    if (currentView) {
      footer.removeEventListener("click", currentView);
      content.removeEventListener("click", currentView);
      content.removeEventListener("submit", currentView);
    }

    currentView = view;
    // Clear the display always.
    content.innerHTML = "";
    footer.toggleAttribute("hidden", true);

    let introHeading = document.getElementById("introHeading");
    introHeading.addEventListener("click", currentView);
    let introHeadingText = document.getElementById("introHeadingText");
    introHeadingText.textContent = currentView.getTranslation("introHeading");
    let introHeadingLite = document.getElementById("introHeadingLite");
    introHeadingLite.textContent = currentView.getTranslation("introHeadingLite");

    let template = currentView.syncShow(data);
    if (template && template instanceof Template) {
      footer.addEventListener("click", currentView);
      footer.addEventListener("dragstart", currentView);

      content.addEventListener("click", currentView);
      content.addEventListener("submit", currentView);
      content.addEventListener("dragstart", currentView);
      template.syncRenderTo(content);
      currentView.syncPostShow(data, content);
    }

    let footerTemplate = currentView.syncFooter(data);
    if (footerTemplate && footerTemplate instanceof Template) {
      footerTemplate.syncRenderTo(footer);
      footer.toggleAttribute("hidden", false);
    }

    // eslint-disable-next-line verify-await/check
    document.body.classList.remove("loading");
  }

  static showToggleButton(data, state) {
    let toggleRow = document.getElementById("toggleRow");
    toggleRow.removeAttribute("hidden");

    // eslint-disable-next-line verify-await/check
    toggleRow.classList.add("toggleRowBeta");

    let toggleButton = document.getElementById("toggleButton");
    toggleButton.setAttribute("aria-label", currentView.getTranslation("popupToggleButtonLabel"));
    toggleButton.checked = state;
  }

  static hideToggleButton() {
    let toggleRow = document.getElementById("toggleRow");
    toggleRow.toggleAttribute("hidden", true);
  }

  static onToggleButtonClicked(e) {
    currentView.toggleButtonClicked(e);
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

  // This must be overwritten by views.
  syncShow() {
    console.error("Each view should implement syncShow() method!");
  }

  // To be overwritten if needed.
  syncFooter(data) {
    return null;
  }

  // To be overwritten if needed.
  syncPostShow() {}

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

  static syncSetPort(port) {
    currentPort = port;
  }
}
