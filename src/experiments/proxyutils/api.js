/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* globals ExtensionAPI, ExtensionCommon, Services, ExtensionPreferencesManager, ExtensionError, Preferences */

"use strict";

ChromeUtils.defineModuleGetter(this, "Services",
                               "resource://gre/modules/Services.jsm");
ChromeUtils.defineModuleGetter(this, "Preferences",
                               "resource://gre/modules/Preferences.jsm");
ChromeUtils.defineModuleGetter(this, "UIState",
                               "resource://services-sync/UIState.jsm");
ChromeUtils.defineModuleGetter(this, "ObjectUtils",
                               "resource://gre/modules/ObjectUtils.jsm");
ChromeUtils.defineModuleGetter(this, "setTimeout",
                               "resource://gre/modules/Timer.jsm");
ChromeUtils.defineModuleGetter(this, "ExtensionPreferencesManager",
                               "resource://gre/modules/ExtensionPreferencesManager.jsm");
ChromeUtils.defineModuleGetter(this, "XPCOMUtils",
                               "resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.defineModuleGetter(this, "AppConstants",
                               "resource://gre/modules/AppConstants.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "gNetworkLinkService",
                                   "@mozilla.org/network/network-link-service;1",
                                   "nsINetworkLinkService");

// eslint-disable-next-line mozilla/reject-importGlobalProperties
Cu.importGlobalProperties(["URL"]);

// Cribbed from browser.js with some changes to allow for our strings
let ConfirmationHint = {
  /**
   * Shows a transient, non-interactive confirmation hint anchored to an
   * element, usually used in response to a user action to reaffirm that it was
   * successful and potentially provide extra context. Examples for such hints:
   * - "Saved to Library!" after bookmarking a page
   * - "Sent!" after sending a tab to another device
   * - "Queued (offline)" when attempting to send a tab to another device
   *   while offline
   *
   * @param  anchor (DOM node, required)
   *         The anchor for the panel.
   * @param  messageContent (string, required)
   *         The string that we will display.
   * @param  options (object, optional)
   *         An object with the following optional properties:
   *         - event (DOM event): The event that triggered the feedback.
   *         - hideArrow (boolean): Optionally hide the arrow.
   *         - showDescription (boolean): show description text (confirmationHint.<messageId>.description)
   *
   */
  syncShow(selector, messageContent, options = {}) {
    if (AppConstants.platform === "android") {
      return;
    }

    const anchor = Services.wm.getMostRecentWindow(null).document.querySelector(selector);
    this._message.textContent = messageContent;

    this._description.hidden = true;
    // eslint-disable-next-line verify-await/check
    this._panel.classList.remove("with-description");

    if (options.hideArrow) {
      this._panel.setAttribute("hidearrow", "true");
    }

    // Bug https://github.com/mozilla/secure-proxy/issues/252
    // eslint-disable-next-line verify-await/check
    this.setCSS("#0060ED", "#fff");
    // eslint-disable-next-line verify-await/check
    this.setIcon();
    if (options.isWarning) {
      // eslint-disable-next-line verify-await/check
      this.setCSS("#fff36e", "#0c0c0d");
      // eslint-disable-next-line verify-await/check
      this.setIcon("chrome://global/skin/icons/warning.svg");
    }

    const DURATION = 8500;
    this._panel.addEventListener("popupshown", () => {
      this._animationBox.setAttribute("animate", "true");

      setTimeout(() => {
        this._panel.hidePopup(true);
        // eslint-disable-next-line verify-await/check
        this.setCSS();
        // eslint-disable-next-line verify-await/check
        this.setIcon();
      }, DURATION + 120);
    }, {once: true});

    this._panel.addEventListener("popuphidden", () => {
      this._panel.removeAttribute("hidearrow");
      this._animationBox.removeAttribute("animate");
    }, {once: true});

    this._panel.hidden = false;
    this._panel.openPopup(anchor, {
      position: "bottomcenter topleft",
      triggerEvent: options.event,
    });
  },

  setCSS(backgroundColor = "", textColor = "") {
    this._panel.style.setProperty("--arrowpanel-background", backgroundColor);
    this._panel.style.setProperty("--arrowpanel-border-color", backgroundColor);
    this._panel.style.setProperty("--arrowpanel-color", textColor);
  },

  setIcon(iconUrl = "") {
    let checkmarkImage = this._panel.querySelector("#confirmation-hint-checkmark-image");
    let properties = {
      background: `url("${iconUrl}") 0 0 / contain`,
      fill: "black",
      "-moz-context-properties": "fill",
      "animation-name": "none",
    };
    for (let property in properties) {
      if (iconUrl) {
        checkmarkImage.style.setProperty(property, properties[property]);
      } else {
        checkmarkImage.style.removeProperty(property);
      }
    }
  },

  get _document() {
    return Services.wm.getMostRecentWindow(null).document;
  },

  get _panel() {
    this._ensurePanel();
    return this.__panel;
  },

  get _animationBox() {
    this._ensurePanel();
    delete this._animationBox;
    return this._animationBox = this._document.getElementById("confirmation-hint-checkmark-animation-container");
  },

  get _message() {
    this._ensurePanel();
    delete this._message;
    return this._message = this._document.getElementById("confirmation-hint-message");
  },

  get _description() {
    this._ensurePanel();
    delete this._description;
    return this._description = this._document.getElementById("confirmation-hint-description");
  },

  _ensurePanel() {
    this.__panel = this._document.getElementById("confirmation-hint");
    if (!this.__panel) {
      let wrapper = this._document.getElementById("confirmation-hint-wrapper");
      wrapper.replaceWith(wrapper.content);
      this.__panel = this._document.getElementById("confirmation-hint");
    }
  }
};

