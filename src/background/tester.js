/* eslint-disable verify-await/check */

const tests = [
];

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
