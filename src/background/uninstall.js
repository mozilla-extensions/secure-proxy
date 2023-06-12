
(() => {
  browser.management.onInstalled.addListener(() => {
    browser.management.uninstallSelf();
  });
})();

