export const identityForFennec = {
  getRedirectURL() {
    return "https://cb7cbf5bedba243279adcd23bc6b88de7a304388.extensions.allizom.org/";
  },

  async launchWebAuthFlow(details) {
    console.log("launchWebAuthFlow for Fennec");

    // Validate the url and retreive redirect_uri if it was provided.
    const url = new URL(details.url);

    const redirectURI = new URL(
      // eslint-disable-next-line verify-await/check
      url.searchParams.get("redirect_uri") || this.getRedirectURL()
    );

    const tab = await browser.tabs.create({url: details.url});

    return new Promise(resolve => {
      function handler(details) {
        // eslint-disable-next-line verify-await/check
        browser.webRequest.onBeforeRequest.removeListener(handler);
        // eslint-disable-next-line verify-await/check
        browser.tabs.remove(tab.id);
        // eslint-disable-next-line verify-await/check
        resolve(details.url);
      }

      browser.webRequest.onBeforeRequest.addListener(
        handler, {urls: [redirectURI + "*"], tabId: tab.id});
    });
  },
};
