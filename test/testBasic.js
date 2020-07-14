const webdriver = require("selenium-webdriver"),
  By = webdriver.By,
  Keys = webdriver.Key,
  until = webdriver.until;

const { Command } = require("selenium-webdriver/lib/command");
const firefox = require("selenium-webdriver/firefox");
const fs = require("fs");

const ExtensionHelper = require("./extension.js");

const assert = require("assert");

describe("Secure-Proxy", function() {
  let eh;

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

    eh = new ExtensionHelper(driver, addonUUID);
  });

  beforeEach(async () => {});

  afterEach(async () => {});

  after(async () => {
    await eh.driver.quit();
  });

  it("Welcome page is shown", async () => {
    const tab = await eh.waitForURL(
      "moz-extension://" + eh.addonUUID + "/pages/welcome.html"
    );
    assert.equal(await eh.driver.getTitle(), "Firefox Private Network");
  });

  it("Secure-Proxy icon shown", async () => {
    const id = await eh.whenReady();

    const style = await id.getAttribute("style");
    assert.ok(style.includes("badge_warning.svg"), "The extension is ready");
  });

  it("Setup the staging env", async () => {
    await eh.setupStaging();
  });

  it("Initial screen", async () => {
    const popupHandle = await eh.openPanel();

    assert.equal(await eh.settingsButtonStatus(), false);
    assert.equal(await eh.backButtonStatus(), false);
    assert.equal(await eh.icon(), "warning");

    await eh.driver.setContext("content");

    let authButton = await eh.waitForElement("authButton");
    assert.ok(!!authButton, "The authentication button exists");
  });

  it("Start and abort authentication", async () => {
    const popupHandle = await eh.openPanel();

    let authButton = await eh.waitForElement("authButton");
    assert.ok(!!authButton, "The authentication button exists");
    await authButton.click();

    await eh.waitForURL("https://accounts.stage.mozaws.net/oauth/");
    eh.driver.close();

    eh.driver.switchTo().window(popupHandle);

    const warning = await eh.driver.wait(until.elementLocated(By.css("p[data-mode='warning']")), 10000);
    assert.ok(!!warning, "We have a warning element");
    assert.ok((await warning.getText()).includes("Sign in failed"));

    assert.equal(await eh.settingsButtonStatus(), false);
    assert.equal(await eh.backButtonStatus(), false);
    assert.equal(await eh.icon(), "warning");
  });

  it("Start the authentication", async () => {
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
  });

  it("Onboarding", async () => {
    const popupHandle = await eh.openPanel();

    await eh.driver.setContext("content");
    await eh.driver.wait(async () => await eh.settingsButtonStatus(), 10000);

    assert.equal(await eh.settingsButtonStatus(), true);
    assert.equal(await eh.backButtonStatus(), false);
    assert.equal(await eh.icon(), "warning");

    await eh.driver.setContext("content");

    // Onboarding view 1
    let titles = await eh.driver.findElements(By.css("h2"));
    assert.ok(titles.length > 0);

    for (let title of titles) {
      if ((await title.getText()).includes("Cover your steps")) {
        assert.ok(await title.isDisplayed());
      } else {
        assert.ok(!(await title.isDisplayed()));
      }
    }

    buttonElm = await eh.driver.findElement(By.id("onboardingNextButton"));
    await buttonElm.click();

    // Onboarding view 2
    titles = await eh.driver.findElements(By.css("h2"));
    assert.ok(titles.length > 0);
    for (let title of titles) {
      if ((await title.getText()).includes("Throw off trackers")) {
        assert.ok(await title.isDisplayed());
      } else {
        assert.ok(!(await title.isDisplayed()));
      }
    }

    buttonElm = await eh.driver.findElement(By.id("onboardingNextButton"));
    await buttonElm.click();

    titles = await eh.driver.findElements(By.css("h2"));
    assert.ok(titles.length > 0);
    for (let title of titles) {
      if ((await title.getText()).includes("Simple to use")) {
        assert.ok(await title.isDisplayed());
      } else {
        assert.ok(!(await title.isDisplayed()));
      }
    }

    buttonElm = await eh.driver.findElement(By.id("onboardingDoneButton"));
    await buttonElm.click();

    assert.equal(await eh.icon(), "off");
  });

  it("Settings", async () => {
    const popupHandle = await eh.openPanel();

    assert.equal(await eh.settingsButtonStatus(), true);
    assert.equal(await eh.backButtonStatus(), false);
    assert.equal(await eh.icon(), "off");

    await eh.driver.setContext("content");

    let button = await eh.driver.findElement(By.id("settingsButton"));
    await button.click();

    assert.equal(await eh.settingsButtonStatus(), false);
    assert.equal(await eh.backButtonStatus(), true);

    for (let a of [
      "manageAccount",
      "contactUs",
      "helpAndSupport",
      "giveUsFeedback",
      "privacyPolicy",
      "termsAndConditions",
      "cloudflare"
    ]) {
      let elm = await eh.driver.findElement(By.id(a));
      assert.ok(!!elm);
    }

    button = await eh.driver.findElement(By.id("backButton"));
    await button.click();

    assert.equal(await eh.settingsButtonStatus(), true);
    assert.equal(await eh.backButtonStatus(), false);
  });

  it("Off/On", async () => {
    const popupHandle = await eh.openPanel();

    assert.equal(await eh.settingsButtonStatus(), true);
    assert.equal(await eh.backButtonStatus(), false);
    assert.equal(await eh.icon(), "off");

    await eh.driver.setContext("content");

    // Off view
    let title = await eh.driver.findElement(By.css("h2"));
    assert.ok((await title.getText()).includes("Private Network is off"));

    let buttonElm = await eh.driver.findElement(By.id("stateButton"));
    await buttonElm.click();

    const check = async () => {
      let title = await eh.driver.findElement(By.css("h2"));
      return (await title.getText()).includes("Private Network is on");
    };
    await eh.driver.wait(() => check(), 10000);
  });
});
