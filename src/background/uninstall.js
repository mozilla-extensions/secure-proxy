
(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.management.uninstallSelf();
  });
})();

