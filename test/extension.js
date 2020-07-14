const webdriver = require("selenium-webdriver"),
  By = webdriver.By,
  until = webdriver.until;

const assert = require("assert");

module.exports = class ExtensionHelper {
  constructor(driver, addonUUID) {
    this.driver = driver;
    this.addonUUID = addonUUID;
  }

  async whenReady() {
    await this.driver.setContext("chrome");
    const id = await this.driver.findElement(
      By.id("secure-proxy_mozilla_com-browser-action")
    );
    assert.ok(!!id, "We have secure-proxy installed");

    const check = async () => {
      const style = await id.getAttribute("style");
      assert.ok(
        style.includes("badge_off.svg") || style.includes("badge_warning.svg"),
        "The extension is not ready yet"
      );
      return style.includes("badge_warning.svg");
    };

    await this.driver.wait(() => check(), 10000);
    return id;
  }

  // We are unable to debug popups with webdriver. Let's open the popup in a new tab.
  async openPanel() {
    await this.driver.setContext("content");

    // Marionette crashes if we load the extension directly. Let's load something in the meantime.
    await this.driver.get("https://fpn.firefox.com");

    await this.driver.get(
      "moz-extension://" + this.addonUUID + "/popup/popup.html"
    );
    const handle = await this.waitForURL(
      "moz-extension://" + this.addonUUID + "/popup/popup.html"
    );
    await this.skipPopupLoading();
    return handle;
  }

  async skipPopupLoading() {
    const check = async () => {
      let titles = await this.driver.findElements(By.css("h2"));
      if (titles.length === 0) {
        return true;
      }

      let found = false;
      for (let title of titles) {
        try {
          const text = await title.getText();
          if (text.includes("Loading…")) {
            found = true;
            break;
          }
        } catch (e) {}
      }

      return !found;
    };

    await this.driver.wait(() => check(), 10000);
  }

  async setupStaging() {
    const tab = await this.waitForURL(
      "moz-extension://" + this.addonUUID + "/pages/welcome.html"
    );
    await this.driver.setContext("content");
    await this.driver.executeScript(`
      browser.storage.local.set({
        fxaOpenID: '${process.env.FXA_OPEN_ID}',
        sps: '${process.env.SPS}',
      }).then(() => browser.runtime.reload());
    `);

    // Let's go back to an existing handle.
    this.driver.switchTo().window((await this.driver.getAllWindowHandles())[0]);

    // Let's wait until the extension is reloaded.
    await new Promise(r => setTimeout(r, 1000));
  }

  async waitForURL(url) {
    await this.driver.setContext("content");

    // I'm sure there is something better than this, but this is the only
    // solution to monitor the tab loading so far.
    return await new Promise(resolve => {
      const check = async () => {
        const handles = await this.driver.getAllWindowHandles();
        for (let handle of handles) {
          await this.driver.switchTo().window(handle);
          const t = await this.driver.getCurrentUrl();
          if (t.includes(url)) {
            resolve(handle);
            return;
          }
        }

        setTimeout(check, 500);
      };

      check();
    });
  }

  async waitForElement(elmName) {
    await this.driver.setContext("content");
    return await this.driver.wait(until.elementLocated(By.id(elmName)), 10000);
  }

  async waitForWindowClose(handle) {
    await this.driver.setContext("content");

    const check = async () => {
      const handles = await this.driver.getAllWindowHandles();
      return !handles.find(h => h == handle);
    };

    await this.driver.wait(() => check(), 10000);
  }

  async settingsButtonStatus() {
    await this.driver.setContext("content");
    let button = await this.driver.findElement(By.id("settingsButton"));
    assert.ok(!!button);
    return await button.isDisplayed();
  }

  async backButtonStatus() {
    await this.driver.setContext("content");
    let button = await this.driver.findElement(By.id("backButton"));
    assert.ok(!!button);
    return await button.isDisplayed();
  }

  async icon() {
    await this.driver.setContext("chrome");
    const id = await this.driver.findElement(
      By.id("secure-proxy_mozilla_com-browser-action")
    );
    assert.ok(!!id, "We have secure-proxy installed");

    const style = await id.getAttribute("style");
    if (style.includes("badge_warning.svg")) {
      return "warning";
    }

    if (style.includes("badge_off.svg")) {
      return "off";
    }

    if (style.includes("badge_on.svg")) {
      return "on";
    }

    return "unknown";
  }
};
