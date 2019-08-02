/* global exportFunction */

const ContentScript = {
  proxyEnabled: false,
  exempted: false,
  bannerShowing: false,

  async init() {
    this.createPort();
    this.overwriteProperties();
  },

  originIsExemptable() {
    // Trim trailing period from hostname as is a separate origin
    return [
      "hangouts.google.com",
      "meet.google.com",
      "www.messenger.com",
      "appear.in",
      "jitsi.org",
      "talky.io",
      "webex.com",
    ].includes(window.location.hostname.replace(/\.?$/, ""));
  },

  createPort() {
    this.port = browser.runtime.connect({ name: "port-from-cs" });
    this.port.onMessage.addListener(message => {
      if (message.type === "proxyState") {
        this.exempted = message.exempted;
        this.proxyEnabled = message.enabled;

        // Check if we are a site that we show a banner for
        if (this.proxyEnabled &&
            this.originIsExemptable() &&
            this.exempted === undefined) {
          this.bannerShowing = true;
          new ContentScriptBanner(false);
        }
        return;
      }

      console.error("Invalid message: " + message);
    });
  },

  overwriteProperties() {
    const overwrittenProperties = new Set([
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getSupportedConstraints", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "enumerateDevices", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getUserMedia", type: "method" },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getDisplayMedia", type: "method" },
      { originalMethod: null, parentObject: window, methodName: "RTCPeerConnection", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCIceCandidate", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCPeerConnectionStatic", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCSessionDescription", type: "object" },
    ]);

    overwrittenProperties.forEach(data => {
      if (!(data.methodName in data.parentObject.wrappedJSObject)) {
        return;
      }

      data.originalMethod = data.parentObject.wrappedJSObject[data.methodName];
      Object.defineProperty(data.parentObject.wrappedJSObject, data.methodName, {
       get: exportFunction(() => {
        if (this.proxyEnabled && this.exempted !== "exemptTab") {
          if (this.exempted === undefined && this.bannerShowing === false) {
            this.bannerShowing = true;
            new ContentScriptBanner(true);
          }
          if (data.type === "method") {
            return exportFunction(() => {
              return window.wrappedJSObject.Promise.reject(new window.wrappedJSObject.Error("SecurityError"));
            }, window);
          }

          if (data.type === "object") {
            throw new window.wrappedJSObject.Error("SecurityError");
          }
        }

        return data.originalMethod;
       }, window),

       set: exportFunction(function() {}, window),
      });
    });
  },

  async exempt(type) {
    return this.port.postMessage({ type });
  }
};

ContentScript.init();

class ContentScriptBanner {
  // If the banner is contextual refresh the page on approve
  constructor(contextual) {
    this.contextual = contextual;
    this.insertBannerOnDocumentLoad();
  }

  insertBannerOnDocumentLoad() {
    const run = () => {
      this.insertBanner();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      run();
    }
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
          <button id="exempt">${this.getTranslation("injectedModalAcceptButton")}</button>
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

  async handleSiteEvent(e) {
    let type;
    if (e.target.id === "close" || e.target.id === "notNow") {
      type = "ignoreTab";
    } else if (e.target.id === "exempt") {
      type = "exemptTab";
    } else {
      return;
    }
    this.close();
    await ContentScript.exempt(type);
    if (this.contextual && type === "exemptTab") {
      window.location.reload();
    }
  }

  handleEvent(e) {
    this.handleSiteEvent(e);
  }
}
