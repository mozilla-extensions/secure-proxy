module.exports = {
  env: {
    browser: true,
    es6: true,
    webextensions: true
  },
  extends: [
    "eslint:recommended",
    "plugin:mozilla/recommended"
  ],
  globals: {
    Component: false,
    Template: false,
    escapedTemplate: false,
    debuggingMode: true,
    fxaCryptoRelier: false,
    log: false,
    FxAUtils: false,
    Network: false,
    UI: false,
    PROXY_STATE_LOADING: false,
    PROXY_STATE_OFFLINE: false,
    PROXY_STATE_INACTIVE: false,
    PROXY_STATE_CONNECTING: false,
    PROXY_STATE_ACTIVE: false,
    PROXY_STATE_OTHERINUSE: false,
    PROXY_STATE_PROXYERROR: false,
    PROXY_STATE_PROXYAUTHFAILED: false,
    PROXY_STATE_AUTHFAILURE: false,
    PROXY_STATE_UNAUTHENTICATED: false,
    PROXY_URL: false,
    Survey: false
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  plugins: [
    "mozilla"
  ],
  root: true,
  rules: {
    "prettier/prettier": "off",

    "comma-dangle": ["off", "never"],
    "eqeqeq": "error",
    "no-console": "off",
    "no-unused-vars": ["error", {vars: "local", args: "none"}],
    "no-var": "error"
  }
};