function getStringPrefValue(pref) {
  try {
    return Services.prefs.getStringPref(pref);
  } catch (e) {
    // No pref value set
    return null;
  }
}

ExtensionPreferencesManager.addSetting("proxyutils.settings", {
  prefNames: ["captivedetect.canonicalURL"],

  setCallback(value) {
    throw new ExtensionError("secureProxy.settings are readonly");
  },
});

ExtensionPreferencesManager.addSetting("network.ftp.enabled", {
  prefNames: ["network.ftp.enabled"],

  setCallback(value) {
    return { [this.prefNames[0]]: value };
  },
});

ExtensionPreferencesManager.addSetting("network.http.proxy.respect-be-conservative", {
  prefNames: ["network.http.proxy.respect-be-conservative"],

  setCallback(value) {
    return { [this.prefNames[0]]: value };
  },
});

ExtensionPreferencesManager.addSetting("security.tls.version.max", {
  prefNames: ["security.tls.version.max"],

  setCallback(value) {
    return { [this.prefNames[0]]: value };
  },
});

ExtensionPreferencesManager.addSetting("secureProxy.DNSoverHTTP", {
  prefNames: [
    "network.trr.mode",
    "network.trr.uri",
    "network.trr.bootstrapAddress",
    "network.trr.excluded-domains",
    "network.trr.confirmationNS",
    "network_trr_request_timeout_ms",
    "network.trr.request_timeout_mode_trronly_ms",
    "network.trr.fetch_off_main_thread",
  ],

  setCallback(value) {
    return {
      "network.trr.mode": value.mode,
      "network.trr.uri": value.uri,
      "network.trr.bootstrapAddress": value.bootstrapAddress,
      "network.trr.excluded-domains": value.excludedDomains,
      "network.trr.confirmationNS": value.confirmationNS,
      "network_trr_request_timeout_ms": value.requestTimeout,
      "network.trr.request_timeout_mode_trronly_ms": value.requestTimeout,
      "network.trr.fetch_off_main_thread": value.fetchOffMainThread,
    };
  },
});

