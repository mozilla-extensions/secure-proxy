/* eslint-env node */

const defaultConfig = {
  // Global options:
  sourceDir: "./src/",
  artifactsDir: "./dist/",
  ignoreFiles: [".DS_Store"],
  // Command options:
  build: {
    overwriteDest: true,
  },
  run: {
    firefox: "nightly",
    browserConsole: true,
    startUrl: ["about:debugging"],
    pref: ["secureProxy.debugging.enabled=true"],
  },
};

module.exports = defaultConfig;
