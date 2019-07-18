import {Template} from './template.js';
let views = new Map();

let currentView = null;
let currentPort = null;

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
    if (template && template instanceof Template) {
      content.addEventListener("click", currentView);
      content.addEventListener("submit", currentView);
      content.innerHTML = template;
      currentView.postShow(data, content);
    }
  }

  static showToggleButton(state) {
    let toggleRow = document.getElementById("toggleRow");
    toggleRow.removeAttribute("hidden");

    let toggleButton = document.getElementById("toggleButton");
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

  static showSurvey(surveyName) {
    let survey = document.getElementById("survey");

    if (!surveyName) {
      survey.setAttribute("hidden", "hidden");
      return;
    }

    survey.removeAttribute("hidden");
  }

  static showSettings(shouldShow) {
    let settingsElement = document.getElementById("settingsButton");
    settingsElement.toggleAttribute("hidden", !shouldShow);
  }

  static setState(state, stateButtonText) {
    let stateElement = document.getElementById("state");
    stateElement.setAttribute("data-state", state);
    let stateButtonElement = document.getElementById("stateButton");
    stateButtonElement.textContent = stateButtonText || "";
  }

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
