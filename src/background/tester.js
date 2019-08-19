const tests = [
  {
    name: "Initial state",
    run: firstStart,
  },
  {
    name: "Authentication flow",
    run: authenticationFlow,
  },
];

async function firstStart(m) {
  await browser.storage.local.clear();

  Tester.is(m.proxyState, PROXY_STATE_LOADING, "Loading state expected");

  Tester.is(m.proxyState, PROXY_STATE_UNAUTHENTICATED, "Unauthenticated state expected");
  Tester.is(await browser.browserAction.getTitle({}), "Firefox Private Network is inactive", "Title is inactive");
}

async function authenticationFlow(m) {
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
  await m.handleEvent("tokenGenerated", { tokenType: "bearer", tokenValue: "WOW" });
  // To be continue...
}

let testRunning = false;

export class Tester {
  static isRunning() {
    return testRunning;
  }

  static async run(main) {
    // No recursion!
    if (testRunning) return false;

    testRunning = true;
    debuggingMode = true;

    setTimeout(async _ => {
      for (let i = 0; i < tests.length; ++i) {
        log(`TEST ${tests[i].name}`);
        await tests[i].run(main);
      }

      log("TEST COMPLETED!");
    });
  }

  static is(a, b, msg) {
    if (a !== b) {
      log(`ERROR!!! ${a} !== ${b}: ${msg}`);
    } else {
      log(`OK ${a} === ${b}: ${msg}`);
    }
  }
};
