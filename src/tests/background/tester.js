/* eslint-disable verify-await/check */

import {ConnectionTester} from "../../background/connection.js";
import {StorageUtils} from "../../background/storage.js";
import {Survey} from "../../background/survey.js";
import {WellKnownData} from "../../background/wellKnownData.js";

const tests = [
  {
    name: "WellKnownData",
    run: testWellKnownData,
    disabled: false,
  },
  {
    name: "Survey",
    run: testSurvey,
    disabled: false,
  },
  {
    name: "ConnectionTester",
    run: testConnectionTester,
    disabled: false,
  },
  {
    name: "Initial state",
    run: testFirstStart,
    disabled: false,
  },
  {
    name: "Authentication flow",
    run: testAuthenticationFlow,
    disabled: false,
  },
];

async function testWellKnownData() {
  const wkd = new WellKnownData();
  wkd.init({value: {}});

  Tester.is(wkd.hasWellKnownData(), false, "No data initially");
  Tester.is(wkd.isAuthUrl("wow"), false, "IsAuthUrl works also without data");
  Tester.is(wkd.isAuthUrl("https://accounts.firefox.com"), true, "IsAuthUrl works also without data");
  Tester.is(wkd.excludedDomains().length, 0, "ExcludedDomains returns an empty array");

  // Now, let's fetch data.
  Tester.is(await wkd.getIssuerEndpoint(), "https://accounts.firefox.com", "issuer URL");
  Tester.is(await wkd.getProfileEndpoint(), "https://profile.accounts.firefox.com/v1/profile", "profile URL");
  Tester.is(await wkd.getTokenEndpoint(), "https://oauth.accounts.firefox.com/v1/token", "token URL");
  Tester.is(wkd.excludedDomains().length, 3, "ExcludedDomains returns something");
  Tester.is(wkd.isAuthUrl("https://profile.accounts.firefox.com"), true, "IsAuthUrl works better with data");
  Tester.is(wkd.isAuthUrl("https://oauth.accounts.firefox.com"), true, "IsAuthUrl works better with data");
}

async function testSurvey() {
  await browser.storage.local.clear();

  let self = await browser.management.getSelf();
  let loadingTest1Promise = new Promise(resolve => {
    browser.webRequest.onBeforeRequest.addListener(function listener(details) {
      if (details.url === "http://example1.com/false/" + self.version) {
        Tester.is(true, true, "Correct URL opened by survey!");
        browser.webRequest.onBeforeRequest.removeListener(listener);
        resolve();
      }
    }, {urls: ["<all_urls>"]});
  });

  let loadingTest2Promise = new Promise(resolve => {
    browser.webRequest.onBeforeRequest.addListener(function listener(details) {
      if (details.url === "http://example2.com/false/" + self.version) {
        Tester.is(true, true, "Correct URL opened by survey!");
        browser.webRequest.onBeforeRequest.removeListener(listener);
        resolve();
      }
    }, {urls: ["<all_urls>"]});
  });

  let s = new Survey({ registerObserver: _ => {}});
  await s.initInternal([
    { name: "test 1", triggerAfterTime: 0, URL: "http://example1.com/PROXYENABLED/VERSION" },
    { name: "test 2", triggerAfterTime: 5, URL: "http://example2.com/PROXYENABLED/VERSION" },
  ]);

  await loadingTest1Promise;
  Tester.is(await StorageUtils.getLastSurvey(), "test 1", "Test survey has been executed");

  log("Wait a few seconds...");

  await loadingTest2Promise;
  Tester.is(await StorageUtils.getLastSurvey(), "test 2", "Test survey has been executed");
}

async function testConnectionTester() {
  try {
    await ConnectionTester.run();
    Tester.is(false, false, "This should not be resolved!");
  } catch (e) {
    Tester.is(true, true, "ConnectionTester rejects the operation if the proxy is down");
  }
}

async function testFirstStart(m) {
  await browser.storage.local.clear();

  Tester.is(m.proxyState, PROXY_STATE_UNAUTHENTICATED, "Unauthenticated state expected");
  Tester.is(await browser.browserAction.getTitle({}), "Firefox Private Network is inactive", "Title is inactive");
}

async function testAuthenticationFlow(m) {
  await browser.storage.local.clear();

  Tester.is(m.proxyState, PROXY_STATE_UNAUTHENTICATED, "Unauthenticated state expected");
  Tester.is(await browser.browserAction.getTitle({}), "Firefox Private Network is inactive", "Title is inactive");

  log("Authenticating and aborting the process...");
  await new Promise(resolve => {
    const authPromise = m.handleEvent("authenticationRequired");

    log("Listener");
    browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tabInfo) {
      if (changeInfo.url && changeInfo.url.startsWith("https://accounts.firefox.com/authorization")) {
        browser.tabs.onUpdated.removeListener(listener);
        browser.tabs.remove(tabId);
        resolve(authPromise);
      }
    });
  });

  Tester.is(m.proxyState, PROXY_STATE_AUTHFAILURE, "Authentication failure state expected");

  log("Simulating a token generation");
  const token = {
    received_at: Math.round((performance.timeOrigin + performance.now()) / 1000),
    expires_in: 3600 * 3,
  };

  await StorageUtils.setAllTokenData("REFRESH", token, token, "PROFILE DATA");

  /* eslint-disable require-atomic-updates */
  m.fxa.cachedProxyTokenValue.tokenType = "bearer";
  m.fxa.cachedProxyTokenValue.tokenValue = "PROXY";
  m.fxa.nextExpirerTime = 1234;
  /* eslint-enable require-atomic-updates */

  await m.handleEvent("tokenGenerated", { tokenType: "bearer", tokenValue: "PROXY" });
  Tester.is(m.proxyState, PROXY_STATE_CONNECTING, "Connecting state expected");

  await new Promise(resolve => {
    browser.webRequest.onHeadersReceived.addListener(function listener(details) {
      browser.webRequest.onHeadersReceived.removeListener(listener);
      resolve();
    }, {urls: ["http://test.factor11.cloudflareclient.com/"]});
  });

  Tester.is(m.proxyState, PROXY_STATE_PROXYAUTHFAILED, "Authentication failure state expected");
}

export class Tester {
  static async run(main) {
    // No recursion!
    setTimeout(async _ => {
      debuggingMode = true;

      dump("\x1b[34mTEST STARTING\x1b[0m\n");

      for (let i = 0; i < tests.length; ++i) {
        log(`TEST ${tests[i].name}`);

        if (tests[i].disabled) {
          dump("\x1b[34mTEST DISABLED!\x1b[0m\n");
          continue;
        }

        await tests[i].run(main);
      }

      dump("\x1b[34mTEST COMPLETED!\x1b[0m\n");
    });
  }

  static is(a, b, msg) {
    if (a !== b) {
      dump(`\x1b[31mTEST ERROR!!! ${a} !== ${b}: ${msg}\x1b[0m\n`);
      console.trace();
    } else {
      dump(`\x1b[32mTEST OK ${a} === ${b}: ${msg}\x1b[0m\n`);
    }
  }
}
