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
    fxaCryptoRelier: false
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  root: true,
  rules: {
    "no-unused-vars": ["error", {vars: "all", args: "none", ignoreRestSiblings: true }],
    "no-console": "off"
  }
};
