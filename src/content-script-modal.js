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

  async insertBanner() {
    this.modal = document.createElement("section");
    this.modal.id = "injectedModal";
    let domainName = window.location.hostname.replace(/^www./, "");
    let template = escapedTemplate`
      <div class="content">
        <header>
          <button id="close"></button>
        </header>
        <h1>${this.getTranslation("injectedModalHeading")}</h1>
        <p>To protect your connection to <strong>${domainName}</strong>, Private Network disabled parts of this page. Turning off Private Network will enable all functionality, but makes your connection to this site less secure.</p>
        <footer>
          <button id="notNow">${this.getTranslation("injectedModalDismissButton")}</button>
          <button>${this.getTranslation("injectedModalAcceptButton")}</button>
        </footer>
      </div>
    `;
    this.modal.addEventListener("click", this);
    template.renderTo(this.modal);
    document.body.appendChild(this.modal);
  }

  close() {
    document.body.removeChild(this.modal);
    this.modal = null;
  }

  handleEvent(e) {
    console.log("b", e);
    if (e.target.id === "close" || e.target.id === "notNow") {
      this.close();
    } else {
      browser.runtime.sendMessage({message: "exemptSite", origin: window.location.origin});
    }
  }
}

new ContentScriptBanner();
