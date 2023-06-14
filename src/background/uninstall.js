
(() => {
  const uninstall = () => {
    browser.management.uninstallSelf();
  };
  browser.management.onInstalled.addListener(() => {
    uninstall();
  });
  browser.runtime.onInstalled.addListener(() => {
    uninstall();
  });
})();

