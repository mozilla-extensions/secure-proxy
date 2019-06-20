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

this.proxyutils = class extends ExtensionAPI {
  getAPI(context) {
    const EventManager = ExtensionCommon.EventManager;

    return {
      experiments: {
        proxyutils: {
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
