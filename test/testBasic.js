const webdriver = require("selenium-webdriver"),
  By = webdriver.By,
  Keys = webdriver.Key,
  until = webdriver.until;

const ExtensionHelper = require("./extension.js");
const FirefoxHelper = require("./firefox.js");

const assert = require("assert");

describe("Secure-Proxy", function() {
  let eh;

  this.timeout(2000000);

  before(async () => {
    eh = await FirefoxHelper.createDriver();
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

    const warning = await eh.driver.wait(
      until.elementLocated(By.css("p[data-mode='warning']")),
      10000
    );
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

    assert.equal(await eh.icon(), "warning");
  });

  it("Settings", async () => {
    const popupHandle = await eh.openPanel();

    assert.equal(await eh.settingsButtonStatus(), true);
    assert.equal(await eh.backButtonStatus(), false);
    assert.equal(await eh.icon(), "warning");

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
    assert.equal(await eh.icon(), "warning");

    await eh.driver.setContext("content");

    // Off view
    let title = await eh.driver.findElement(By.css("h2"));
    assert.ok((await title.getText()).includes("Private Network is off"));

    let buttonElm = await eh.driver.findElement(By.id("stateButton"));
    await buttonElm.click();

    const check = async () => {
      try {
        const title = await eh.driver.findElement(By.css("h2"));
        if ((await title.getText()).includes("Private Network is on")) {
          return true;
        }
      } catch (e) {}

      const ps = await eh.driver.findElements(By.css("p"));
      for (let p of ps) {
        if (
          (await p.getText()).includes(
            "Turn off Firefox Private Network on another browser to use it here."
          ) &&
          (await p.isDisplayed())
        ) {
          return true;
        }
      }

      return false;
    };
    await eh.driver.wait(() => check(), 10000);
  });
});
