/* eslint-disable verify-await/check */

import {WellKnownData} from "./wellKnownData.js";

const tests = [
  {
    name: "WellKnownData",
    run: testWellKnownData,
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

export class Tester {
  static async run(main) {
    // No recursion!
    setTimeout(async _ => {
      debuggingMode = true;

      log("TEST STARTING!");

      for (let i = 0; i < tests.length; ++i) {
        log(`TEST ${tests[i].name}`);
        await tests[i].run(main);
      }

      log("TEST COMPLETED!");
    });
  }

  static is(a, b, msg) {
    if (a !== b) {
      log(`TEST ERROR!!! ${a} !== ${b}: ${msg}`);
      console.trace();
    } else {
      log(`TEST OK ${a} === ${b}: ${msg}`);
    }
  }
}
