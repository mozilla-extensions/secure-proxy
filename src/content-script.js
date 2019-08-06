/* global exportFunction */
async function prettyHostname(hostname) {
  // Trim trailing period from hostname as is a separate origin.
  hostname = hostname.replace(/\.?$/, "");
  return await browser.runtime.sendMessage({ type: "getBaseDomainFromHost", hostname });
}

const ContentScript = {
  proxyEnabled: false,
  exempted: false,
  bannerShowing: false,

  async init() {
    this.createPort();
    this.overwriteProperties();
  },

  async originIsExemptable() {
    return [
      "hangouts.google.com",
      "meet.google.com",
      "messenger.com",
      "appear.in",
      "jitsi.org",
      "talky.io",
      "webex.com",
    ].includes((await prettyHostname(window.location.hostname)));
  },

  createPort() {
    this.port = browser.runtime.connect({ name: "port-from-cs" });
    this.port.onMessage.addListener(async message => {
      if (message.type === "proxyState") {
        this.exempted = message.exempted;
        this.proxyEnabled = message.enabled;

        // Check if we are a site that we show a banner for
        if (this.proxyEnabled &&
            await this.originIsExemptable() &&
            this.exempted === undefined) {
          this.bannerShowing = true;
          new ContentScriptBanner(false);
        }
        return;
      }

      console.error("Invalid message: " + message);
    });
  },

  potentiallyShowContextBanner() {
    if (this.exempted === undefined && this.bannerShowing === false) {
      this.bannerShowing = true;
      new ContentScriptBanner(true);
    }
  },

  shouldOverload() {
    return this.proxyEnabled && this.exempted !== "exemptTab";
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

      function overrideProp(object, property, original) {
        Object.defineProperty(object, property, {
         get: exportFunction(() => {
          if (ContentScript.shouldOverload()) {
            ContentScript.potentiallyShowContextBanner();
            if (data.type === "method") {
              return exportFunction(() => {
                return window.wrappedJSObject.Promise.reject(new window.wrappedJSObject.Error("SecurityError"));
              }, window);
            }

            if (data.type === "object") {
              throw new window.wrappedJSObject.Error("SecurityError");
            }
          }

          return original;
         }, window),

         set: exportFunction(() => {
           if (ContentScript.shouldOverload()) {
             ContentScript.potentiallyShowContextBanner();
           }
         }, window),
        });
      }

      data.originalMethod = data.parentObject.wrappedJSObject[data.methodName];
      overrideProp(data.parentObject.wrappedJSObject, data.methodName, data.originalMethod);
      if (data.type === "object") {
        overrideProp(data.parentObject.wrappedJSObject[data.methodName], "prototype", data.originalMethod.prototype);
      }
    });
  },

  async exempt(status) {
    return browser.runtime.sendMessage({ type: "exempt", status });
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
    let domainName = await prettyHostname(window.location.hostname);
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
