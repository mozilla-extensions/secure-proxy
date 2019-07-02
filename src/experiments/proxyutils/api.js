/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* globals ChromeUtils, ExtensionAPI, ExtensionCommon, Services, Ci */

"use strict";

ChromeUtils.defineModuleGetter(this, "Services",
                               "resource://gre/modules/Services.jsm");

ChromeUtils.defineModuleGetter(this, "UIState",
                               "resource://services-sync/UIState.jsm");
ChromeUtils.defineModuleGetter(this, "ObjectUtils",
                               "resource://gre/modules/ObjectUtils.jsm");
ChromeUtils.defineModuleGetter(this, "setTimeout",
                               "resource://gre/modules/Timer.jsm");

// Cribbed from browser.js with some changes to allow for our strings
var ConfirmationHint = {
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
  show(selector, messageContent, options = {}) {
    const anchor = Services.wm.getMostRecentWindow("navigator:browser").document.querySelector(selector);
    this._message.textContent = messageContent;

    this._description.hidden = true;
    this._panel.classList.remove("with-description");

    if (options.hideArrow) {
      this._panel.setAttribute("hidearrow", "true");
    }

    // The timeout value used here allows the panel to stay open for
    // 1.5s second after the text transition (duration=120ms) has finished.
    // If there is a description, we show for 4s after the text transition.
    const DURATION = options.showDescription ? 4000 : 1500;
    this._panel.addEventListener("popupshown", () => {
      this._animationBox.setAttribute("animate", "true");

      setTimeout(() => {
        this._panel.hidePopup(true);
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

  get _document() {
    return Services.wm.getMostRecentWindow("navigator:browser").document;
  },

  get _panel() {
    delete this._panel;
    return this._panel = this._document.getElementById("confirmation-hint");
  },

  get _animationBox() {
    delete this._animationBox;
    return this._animationBox = this._document.getElementById("confirmation-hint-checkmark-animation-container");
  },

  get _message() {
    delete this._message;
    return this._message = this._document.getElementById("confirmation-hint-message");
  },

  get _description() {
    delete this._description;
    return this._description = this._document.getElementById("confirmation-hint-description");
  },
};

this.proxyutils = class extends ExtensionAPI {
  getAPI(context) {
    const EventManager = ExtensionCommon.EventManager;

    return {
      experiments: {
        proxyutils: {
          onChanged: new EventManager({
            context,
            name: "proxyutils.onChanged",
            register: fire => {
              let observer = _ => fire.async();
              Services.prefs.addObserver("network.proxy.type", observer);
              return () => {
                Services.prefs.removeObserver("network.proxy.type", observer);
              }
            }
          }).api(),

          async showPrompt(message) {
            const selector = "#secure-proxy_mozilla_com-browser-action";
            ConfirmationHint.show(selector, message, {});
          },

          async hasProxyInUse() {
            let proxyType = Services.prefs.getIntPref("network.proxy.type");
            return proxyType == Ci.nsIProtocolProxyService.PROXYCONFIG_PAC ||
                   proxyType == Ci.nsIProtocolProxyService.PROXYCONFIG_WPAD ||
                   proxyType == Ci.nsIProtocolProxyService.PROXYCONFIG_MANUAL;
          },
          async getCaptivePortalURL() {
            return Services.prefs.getStringPref("captivedetect.canonicalURL");
          },
        },
      },
    };
  }
};
