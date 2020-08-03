const webdriver = require("selenium-webdriver"),
  By = webdriver.By,
  Keys = webdriver.Key,
  until = webdriver.until;

const ExtensionHelper = require("./extension.js");
const FirefoxHelper = require("./firefox.js");

const assert = require("assert");

describe("Secure-Proxy - on/off", function() {
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

  it("Setup the staging env", async () => {
    await eh.setupStaging();
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
    await emailField.sendKeys(process.env.ACCOUNT_EMAIL_ALLOW);

    let buttonElm = await eh.driver.findElement(By.id("submit-btn"));
    assert.ok(!!buttonElm);
    buttonElm.click();

    await eh.waitForURL("https://accounts.stage.mozaws.net/oauth/signin");

    const passwordField = await eh.driver.findElement(By.id("password"));
    assert.ok(!!passwordField);
    passwordField.sendKeys(process.env.ACCOUNT_PASSWD_ALLOW);

    buttonElm = await eh.driver.findElement(By.id("submit-btn"));
    assert.ok(!!buttonElm);
    await buttonElm.click();

    await eh.waitForWindowClose(authHandle);

    eh.driver.switchTo().window(popupHandle);
  });

  it("Onboarding", async () => {
    const popupHandle = await eh.openPanel();

    await eh.driver.setContext("content");
    let closeButton = await eh.waitForElement("onboardingCloseButton");
    await closeButton.click();
  });

  it("Off/On", async () => {
    const popupHandle = await eh.openPanel();

    await eh.driver.setContext("content");

    // Off view
    let title = await eh.driver.findElement(By.css("h2"));
    assert.ok((await title.getText()).includes("Private Network is off"));

    let buttonElm = await eh.driver.findElement(By.id("stateButton"));

    const ipCheck = async () => {
      try {
        if ((await buttonElm.getText()).includes(".")){
          return true;
        }
      } catch (e) {}

      return false;
    };

    // Let's take the IP before the proxy on.
    await eh.driver.executeScript(
      "fetch('https://ifconfig.me/ip').then(r => r.text()).then(ip => {" +
      "  document.getElementById('stateButton').textContent = ip; });");
    await eh.driver.wait(() => ipCheck(), 10000);
    const ipOff = await buttonElm.getText();
    await eh.driver.executeScript("document.getElementById('stateButton').textContent = '';");

    // Let's enable the proxy.
    await buttonElm.click();

    const check = async () => {
      try {
        const title = await eh.driver.findElement(By.css("h2"));
        if ((await title.getText()).includes("Private Network is on")) {
          return true;
        }
      } catch (e) {}

      return false;
    };
    await eh.driver.wait(() => check(), 10000);

    await eh.driver.executeScript(
      "fetch('https://ifconfig.me/ip').then(r => r.text()).then(ip => {" +
      "  document.getElementById('stateButton').textContent = ip; });");
    await eh.driver.wait(() => ipCheck(), 10000);
    const ipOn = await buttonElm.getText();

    assert.ok(ipOn != ipOff, "We have a different IP address");
  });
});
