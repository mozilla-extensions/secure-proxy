const identityForFennec = {
  getRedirectURL() {
    return "https://cb7cbf5bedba243279adcd23bc6b88de7a304388.extensions.allizom.org/";
  },

  launchWebAuthFlow(details) {
    console.log("launchWebAuthFlow for Fennec");

    // Validate the url and retreive redirect_uri if it was provided.
    let url, redirectURI;
    try {
      url = new URL(details.url);
    } catch (e) {
      return Promise.reject({ message: "details.url is invalid" });
    }
    try {
      redirectURI = new URL(
        url.searchParams.get("redirect_uri") || this.getRedirectURL()
      );
    } catch (e) {
      return Promise.reject({ message: "redirect_uri is invalid" });
    }

    return new Promise(resolve => {
      browser.tabs.create({url: details.url}).then(tab => {
        function handler(details) {
          browser.webRequest.onBeforeRequest.removeListener(handler);
          browser.tabs.remove(tab.id);
          resolve(details.url);
        }

        browser.webRequest.onBeforeRequest.addListener(
          handler, {urls: [redirectURI + "*"], tabId: tab.id});
      });
    });
  },
};
