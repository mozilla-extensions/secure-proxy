"use strict";

/* global ExtensionAPI */

ChromeUtils.import("resource://gre/modules/Console.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

/* eslint-disable-next-line */
var {EventManager, EventEmitter} = ExtensionCommon;
/* eslint-disable-next-line no-var */
var {Management: {global: {tabTracker}}} = ChromeUtils.import("resource://gre/modules/Extension.jsm", {});

// eslint-disable-next-line no-undef
ChromeUtils.defineModuleGetter(
  this,
  "BrowserWindowTracker",
  "resource:///modules/BrowserWindowTracker.jsm",
);

/** Return most recent NON-PRIVATE browser window, so that we can
 * manipulate chrome elements on it.
 */
function getMostRecentBrowserWindow() {
  return BrowserWindowTracker.getTopWindow({
    private: false,
    allowPopups: false,
  });
}

const addonID = "#secure-proxy_mozilla_com-browser-action";

class PopupNotificationEventEmitter extends EventEmitter {
  emitShow(variationName) {
    const self = this;
    const recentWindow = getMostRecentBrowserWindow();
    const browser = recentWindow.gBrowser.selectedBrowser;
    const tabId = tabTracker.getBrowserTabId(browser);

    const primaryAction =  {
      disableHighlight: true,
      label: "Page Was Broken",
      accessKey: "f",
      callback: () => {
        const hasException = Services.perms.testExactPermissionFromPrincipal(recentWindow.gBrowser.contentPrincipal, "trackingprotection") === Services.perms.ALLOW_ACTION;
        if (!hasException) {
          const addExceptionButton = recentWindow.document.getElementById("tracking-action-unblock");
          addExceptionButton.doCommand();
        }
        self.emit("page-broken", tabId);
      },
    };
    const secondaryActions =  [
      {
        label: "Other Reason",
        accessKey: "d",
        callback: () => {
          self.emit("page-not-broken", tabId);
        },
      },
    ];

    // option name is described as: "An optional string formatted to look bold and used in the
    //                    notification description header text. Usually a host name or
    //                    addon name."
    // It is bold, but not used in a header, we're working with it anyway.
    const options = {
      hideClose: true,
      persistent: true,
      autofocus: true,
      name: "Firefox Survey: ",
      popupIconURL: "chrome://branding/content/icon64.png",
    };
    recentWindow.PopupNotifications.show(browser, addonID, "<> Why did you reload this page?", null, primaryAction, secondaryActions, options);
  }
}

this.popupNotification = class extends ExtensionAPI {
  /**
   * Extension Shutdown
   * Goes through each tab for each window and removes the notification, if it exists.
   */
  onShutdown(shutdownReason) {
    for (const win of BrowserWindowTracker.orderedWindows) {
      for (const browser of win.gBrowser.browsers) {
        const notification = win.PopupNotifications.getNotification("cookie-restriction", browser);
        if (notification) {
          win.PopupNotifications.remove(notification);
        }
      }
    }
  }

  getAPI(context) {
    const popupNotificationEventEmitter = new PopupNotificationEventEmitter();
    return {
experiments: {
      popupNotification: {
        show() {
          popupNotificationEventEmitter.emitShow();
        },
        onReportPageBroken: new EventManager(
          context,
          "popupNotification.onReportPageBroken",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            popupNotificationEventEmitter.on(
              "page-broken",
              listener,
            );
            return () => {
              popupNotificationEventEmitter.off(
                "page-broken",
                listener,
              );
            };
          },
        ).api(),
        onReportPageNotBroken: new EventManager(
          context,
          "popupNotification.onReportPageNotBroken",
          fire => {
            const listener = (value, tabId) => {
              fire.async(tabId);
            };
            popupNotificationEventEmitter.on(
              "page-not-broken",
              listener,
            );
            return () => {
              popupNotificationEventEmitter.off(
                "page-not-broken",
                listener,
              );
            };
          },
        ).api(),
      },
},
    };
  }
};

