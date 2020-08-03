const webdriver = require("selenium-webdriver"),
  By = webdriver.By,
  Keys = webdriver.Key,
  until = webdriver.until;

const ExtensionHelper = require("./extension.js");
const FirefoxHelper = require("./firefox.js");

const assert = require("assert");
const jsonwebtoken = require("jsonwebtoken");

describe("Secure-Proxy - JWT", function() {
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
  });

  it("JWT", async () => {
    await eh.driver.setContext("content");

    await eh.driver.executeScript(`
      browser.storage.local.get(["proxyTokenData"]).then(data => {
        document.getElementById('stateButton').textContent = JSON.stringify(data.proxyTokenData); });
    `);

    const buttonElm = await eh.driver.findElement(By.id("stateButton"));
    const check = async () => {
      try {
        if ((await buttonElm.getText()).includes("{")){
          return true;
        }
      } catch (e) {}

      return false;
    };

    await eh.driver.wait(() => check(), 10000);
    const data = JSON.parse(await buttonElm.getText());
    assert.ok(!!data, "We have the token");
    assert.equal(data.expires_in, 3600, "We want 1 hour token");
    assert.ok(data.received_at > (Date.now() / 1000) - 300, "The token has been received in the last minutes");
    assert.ok(!!data.token, "The token is a string");

    const jwt = jsonwebtoken.decode(data.token);
    assert.equal(jwt.iss, "https://accounts.stage.mozaws.net");
    assert.equal(jwt.aud.length, 2);
    assert.equal(jwt.aud[0], "565585c1745a144d");
    assert.equal(jwt.aud[1], "https://firefox.factor11.cloudflareclient.com:2486");
    assert.equal(jwt.client_id, "565585c1745a144d");
    assert.equal(jwt.scope, "https://identity.mozilla.com/apps/secure-proxy/unlimited");
  });
});
