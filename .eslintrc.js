module.exports = {
  env: {
    browser: true,
    es6: true,
    webextensions: true
  },
  extends: [
    "eslint:recommended"
  ],
  globals: {
    fxaCryptoRelier: false,
    PROXY_STATE_OFFLINE: false,
    PROXY_STATE_UNKNOWN: false,
    PROXY_STATE_INACTIVE: false,
    PROXY_STATE_CONNECTING: false,
    PROXY_STATE_ACTIVE: false,
    PROXY_STATE_OTHERINUSE: false,
    PROXY_STATE_PROXYERROR: false,
    PROXY_STATE_PROXYAUTHFAILED: false,
    PROXY_STATE_AUTHFAILURE: false,
    Survey: false
},
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  root: true,
  rules: {
    "eqeqeq": "off",
    "no-console": "off",
    "no-throw-literal": "error",
    "no-unused-vars": ["error", {vars: "all", args: "none", ignoreRestSiblings: true}],
    "no-var": "warn",
    "no-warning-comments": "warn",
    "prefer-const": "off"
  }
};
