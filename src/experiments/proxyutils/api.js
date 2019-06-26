/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* globals ChromeUtils, ExtensionAPI, ExtensionCommon, ObjectUtils, Services,
   UIState */

"use strict";

ChromeUtils.defineModuleGetter(this, "Services",
                               "resource://gre/modules/Services.jsm");
ChromeUtils.defineModuleGetter(this, "UIState",
                               "resource://services-sync/UIState.jsm");
ChromeUtils.defineModuleGetter(this, "ObjectUtils",
                               "resource://gre/modules/ObjectUtils.jsm");

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
  show(anchor, messageContent, options = {}) {
    this._message.textContent = messageContent;

    if (options.showDescription) {
      this._description.textContent =
          gBrowserBundle.GetStringFromName(`confirmationHint.${messageId}.description`);
      this._description.hidden = false;
      this._panel.classList.add("with-description");
    } else {
      this._description.hidden = true;
      this._panel.classList.remove("with-description");
    }

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

  get _panel() {
    delete this._panel;
    return this._panel = document.getElementById("confirmation-hint");
  },

  get _animationBox() {
    delete this._animationBox;
    return this._animationBox = document.getElementById("confirmation-hint-checkmark-animation-container");
  },

  get _message() {
    delete this._message;
    return this._message = document.getElementById("confirmation-hint-message");
  },

  get _description() {
    delete this._description;
    return this._description = document.getElementById("confirmation-hint-description");
  },
};

this.proxyutils = class extends ExtensionAPI {
  getAPI(context) {
    const EventManager = ExtensionCommon.EventManager;

    return {
      experiments: {
        proxyutils: {
          async showPrompt(message) {
            return ConfirmationHint.show(anchor, message, {});
          },
          async getCurrentState(syncType) {
            return Services.prefs.getStringPref("captivedetect.canonicalURL", false);
          },
          async getCaptivePortalURL() {
            return Services.prefs.getStringPref("captivedetect.canonicalURL");
          },
        },
      },
    };
  }
};
