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
    CONNECTING_HTTP_REQUEST: false,
    escapedTemplate: false,
    debuggingMode: true,
    DEFAULT_AUTORENEW: false,
    DEFAULT_REMINDER: false,
    DOH_URI: false,
    DOH_BOOTSTRAP_ADDRESS: false,
    FXA_DEVICE_LIMIT: false,
    FXA_ERR_AUTH: false,
    FXA_ERR_GEO: false,
    FXA_ERR_NETWORK: false,
    FXA_OK: false,
    FXA_PAYMENT_REQUIRED: false,
    fxaCryptoRelier: false,
    log: false,
    MODE_3RD_PARTY_TRACKER_ONLY: false,
    MODE_ALL: false,
    MODE_TRACKER_ONLY: false,
    PROXY_STATE_ACTIVE: false,
    PROXY_STATE_AUTHFAILURE: false,
    PROXY_STATE_CAPTIVE: false,
    PROXY_STATE_CONNECTING: false,
    PROXY_STATE_DEVICELIMIT: false,
    PROXY_STATE_GEOFAILURE: false,
    PROXY_STATE_INACTIVE: false,
    PROXY_STATE_LOADING: false,
    PROXY_STATE_OFFLINE: false,
    PROXY_STATE_ONBOARDING: false,
    PROXY_STATE_OTHERINUSE: false,
    PROXY_STATE_PAYMENTREQUIRED: false,
    PROXY_STATE_PROXYAUTHFAILED: false,
    PROXY_STATE_PROXYERROR: false,
    PROXY_STATE_UNAUTHENTICATED: false,
    Template: false,
    ConfigUtils: false
  },
  parser: "babel-eslint",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  plugins: [
    "mozilla",
  ],
  root: true,
  ignorePatterns: ["vendor/", "node_modules/"],
  rules: {
    "prettier/prettier": "off",

    "comma-dangle": ["off", "never"],
    "eqeqeq": "error",
    "no-console": "off",
    "no-unused-vars": ["error", {vars: "local", args: "none"}],
    "no-var": "error"
  }
};
