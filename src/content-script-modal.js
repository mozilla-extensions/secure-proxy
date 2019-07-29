class ContentScriptBanner {
  constructor() {
    this.insertBanner();
  }

  // Helper method to receive translated string.
  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }


  insertBanner() {
console.log("banner");
    let modal = document.createElement("div");
    let template = escapedTemplate`
      <h1>${this.getTranslation("injectedModalHeading")}</h1>
      <p>${this.getTranslation("injectedModalText")}</p>
      <button>${this.getTranslation("injectedModalDismissButton")}</button>
      <button>${this.getTranslation("injectedModalAcceptButton")}</button>
    `;
    template.renderTo(modal);
console.log("banner", modal);
    document.body.appendChild(modal);
console.log("banner", modal);
  }
}

new ContentScriptBanner();
