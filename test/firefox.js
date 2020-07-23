const assert = require("assert");
const firefox = require("selenium-webdriver/firefox");
const fs = require("fs");
const webdriver = require("selenium-webdriver");

const { Command } = require("selenium-webdriver/lib/command");

const ExtensionHelper = require("./extension.js");

module.exports = class FirefoxHelper {
  static async createDrivers(number) {
    require("dotenv").config();

    assert.ok(fs.existsSync(process.env.FIREFOX_PATH), "Firefox exists");
    assert.ok(fs.existsSync(process.env.XPI_PATH), "The extension exists");

    const options = new firefox.Options();
    options.setPreference("xpinstall.signatures.required", false);
    options.setPreference("extensions.install.requireBuiltInCerts", false);
    options.setPreference("extensions.webapi.testing", true);
    options.setPreference("extensions.legacy.enabled", true);
    options.setPreference("extensions.experiments.enabled", true);
    options.setBinary(process.env.FIREFOX_PATH);

    if (process.env.HEADLESS) {
      options.headless();
    }

    const ehs = [];

    for (let i = 0; i < number; ++i) {
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

    return ehs;
  }

  static async createDriver() {
    const ehs = await this.createDrivers(1);
    assert.equal(ehs.length, 1);
    return ehs[0];
  }
};