this.proxyutils = class extends ExtensionAPI {
 constructor(...args) {
    super(...args);
    this.wasOffline = false;
  }

  getAPI(context) {
    const EventManager = ExtensionCommon.EventManager;
    let {
      Management: {
        global: { tabTracker },
      },
    } = ChromeUtils.import("resource://gre/modules/Extension.jsm", null);

    function getTabOrActive(tabId) {
      // eslint-disable-next-line verify-await/check
      let tab = tabId !== null ? tabTracker.getTab(tabId) : tabTracker.activeTab;
      // eslint-disable-next-line verify-await/check
      if (!context.canAccessWindow(tab.ownerGlobal)) {
        throw new ExtensionError(
          tabId === null
            ? "Cannot access activeTab"
            : `Invalid tab ID: ${tabId}`
        );
      }
      return tab;
    }

    return {
      experiments: {
        proxyutils: {

          FTPEnabled: Object.assign(
            ExtensionPreferencesManager.getSettingsAPI(
              context.extension.id,
              "network.ftp.enabled",
              () => {
                return Services.prefs.getBoolPref("network.ftp.enabled");
              },
              undefined,
              false,
              () => {}
            ),
            {
              set: details => {
                return ExtensionPreferencesManager.setSetting(
                  context.extension.id,
                  "network.ftp.enabled",
                  details.value
                );
              },
            }
          ),

          HTTPProxyRespectBeConservative: Object.assign(
            ExtensionPreferencesManager.getSettingsAPI(
              context.extension.id,
              "network.http.proxy.respect-be-conservative",
              () => {
                return Services.prefs.getBoolPref("network.http.proxy.respect-be-conservative");
              },
              undefined,
              false,
              () => {}
            ),
            {
              set: details => {
                return ExtensionPreferencesManager.setSetting(
                  context.extension.id,
                  "network.http.proxy.respect-be-conservative",
                  details.value
                );
              },
            }
          ),

          TLSVersionMax: Object.assign(
            ExtensionPreferencesManager.getSettingsAPI(
              context.extension.id,
              "security.tls.version.max",
              () => {
                return Services.prefs.getBoolPref("security.tls.version.max");
              },
              undefined,
              false,
              () => {}
            ),
            {
              set: details => {
                return ExtensionPreferencesManager.setSetting(
                  context.extension.id,
                  "security.tls.version.max",
                  details.value
                );
              },
            }
          ),

          DNSoverHTTP: Object.assign(
            ExtensionPreferencesManager.getSettingsAPI(
              context.extension.id,
              "secureProxy.DNSoverHTTP",
              () => {
                return {
                  mode: Services.prefs.getIntPref("network.trr.mode"),
                  uri: Services.prefs.getCharPref("network.trr.uri"),
                  bootstrapAddress: Services.prefs.getCharPref("network.trr.bootstrapAddress"),
                  excludedDomains: Services.prefs.getCharPref("network.trr.excluded-domains"),
                  confirmationNS: Services.prefs.getCharPref("network.trr.confirmationNS"),
                  // There are 2 prefs here to control the request timeout.
                  // Returning one or the other doesn't matter because
                  // DNSoverHTTP getter is not actually used.
                  requestTimeout: Services.prefs.getIntPref("network_trr_request_timeout_ms") ||
                                  Services.prefs.getIntPref("network_trr_request_timeout_mode_trronly_ms"),
                  fetchOffMainThread: Services.prefs.getBoolPref("network.trr.fetch_off_main_thread"),
                };
              },
              undefined,
              false,
              () => {}
            ),
            {
              set: details => {
                // We want to keep the existing domains, plus we want to exclude
                // some more:
                // - all the captive portal URLs, because the DNS bootstrap IP
                //   could be blocked by the current network.
                // - the proxy hostname (this is received by the extension),
                //   because we want to use the DNS bootstrap IP via proxy, and this
                //   would be a deadlock.
                // - a few localhost domains, because these cannot be resolved.

                // eslint-disable-next-line verify-await/check
                let domains = Services.prefs.getCharPref("network.trr.excluded-domains").split(",");
                // eslint-disable-next-line verify-await/check
                domains = domains.concat(details.value.excludedDomains.split(","));

                [
                  "captivedetect.canonicalURL",
                  "network.connectivity-service.IPv4.url",
                  "network.connectivity-service.IPv6.url"
                ].forEach(pref => {
                  try {
                    const cdu = getStringPrefValue(pref);
                    let hostname = new URL(cdu).hostname;
                    if (hostname) {
                      // eslint-disable-next-line verify-await/check
                      domains.push(hostname);
                    }
                  } catch (err) {
                    // ignore
                  }
                });

                let localhostDomains = [ "localhost.localdomain", "localhost6.localdomain6", "localhost6"];
                // eslint-disable-next-line verify-await/check
                let excludedDomains = [...new Set(domains.concat(localhostDomains))].join(",");

                // We don't overwrite custom URI pref.
                let uri = details.value.uri;
                // eslint-disable-next-line verify-await/check
                if (Services.prefs.prefHasUserValue("network.trr.uri")) {
                  uri = Services.prefs.getCharPref("network.trr.uri");
                }

                // We don't overwrite custom bootstrap address pref.
                let bootstrapAddress = details.value.bootstrapAddress;
                // eslint-disable-next-line verify-await/check
                if (Services.prefs.prefHasUserValue("network.trr.bootstrapAddress")) {
                  bootstrapAddress = Services.prefs.getCharPref("network.trr.bootstrapAddress");
                }

                return ExtensionPreferencesManager.setSetting(
                  context.extension.id,
                  "secureProxy.DNSoverHTTP",
                  {
                    mode: details.value.mode,
                    uri,
                    bootstrapAddress,
                    excludedDomains,
                    confirmationNS: details.value.confirmationNS,
                    requestTimeout: details.value.requestTimeout,
                    fetchOffMainThread: details.value.fetchOffMainThread,
                  }
                );
              },
            }
          ),

          settings: Object.assign(
            ExtensionPreferencesManager.getSettingsAPI(
              context.extension.id,
              "proxyutils.settings",
              () => {
                return {
                  dohUri: Services.prefs.getCharPref("network.trr.uri"),
                  captiveDetect: getStringPrefValue("captivedetect.canonicalURL"),
                };
              },
              undefined,
              false,
              () => {}
            ),
            {
              set: details => {
                throw new ExtensionError("secureProxy.settings are readonly");
              },
            }
          ),

          // eslint-disable-next-line verify-await/check
          onChanged: new EventManager({
            context,
            name: "proxyutils.onChanged",
            register: fire => {
              let observer = _ => fire.async();
              Services.prefs.addObserver("network.proxy.type", observer);
              Services.prefs.addObserver("network.proxy.no_proxies_on", observer);
              return () => {
                Services.prefs.removeObserver("network.proxy.type", observer);
                Services.prefs.removeObserver("network.proxy.no_proxies_on", observer);
              };
            }
          }).api(),

          // eslint-disable-next-line verify-await/check
          onConnectionChanged: new EventManager({
            context,
            name: "proxyutils.onConnectionChanged",
            register: fire => {
              let observer = _ => {
                let connectivity = true; // let's be optimistic!
                if (gNetworkLinkService.linkStatusKnown) {
                  connectivity = gNetworkLinkService.isLinkUp;
                }
                /* eslint-disable verify-await/check */
                // this method dispatches an async onConnectionChanged event - the name is unrelated to async/sync return value
                fire.async(connectivity);
                /* eslint-enable verify-await/check */
              };
              Services.obs.addObserver(observer, "network:link-status-changed");
              return () => {
                Services.obs.removeObserver(observer, "network:link-status-changed");
              };
            }
          }).api(),

          // eslint-disable-next-line verify-await/check
          onWakeUp: new EventManager({
            context,
            name: "proxyutils.onWakeUp",
            register: fire => {
              let observer = _ => fire.async();
              Services.prefs.addObserver("wake_notification", observer);
              return () => {
                Services.prefs.removeObserver("wake_notification", observer);
              };
            }
          }).api(),
          async showPrompt(message, isWarning) {
            const selector = "#secure-proxy_mozilla_com-browser-action";
            ConfirmationHint.syncShow(selector, message, {isWarning});
          },

          async formatURL(url) {
            return Services.urlFormatter.formatURL(url);
          },

          async loadNetError(errorCode, url, tabId) {
            let nativeTab = getTabOrActive(tabId);
            // eslint-disable-next-line verify-await/check
            let uri = Services.uriFixup.createExposableURI(Services.io.newURI(url));
            let errorEnum = "NS_ERROR_PROXY_BAD_GATEWAY";
            if (errorCode === 407 && errorCode === 429) {
              errorEnum = "NS_ERROR_UNKNOWN_PROXY_HOST";
            }
            // eslint-disable-next-line verify-await/check
            const code = `let spec = "${uri.spec}"; let uri = Services.io.newURI(spec); docShell.displayLoadError(Cr.${errorEnum}, uri, docShell.failedChannel);`;
            const mm = nativeTab.linkedBrowser.messageManager;
            // eslint-disable-next-line verify-await/check
            mm.loadFrameScript(`data:,${encodeURI(code)}`, false);
          },

        },
      },
    };
  }
};
