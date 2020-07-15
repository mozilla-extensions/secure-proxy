const DEVICES = 4;

const webdriver = require("selenium-webdriver"),
  By = webdriver.By,
  Keys = webdriver.Key,
  until = webdriver.until;

const { Command } = require("selenium-webdriver/lib/command");
const firefox = require("selenium-webdriver/firefox");
const fs = require("fs");

const ExtensionHelper = require("./extension.js");

const assert = require("assert");

describe("Secure-Proxy - DeviceLimit", function() {
  const ehs = [];
  let deviceLimitFound = false;

  this.timeout(2000000);

  before(async () => {
    require("dotenv").config();

    assert.ok(
      fs.existsSync(".env"),
      "The .env file exists. See .env-test-dist"
    );
    assert.ok(fs.existsSync(process.env.FIREFOX_PATH), "Firefox exists");
    assert.ok(fs.existsSync(process.env.XPI_PATH), "The extension exists");

    const options = new firefox.Options();
    options.setPreference("xpinstall.signatures.required", false);
    options.setPreference("extensions.install.requireBuiltInCerts", false);
    options.setPreference("extensions.webapi.testing", true);
    options.setPreference("extensions.legacy.enabled", true);
    options.setPreference("extensions.experiments.enabled", true);
    options.setBinary(process.env.FIREFOX_PATH);

    for (let i = 0; i < DEVICES; ++i) {
      const driver = await new webdriver.Builder()
        .forBrowser("firefox")
        .setFirefoxOptions(options)
        .build();

      const command = new Command("install addon")
        .setParameter("path", process.env.XPI_PATH)
        .setParameter("temporary", true);

      await driver.execute(command);

      await driver.setContext("chrome");
      const addonUUID = await driver.executeScript(
        "var Cu = Components.utils;" +
          "const {WebExtensionPolicy} = Cu.getGlobalForObject(Cu.import(" +
          '"resource://gre/modules/Extension.jsm", this));' +
          "const extensions = WebExtensionPolicy.getActiveExtensions();" +
          "for (let extension of extensions) {" +
          '  if (extension.id === "secure-proxy@mozilla.com") {' +
          "    return extension.mozExtensionHostname;" +
          "  }" +
          "}"
      );

      ehs.push(new ExtensionHelper(driver, addonUUID));
    }
  });

  beforeEach(async () => {});

  afterEach(async () => {});

  after(async () => {
    for (let eh of ehs) {
      await eh.driver.quit();
    }
  });

  it("Setup the staging envs", async () => {
    for (let eh of ehs) {
      await eh.setupStaging();
    }
  });

  it("Start the authentication", async () => {
    for (let eh of ehs) {
      const popupHandle = await eh.openPanel();

      let authButton = await eh.waitForElement("authButton");
      assert.ok(!!authButton, "The authentication button exists");

      await authButton.click();

      const authHandle = await eh.waitForURL(
        "https://accounts.stage.mozaws.net/oauth/"
      );

      const emailField = await eh.driver.findElement(By.className("email"));
      assert.ok(!!emailField);
      await emailField.sendKeys(process.env.ACCOUNT_EMAIL);

      let buttonElm = await eh.driver.findElement(By.id("submit-btn"));
      assert.ok(!!buttonElm);
      buttonElm.click();

      await eh.waitForURL("https://accounts.stage.mozaws.net/oauth/signin");

      const passwordField = await eh.driver.findElement(By.id("password"));
      assert.ok(!!passwordField);
      passwordField.sendKeys(process.env.ACCOUNT_PASSWD);

      buttonElm = await eh.driver.findElement(By.id("submit-btn"));
      assert.ok(!!buttonElm);
      await buttonElm.click();

      await eh.waitForWindowClose(authHandle);

      eh.driver.switchTo().window(popupHandle);
    }
  });

  it("Skip Onboarding", async () => {
    for (let eh of ehs) {
      const popupHandle = await eh.openPanel();

      await eh.driver.setContext("content");
      let closeButton = await eh.waitForElement("onboardingCloseButton");
      await closeButton.click();
    }
  });

  it("Activate", async () => {
    for (let eh of ehs) {
      // Nothing to test.
      if (deviceLimitFound) {
        return;
      }

      const popupHandle = await eh.openPanel();

      await eh.driver.setContext("content");

      // Off view
      let title = await eh.driver.findElement(By.css("h2"));
      assert.ok((await title.getText()).includes("Private Network is off"));

      let buttonElm = await eh.driver.findElement(By.id("stateButton"));
      await buttonElm.click();

      const check = async () => {
        const title = await eh.driver.findElement(By.css("h2"));
        if ((await title.getText()).includes("Private Network is on")) {
          return true;
        }

        const ps = await eh.driver.findElements(By.css("p"));
        for (let p of ps) {
          if (
            (await p.getText()).includes(
              "Turn off Firefox Private Network on another browser to use it here."
            ) &&
            (await p.isDisplayed())
          ) {
            deviceLimitFound = true;
            return true;
          }
        }

        return false;
      };
      await eh.driver.wait(() => check(), 10000);
    }
  });

  it("Device limit found", () => {
    assert.ok(deviceLimitFound, "We are in device limit mode!");
  });
});
