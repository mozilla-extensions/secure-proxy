/* eslint-env node */

const defaultConfig = {
  // Global options:
  sourceDir: "./src/",
  artifactsDir: "./dist/",
  ignoreFiles: [".DS_Store", "./background/tester.js"],
  // Command options:
  build: {
    overwriteDest: true,
  },
  run: {
    firefox: "nightly",
    browserConsole: true,
    startUrl: ["about:debugging"],
  },
};

module.exports = defaultConfig;
