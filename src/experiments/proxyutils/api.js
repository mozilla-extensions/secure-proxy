/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* globals ChromeUtils, ExtensionAPI, ExtensionCommon, Services, Ci */

"use strict";

ChromeUtils.defineModuleGetter(this, "Services",
                               "resource://gre/modules/Services.jsm");

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
