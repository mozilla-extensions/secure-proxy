/* global exportFunction */
async function prettyHostname(hostname) {
  // Trim trailing period from hostname as is a separate origin.
  // eslint-disable-next-line verify-await/check
  hostname = hostname.replace(/\.?$/, "");
  return browser.runtime.sendMessage({ type: "getBaseDomainFromHost", hostname });
}

const ContentScript = {
  proxyEnabled: false,
  exempted: false,
  bannerShowing: false,

  syncInit() {
    this.syncCreatePort();
    this.syncOverwriteProperties();
  },

  async originIsExemptable(hostname) {
    return [
      "hangouts.google.com",
      "meet.google.com",
      "messenger.com",
      "appear.in",
      "jitsi.org",
      "talky.io",
      "webex.com",
    ].includes((await prettyHostname(hostname)));
  },

  syncCreatePort() {
    // eslint-disable-next-line verify-await/check
    this.port = browser.runtime.connect({ name: "port-from-cs" });
    this.port.onMessage.addListener(async message => {
      if (message.type === "proxyState") {
        this.exempted = message.exempted;
        this.proxyEnabled = message.enabled;

        // Check if we are a site that we show a banner for
        if (this.proxyEnabled &&
            this.bannerShowing === false &&
            await this.originIsExemptable(window.location.hostname) &&
            this.exempted === undefined) {
          this.bannerShowing = true;
          new ContentScriptBanner();
        }
        return;
      }

      console.error("Invalid message: " + message);
    });
  },

  syncPotentiallyShowContextBanner() {
    if (this.exempted === undefined && this.bannerShowing === false) {
      this.bannerShowing = true;
      new ContentScriptBanner();
    }
  },

  syncShouldOverload() {
    return this.proxyEnabled && this.exempted !== "exemptTab";
  },

  syncOverwriteProperties() {
    const overwrittenProperties = new Set([
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getSupportedConstraints", type: "method", potentiallyShowContextBanner: true },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "enumerateDevices", type: "method", potentiallyShowContextBanner: false },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getUserMedia", type: "method", potentiallyShowContextBanner: true },
      { originalMethod: null, parentObject: window.navigator.mediaDevices, methodName: "getDisplayMedia", type: "method", potentiallyShowContextBanner: true },
      { originalMethod: null, parentObject: window.navigator, methodName: "mozGetUserMedia", type: "method", potentiallyShowContextBanner: true },
      { originalMethod: null, parentObject: window.navigator, methodName: "mozGetUserMediaDevices", type: "method", potentiallyShowContextBanner: true },
      { originalMethod: null, parentObject: window, methodName: "RTCPeerConnection", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCIceCandidate", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCPeerConnectionStatic", type: "object" },
      { originalMethod: null, parentObject: window, methodName: "RTCSessionDescription", type: "object" },
    ]);

    // eslint-disable-next-line verify-await/check
    overwrittenProperties.forEach(data => {
      if (!(data.methodName in data.parentObject.wrappedJSObject)) {
        return;
      }

      function overrideProp(object, property, original) {
        Object.defineProperty(object, property, {
         get: exportFunction(() => {
          if (ContentScript.syncShouldOverload()) {
            if (data.type === "method") {
              return exportFunction(() => {
                if (data.potentiallyShowContextBanner) {
                  ContentScript.syncPotentiallyShowContextBanner();
                }
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
           if (ContentScript.syncShouldOverload()) {
             ContentScript.syncPotentiallyShowContextBanner();
           }
         }, window),
        });
      }
      data.originalMethod = data.parentObject.wrappedJSObject[data.methodName];
      overrideProp(data.parentObject.wrappedJSObject, data.methodName, data.originalMethod);
    });
  },

  async exempt(status) {
    return browser.runtime.sendMessage({ type: "exempt", status });
  }
};

ContentScript.syncInit();

class ContentScriptBanner {
  constructor() {
    // eslint-disable-next-line verify-await/check
    this.insertBannerOnDocumentLoad();
  }

  async insertBannerOnDocumentLoad() {
    const run = async _ => {
      await this.insertBanner();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
    } else {
      await run();
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
        <p>To protect your connection to <strong>${domainName}</strong>, Private Network disabled parts of this page. Turning off Private Network will enable all functionality, but makes your connection to sites in this tab less secure.</p>
        <footer>
          <button id="notNow">${this.getTranslation("injectedModalDismissButton")}</button>
          <button id="exempt">${this.getTranslation("injectedModalAcceptButton")}</button>
        </footer>
      </div>
    `;
    this.modal.addEventListener("click", this);
    template.syncRenderTo(this.modal);
    document.body.appendChild(this.modal);
  }

  syncClose() {
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
    this.syncClose();
    await ContentScript.exempt(type);
    if (type === "exemptTab") {
      // eslint-disable-next-line verify-await/check
      window.location.reload();
    }
  }

  async handleEvent(e) {
    await this.handleSiteEvent(e);
  }
}
