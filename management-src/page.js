const DEBUGGING_PROXY_URL = "https://proxy-staging.cloudflareclient.com:8001";
const PRODUCTION_PROXY_URL = "https://firefox.factor11.cloudflareclient.com:2486";

const DEBUGGING_FXA_OPENID = "https://stable.dev.lcip.org/.well-known/openid-configuration";
const PRODUCTION_FXA_OPENID = "https://accounts.firefox.com/.well-known/openid-configuration";

const DEBUGGING_MIGRATION_URL = "https://private-network-beta-landing-test.stage.mozaws.net/files/migration.json";
const PRODUCTION_MIGRATION_URL = "https://private-network.firefox.com/files/migration.json";

class Page {
  constructor() {
    const els = [...document.querySelectorAll("[data-l10n]")];
    for (let el of els) {
      el.textContent = this.getTranslation(el.getAttribute("data-l10n"));
    }
  }

  async init() {
    let config = await browser.runtime.sendMessage({ type: "getCurrentConfig" });
    if (!config) config = {};

    const version = document.getElementById("version");
    if (config.version) {
      version.innerText = config.version;
    } else {
      version.innerText = this.getTranslation("olderThanV10");
      config.version = 0;
    }

    const reloadButton = document.getElementById("reload");
    reloadButton.onclick = _ => {
      browser.runtime.sendMessage({ type: "reload" });
    }
    if (config.version < 10) {
      reloadButton.disabled = true;
    }

    const debuggingEnabled = document.getElementById("debuggingEnabled");
    debuggingEnabled.checked = config.debuggingEnabled || false;
    debuggingEnabled.onchange = _ => {
      browser.runtime.sendMessage({ type: "setDebuggingEnabled", value: debuggingEnabled.checked });
    }

    const proxyURL = document.getElementById("proxyURL");
    proxyURL.value = config.proxyURL || "";
    proxyURL.onchange = _ => {
      browser.runtime.sendMessage({ type: "setProxyURL", value: proxyURL.value });
    }
    if (config.version < 10) {
      proxyURL.disabled = true;
    }

    const debuggingProxyURL = document.getElementById("debuggingProxyURL");
    debuggingProxyURL.onclick = _ => {
      proxyURL.value = DEBUGGING_PROXY_URL;
      browser.runtime.sendMessage({ type: "setProxyURL", value: DEBUGGING_PROXY_URL });
    }

    const productionProxyURL = document.getElementById("productionProxyURL");
    productionProxyURL.onclick = _ => {
      proxyURL.value = PRODUCTION_PROXY_URL;
      browser.runtime.sendMessage({ type: "setProxyURL", value: PRODUCTION_PROXY_URL });
    }

    const migrationURL = document.getElementById("migrationURL");
    migrationURL.value = config.migrationURL || "";
    migrationURL.onchange = _ => {
      browser.runtime.sendMessage({ type: "setMigrationURL", value: migrationURL.value });
    }
    if (config.version < 12) {
      migrationURL.disabled = true;
    }

    const debuggingMigrationURL = document.getElementById("debuggingMigrationURL");
    debuggingMigrationURL.onclick = _ => {
      migrationURL.value = DEBUGGING_MIGRATION_URL;
      browser.runtime.sendMessage({ type: "setMigrationURL", value: DEBUGGING_MIGRATION_URL });
    }

    const productionMigrationURL = document.getElementById("productionMigrationURL");
    productionMigrationURL.onclick = _ => {
      migrationURL.value = PRODUCTION_MIGRATION_URL;
      browser.runtime.sendMessage({ type: "setMigrationURL", value: PRODUCTION_MIGRATION_URL });
    }

    const migrationData = document.getElementById("migrationData");
    migrationData.value = JSON.stringify(config.migrationData);
    if (config.version < 12) {
      migrationData.disabled = true;
    }

    const migrationSubmitButton = document.getElementById("migrationDataSubmit");
    migrationSubmitButton.onclick = _ => {
      try {
        const value = JSON.parse(migrationData.value);
        browser.runtime.sendMessage({ type: "setMigrationData", value });
      } catch (e) {
        alert("Syntax invalid: " + e);
      }
    }

    const fxaOpenID = document.getElementById("fxaOpenID");
    fxaOpenID.value = config.fxaOpenID || "";
    fxaOpenID.onchange = _ => {
      browser.runtime.sendMessage({ type: "setFxaOpenID", value: fxaOpenID.value });
    }
    if (config.version < 10) {
      fxaOpenID.disabled = true;
    }

    const debuggingFxaOpenID = document.getElementById("debuggingFxaOpenID");
    debuggingFxaOpenID.onclick = _ => {
      fxaOpenID.value = DEBUGGING_FXA_OPENID;
      browser.runtime.sendMessage({ type: "setFxaOpenID", value: DEBUGGING_FXA_OPENID });
    }

    const productionFxaOpenID = document.getElementById("productionFxaOpenID");
    productionFxaOpenID.onclick = _ => {
      fxaOpenID.value = PRODUCTION_FXA_OPENID;
      browser.runtime.sendMessage({ type: "setFxaOpenID", value: PRODUCTION_FXA_OPENID });
    }

    const fxaExpirationTime = document.getElementById("fxaExpirationTime");
    fxaExpirationTime.value = config.fxaExpirationTime || 60;
    fxaExpirationTime.onchange = _ => {
      browser.runtime.sendMessage({ type: "setFxaExpirationTime", value: fxaExpirationTime.value });
    }
    if (config.version < 10) {
      fxaExpirationTime.disabled = true;
    }

    const fxaExpirationDelta = document.getElementById("fxaExpirationDelta");
    fxaExpirationDelta.value = config.fxaExpirationDelta || 10;
    fxaExpirationDelta.onchange = _ => {
      browser.runtime.sendMessage({ type: "setFxaExpirationDelta", value: fxaExpirationDelta.value });
    }
    if (config.version < 10) {
      fxaExpirationDelta.disabled = true;
    }

    const tokens = await browser.runtime.sendMessage({ type: "getTokens" });

    const proxyToken = document.getElementById("proxyToken");
    proxyToken.value = JSON.stringify(tokens.proxy);
    if (config.version < 10) {
      proxyToken.disabled = true;
    }

    const proxySubmitButton = document.getElementById("proxySubmit");
    proxySubmitButton.onclick = _ => {
      try {
        const value = JSON.parse(proxyToken.value);
        browser.runtime.sendMessage({ type: "setProxyToken", value });
      } catch (e) {
        alert("Syntax invalid: " + e);
      }
    }
    if (config.version < 10) {
      proxySubmitButton.disabled = true;
    }

    const profileToken = document.getElementById("profileToken");
    profileToken.value = JSON.stringify(tokens.profile);
    if (config.version < 10) {
      profileToken.disabled = true;
    }

    const profileSubmitButton = document.getElementById("profileSubmit");
    profileSubmitButton.onclick = _ => {
      try {
        const value = JSON.parse(profileToken.value);
        browser.runtime.sendMessage({ type: "setProfileToken", value });
      } catch (e) {
        alert("Syntax invalid: " + e);
      }
    }
    if (config.version < 10) {
      profileSubmitButton.disabled = true;
    }
  }

  getTranslation(stringName, ...args) {
    if (args.length > 0) {
      return browser.i18n.getMessage(stringName, ...args);
    }
    return browser.i18n.getMessage(stringName);
  }
}

const p = new Page();
p.init();
